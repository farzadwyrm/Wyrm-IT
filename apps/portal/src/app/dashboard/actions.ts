"use server";

import { ForbiddenError } from "@wyrm/auth";
import {
  addCorrection,
  clearSwitch,
  DomainError,
  decideApproval,
  inviteStaff,
  publishVersion,
  resolveAttention,
  retireCorrection,
  saveDraft,
  setAgentStatus,
  setBudget,
  setSwitch,
  testFromConversation,
} from "@wyrm/core";
import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { safeNext } from "@/lib/config";
import { requireTenant } from "@/lib/portal";

const field = (form: FormData, name: string, max = 2000) =>
  String(form.get(name) ?? "")
    .trim()
    .slice(0, max);

/** Runs a change, then goes back to the page with a short notice or error code. */
async function act(
  form: FormData,
  notice: string,
  run: (page: Awaited<ReturnType<typeof requireTenant>>) => Promise<unknown>,
) {
  const back = safeNext(field(form, "back", 300) || "/dashboard");
  const page = await requireTenant();
  let error: string | null = null;
  if (page.readOnly) error = "read_only";
  else {
    try {
      await run(page);
    } catch (e) {
      if (e instanceof DomainError) error = e.code;
      else if (e instanceof ForbiddenError) error = "forbidden";
      else {
        console.error("dashboard action failed", e instanceof Error ? e.message : e);
        error = "unknown";
      }
    }
  }
  revalidatePath("/dashboard", "layout");
  const url = new URL(back, "https://portal.local");
  url.searchParams.delete("notice");
  url.searchParams.delete("error");
  url.searchParams.set(error ? "error" : "notice", error ?? notice);
  redirect(`${url.pathname}${url.search}`);
}

export async function approveAction(form: FormData) {
  const approve = form.get("decision") === "approve";
  await act(form, approve ? "approved" : "rejected", (p) =>
    decideApproval(p.ctx, {
      tenantId: p.tenantId,
      approvalId: field(form, "approvalId", 64),
      approve,
      reason: field(form, "reason", 500),
    }),
  );
}

export async function resolveAction(form: FormData) {
  await act(form, "resolved", (p) =>
    resolveAttention(p.ctx, p.tenantId, field(form, "conversationId", 64)),
  );
}

export async function teachAction(form: FormData) {
  await act(form, "taught", (p) =>
    addCorrection(p.ctx, {
      tenantId: p.tenantId,
      agentId: field(form, "agentId", 64),
      correctAnswer: field(form, "correctAnswer"),
      ...(field(form, "wrongAnswer") ? { wrongAnswer: field(form, "wrongAnswer") } : {}),
      ...(field(form, "topic", 80) ? { topic: field(form, "topic", 80) } : {}),
      ...(field(form, "question", 1000) ? { question: field(form, "question", 1000) } : {}),
      ...(field(form, "conversationId", 64)
        ? { conversationId: field(form, "conversationId", 64) }
        : {}),
      ...(Number(form.get("messageId")) > 0 ? { messageId: Number(form.get("messageId")) } : {}),
    }),
  );
}

export async function retireAction(form: FormData) {
  await act(form, "saved", (p) =>
    retireCorrection(p.ctx, p.tenantId, field(form, "correctionId", 64)),
  );
}

export async function makeTestAction(form: FormData) {
  await act(form, "test_added", (p) =>
    testFromConversation(p.ctx, {
      tenantId: p.tenantId,
      conversationId: field(form, "conversationId", 64),
      name: field(form, "name", 120),
      expectation: field(form, "expectation", 1000) || "Handles this the same way or better.",
    }),
  );
}

export async function agentStatusAction(form: FormData) {
  const status = form.get("status") === "live" ? "live" : "paused";
  await act(form, status === "live" ? "resumed" : "paused", (p) =>
    setAgentStatus(p.ctx, { tenantId: p.tenantId, agentId: field(form, "agentId", 64), status }),
  );
}

/** The agent's plain-language settings, saved as a draft version. */
export async function saveDraftAction(form: FormData) {
  await act(form, "saved", (p) =>
    saveDraft(p.ctx, {
      tenantId: p.tenantId,
      agentId: field(form, "agentId", 64),
      settings: {
        greeting: field(form, "greeting", 300),
        businessFacts: field(form, "businessFacts", 4000),
        handoffContact: field(form, "handoffContact", 200),
        tone: field(form, "tone", 40) || "friendly",
      },
    }),
  );
}

export async function publishAction(form: FormData) {
  await act(form, form.get("restore") === "1" ? "restored" : "published", (p) =>
    publishVersion(p.ctx, {
      tenantId: p.tenantId,
      agentId: field(form, "agentId", 64),
      versionId: field(form, "versionId", 64),
    }),
  );
}

export async function pauseEverythingAction(form: FormData) {
  const on = form.get("on") === "1";
  await act(form, on ? "paused" : "resumed", async (p) => {
    if (on)
      return setSwitch(p.ctx, {
        scope: "tenant",
        tenantId: p.tenantId,
        reason: field(form, "reason", 300) || "Paused from the portal",
      });
    return clearSwitch(p.ctx, field(form, "switchId", 64));
  });
}

export async function budgetAction(form: FormData) {
  const dollars = Number(field(form, "dollars", 12));
  await act(form, "saved", (p) => {
    if (!Number.isFinite(dollars)) throw new DomainError("bad_budget", "Enter an amount.");
    return setBudget(p.ctx, p.tenantId, Math.round(dollars * 1_000_000));
  });
}

export interface InviteState {
  error?: string;
  link?: string;
}

export async function inviteAction(_prev: InviteState, form: FormData): Promise<InviteState> {
  const page = await requireTenant();
  if (page.readOnly) return { error: "View-only session." };
  try {
    const { token } = await inviteStaff(page.ctx, {
      tenantId: page.tenantId,
      email: field(form, "email", 200),
      roleId: field(form, "roleId", 64),
    });
    revalidatePath("/dashboard/settings");
    const host = (await headers()).get("host") ?? "";
    return { link: `https://${host}/invite/${token}` };
  } catch (e) {
    if (e instanceof DomainError) return { error: e.message };
    if (e instanceof ForbiddenError) return { error: "Your role can't invite with that role." };
    console.error("invite failed", e instanceof Error ? e.message : e);
    return { error: "Couldn't create the invitation." };
  }
}
