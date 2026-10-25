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
export { explainReason } from "./reasons";

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
  saved: "Saved as a draft. Publish to make it live.",
  lead_saved: "Lead updated.",
  approved: "Approved. The agent will carry it out.",
  rejected: "Rejected. The customer will be told someone will follow up.",
  resolved: "Marked as done.",
  published: "All required tests passed and the new version is live.",
  tests_ran: "Tests finished. See the results below.",
  went_live: "Your agent is live.",
  imported: "We read your website. Choose what to add below.",
  applied: "Added to your facts as a draft. Publish to make it live.",
  widget_saved: "Website chat saved.",
  calendar_connected: "Google Calendar connected.",
  calendar_disconnected: "Calendar disconnected.",
  restored: "Restored. The agent uses that version again.",
  paused: "Paused.",
  resumed: "Switched back on.",
  taught: "Thanks. The agent will use this answer from now on.",
  test_added: "Test added.",
  invited: "Invitation created.",
  docs_added: "Added. The agent can use it straight away.",
  doc_removed: "Document removed. The agent no longer uses it.",
  access_saved: "Access saved.",
  connection_ok: "Connected and checked: the account is read-only.",
  connection_saved: "Connection saved.",
  connection_on: "Connection switched on. Check it again before the agent uses it.",
  connection_off: "Connection switched off. The agent no longer uses it.",
  connection_removed: "Connection and its lookups removed.",
  lookup_saved: "Lookup approved. The agent can use it now.",
  lookup_removed: "Lookup removed.",
  microsoft_connected: "Signed in with Microsoft (read only). Now choose a document library.",
};
