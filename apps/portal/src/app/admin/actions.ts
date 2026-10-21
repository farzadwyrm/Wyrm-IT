"use server";

import { ForbiddenError } from "@wyrm/auth";
import { createTenant, DomainError, provisionAgent, setTenantStatus } from "@wyrm/core";
import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { coreContext, requireAdmin } from "@/lib/auth";
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
