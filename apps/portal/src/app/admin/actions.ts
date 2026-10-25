"use server";

import { ForbiddenError } from "@wyrm/auth";
import {
  createTenant,
  DomainError,
  endViewAs,
  provisionAgent,
  resendInvitation,
  setAgentStatus,
  setTenantStatus,
  signOffLaunch,
  startViewAs,
} from "@wyrm/core";
import { revalidatePath } from "next/cache";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { coreContext, requireAdmin, VIEW_AS_COOKIE } from "@/lib/auth";
import { isEmail, isValidSlug, slugify } from "@/lib/config";

export interface CreateClientState {
  error?: string;
  created?: { name: string; inviteUrl: string };
}

function explain(error: unknown): string {
  if (error instanceof DomainError) return error.message;
  if (error instanceof ForbiddenError) return "Your Wyrm role doesn't allow this.";
  console.error("admin action failed", error instanceof Error ? error.message : error);
  return "Something went wrong. Nothing was changed.";
}

/**
 * Creates a client organisation with a draft receptionist and an Owner invitation. The
 * invitation link is shown once to the Wyrm admin (emails arrive in stage 6).
 */
export async function createClient(
  _prev: CreateClientState,
  formData: FormData,
): Promise<CreateClientState> {
  const access = await requireAdmin();
  const name = String(formData.get("name") ?? "").trim();
  const slug = slugify(String(formData.get("slug") ?? "") || name);
  const ownerEmail = String(formData.get("ownerEmail") ?? "")
    .trim()
    .toLowerCase();
  const plan = String(formData.get("plan") ?? "pilot");
  const seatLimit = Number(formData.get("seatLimit") ?? 5);

  if (name.length < 2 || name.length > 120)
    return { error: "Business name must be 2–120 characters." };
  if (!isValidSlug(slug))
    return { error: "Short name must be 2–60 lower-case letters, digits or dashes." };
  if (!isEmail(ownerEmail)) return { error: "Owner email doesn't look right." };
  if (!["pilot", "starter", "growth", "enterprise"].includes(plan))
    return { error: "Unknown plan." };
  if (!Number.isInteger(seatLimit) || seatLimit < 1 || seatLimit > 500)
    return { error: "Seats must be a whole number from 1 to 500." };

  try {
    const ctx = await coreContext(access);
    const { tenant, token } = await createTenant(ctx, {
      name,
      slug,
      plan: plan as "pilot",
      seatLimit,
      ownerEmail,
    });
    await provisionAgent(ctx, { tenantId: tenant.id, name: "Receptionist", type: "receptionist" });
    const host = (await headers()).get("host") ?? "";
    revalidatePath("/admin");
    return { created: { name: tenant.name, inviteUrl: `https://${host}/invite/${token}` } };
  } catch (error) {
    return { error: explain(error) };
  }
}

