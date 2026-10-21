import "server-only";
import { type Actor, check, type Permission } from "@wyrm/auth";
import { type Ctx, getTenant } from "@wyrm/core";
import { redirect } from "next/navigation";
import { type Access, coreContext, requireAccess } from "./auth";

/** The customer area needs a tenant actor (or a Wyrm "view as" session). */
export interface TenantPage {
  access: Access;
  ctx: Ctx;
  tenantId: string;
  tenantName: string;
  readOnly: boolean;
  /** Can this person do `permission` (optionally for one agent)? For showing buttons only. */
  can: (permission: Permission, agentId?: string) => boolean;
}

export async function requireTenant(): Promise<TenantPage> {
  const access = await requireAccess();
  const actor = access.actor;
  const me = actor?.kind === "tenant" ? actor : actor?.kind === "impersonating" ? actor.as : null;
  if (!me) redirect("/dashboard");
  const ctx = await coreContext(access);
  const tenantName =
    access.tenants.find((t) => t.tenantId === me.tenantId)?.name ??
    (await getTenant(ctx, me.tenantId).then(
      (t) => t.name,
      () => "Your business",
    ));
  return {
    access,
    ctx,
    tenantId: me.tenantId,
    tenantName,
    readOnly: actor?.kind === "impersonating" && actor.readOnly,
    can: (permission, agentId) =>
      check(
        actor as Actor,
        permission,
        agentId ? { tenantId: me.tenantId, agentId } : { tenantId: me.tenantId },
      ).allowed,
  };
}

export const OUTCOME_LABELS: Record<string, string> = {
  resolved_confirmed: "Resolved (confirmed)",
  resolved_assumed: "Resolved (assumed)",
  booked: "Booked",
  lead: "New lead",
  handed_off: "Handed to a person",
  abandoned: "Ended early",
  failed: "Failed",
};

export const CHANNEL_LABELS: Record<string, string> = {
  voice: "Phone",
  web_chat: "Website chat",
  sms: "Text message",
  email: "Email",
  whatsapp: "WhatsApp",
  form: "Form",
};

/** The brain's reasons in plain words ("why it did this"). */
const REASONS: Record<string, string> = {
  confident_match: "It was clear which agent should help.",
  continue_active_flow: "The customer was already talking to this agent.",
  faq_match: "It matched a saved answer, so no AI was needed.",
  customer_asked_for_person: "The customer asked for a person.",
  customer_opted_out: "The customer asked us to stop messaging.",
  unsure_ask_once: "It wasn't sure what the customer needed, so it asked.",
  still_unclear: "Still unclear after asking, so it passed it to a person.",
  low_confidence: "It wasn't confident enough to act, so it passed it to a person.",
  no_matching_agent: "None of your agents handles this, so it passed it to a person.",
  no_live_agents: "No agent was switched on.",
  budget_used_up: "This month's AI budget was used up, so it took a message.",
  saver_mode_free_models_only: "Close to today's AI budget, so it used the free model.",
  classifier_failed: "An AI service didn't answer; it tried the next one.",
  no_classifier_available: "No AI service was available, so it took a message.",
  flow_agent_unavailable: "The agent was paused, so it passed it to a person.",
  kill_switch_global: "Wyrm paused all assistants.",
  kill_switch_tenant: "Your assistants were paused.",
};

export const explainReason = (reason: string | null) =>
  (reason && REASONS[reason]) || "Decision recorded.";

export const PROVIDER_LABELS: Record<string, string> = {
  code: "No AI (rules)",
  anthropic: "Claude",
  groq: "Free AI model",
  fallback: "Fallback",
};

/** USD millionths as "$1.23" (or "<$0.01"). */
export function money(micros: number) {
  if (micros > 0 && micros < 10_000) return "<$0.01";
  return `$${(micros / 1_000_000).toFixed(2)}`;
}

export function when(date: Date, now = new Date()) {
  const minutes = Math.round((now.getTime() - date.getTime()) / 60_000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} h ago`;
  return date.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}

export const NOTICES: Record<string, string> = {
  saved: "Saved.",
  approved: "Approved. The agent will carry it out.",
  rejected: "Rejected. The customer will be told someone will follow up.",
  resolved: "Marked as done.",
  published: "Published. The agent uses this version now.",
  restored: "Restored. The agent uses that version again.",
  paused: "Paused.",
  resumed: "Switched back on.",
  taught: "Thanks. The agent will use this answer from now on.",
  test_added: "Test added.",
  invited: "Invitation created.",
};