export async function changeClientStatus(formData: FormData) {
  const access = await requireAdmin();
  const tenantId = String(formData.get("tenantId") ?? "");
  const status = formData.get("status") === "suspended" ? "suspended" : "active";
  try {
    await setTenantStatus(await coreContext(access), tenantId, status);
  } catch (error) {
    console.error("status change failed", explain(error));
  }
  revalidatePath("/admin");
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const idOf = (form: FormData, name: string) => {
  const value = String(form.get(name) ?? "");
  return UUID.test(value) ? value : "";
};

export interface InviteLinkState {
  error?: string;
  url?: string;
}

/**
 * A fresh link for a pending (or expired) invitation: valid 7 days, the old link stops working.
 * Returned to the page only, never put in a URL or a log.
 */
export async function newInviteLinkAction(
  _prev: InviteLinkState,
  formData: FormData,
): Promise<InviteLinkState> {
  const access = await requireAdmin();
  try {
    const { token } = await resendInvitation(
      await coreContext(access),
      idOf(formData, "tenantId"),
      idOf(formData, "invitationId"),
    );
    const host = (await headers()).get("host") ?? "";
    return { url: `https://${host}/invite/${token}` };
  } catch (error) {
    return { error: explain(error) };
  }
}

/** Wyrm staff switch a client's agent on or off. */
export async function adminAgentStatus(formData: FormData) {
  const access = await requireAdmin();
  const tenantId = idOf(formData, "tenantId");
  const status = formData.get("status") === "live" ? "live" : "paused";
  let error = "";
  try {
    await setAgentStatus(await coreContext(access), {
      tenantId,
      agentId: idOf(formData, "agentId"),
      status,
    });
  } catch (e) {
    error = explain(e);
  }
  revalidatePath(`/admin/tenants/${tenantId}`);
  redirect(`/admin/tenants/${tenantId}${error ? `?error=${encodeURIComponent(error)}` : ""}`);
}

/**
 * Starts "view as" a client's staff member: 30 minutes, a reason, logged in the client's own
 * audit log; Support staff get a read-only view.
 */
export async function viewAsAction(formData: FormData) {
  const access = await requireAdmin();
  const tenantId = idOf(formData, "tenantId");
  let sessionId = "";
  let error = "";
  try {
    const session = await startViewAs(await coreContext(access), {
      tenantUserId: idOf(formData, "tenantUserId"),
      reason: String(formData.get("reason") ?? "").slice(0, 500),
    });
    sessionId = session?.id ?? "";
  } catch (e) {
    error = explain(e);
  }
  if (!sessionId)
    redirect(`/admin/tenants/${tenantId}?error=${encodeURIComponent(error || "Couldn't start.")}`);
  (await cookies()).set(VIEW_AS_COOKIE, sessionId, {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/",
    maxAge: 30 * 60,
  });
  redirect("/dashboard");
}

export async function endViewAsAction() {
  const access = await requireAdmin();
  const store = await cookies();
  const sessionId = store.get(VIEW_AS_COOKIE)?.value ?? "";
  if (UUID.test(sessionId)) {
    try {
      await endViewAs(await coreContext(access), sessionId);
    } catch (e) {
      console.error("end view as failed", explain(e));
    }
  }
  store.delete(VIEW_AS_COOKIE);
  redirect("/admin");
}

/** Wyrm staff confirm an agent's setup was reviewed and it may go live. */
export async function signOffAction(formData: FormData) {
  const access = await requireAdmin();
  const tenantId = idOf(formData, "tenantId");
  let error = "";
  try {
    await signOffLaunch(await coreContext(access), {
      tenantId,
      agentId: idOf(formData, "agentId"),
      note: String(formData.get("note") ?? "").slice(0, 500),
    });
  } catch (e) {
    error = explain(e);
  }
  revalidatePath(`/admin/tenants/${tenantId}`);
  redirect(`/admin/tenants/${tenantId}${error ? `?error=${encodeURIComponent(error)}` : ""}`);
}

/** Templates Wyrm can add to a client from the back office (the agent starts as a draft). */
const TEMPLATES = {
  receptionist: "Receptionist",
  sales: "Sales agent",
  knowledge: "Ask your documents",
} as const;

export async function addAgentAction(formData: FormData) {
  const access = await requireAdmin();
  const tenantId = idOf(formData, "tenantId");
  const type = String(formData.get("type") ?? "");
  const name = String(formData.get("name") ?? "")
    .trim()
    .slice(0, 80);
  let error = "";
  try {
    if (!(type in TEMPLATES)) throw new DomainError("bad_type", "Choose a template.");
    await provisionAgent(await coreContext(access), {
      tenantId,
      name: name || TEMPLATES[type as keyof typeof TEMPLATES],
      type: type as keyof typeof TEMPLATES,
    });
  } catch (e) {
    error = explain(e);
  }
  revalidatePath(`/admin/tenants/${tenantId}`);
  redirect(`/admin/tenants/${tenantId}${error ? `?error=${encodeURIComponent(error)}` : ""}`);
}
