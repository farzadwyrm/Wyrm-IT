import type { ActiveSwitch, Budget, Channel, RiskTier } from "./types";

/** Routing thresholds (starting points from the research; tune with real data). */
export const ROUTE_AT = 0.75;
export const ASK_AT = 0.5;
export const MAX_CLARIFICATIONS = 2;

// ---------------------------------------------------------------------------------------------
// Budget: the daily cap is 1/20 of the monthly budget. At 80% of it only code and free models
// run; at 100% (daily or monthly) no model runs at all.

export type BudgetLevel = "normal" | "saver" | "stopped";
export const SAVER_AT = 0.8;

export function dailyCapMicros(budget: Budget) {
  return Math.floor(budget.monthlyMicros / 20);
}

export function budgetLevel(budget: Budget): BudgetLevel {
  if (budget.monthlyMicros <= 0) return "stopped";
  if (budget.spentMonthMicros >= budget.monthlyMicros) return "stopped";
  const cap = dailyCapMicros(budget);
  if (budget.spentTodayMicros >= cap) return "stopped";
  if (budget.spentTodayMicros >= cap * SAVER_AT) return "saver";
  return "normal";
}

// ---------------------------------------------------------------------------------------------
// Off switches. Any active switch at a matching scope blocks the work.

export function blockedBy(
  switches: readonly ActiveSwitch[],
  target: { agentId?: string | null; tool?: string | null; provider?: string | null },
): ActiveSwitch | null {
  return (
    switches.find(
      (s) =>
        s.scope === "global" ||
        s.scope === "tenant" ||
        (s.scope === "agent" && target.agentId != null && s.agentId === target.agentId) ||
        (s.scope === "tool" && target.tool != null && s.target === target.tool) ||
        (s.scope === "provider" && target.provider != null && s.target === target.provider),
    ) ?? null
  );
}

// ---------------------------------------------------------------------------------------------
// Tools and risk tiers.
//   T0 inform/read: runs.  T1 book/reschedule/confirm/draft: needs the customer's explicit yes.
//   T2 cancel/send quote or invoice/discount/edit: needs a staff approval for this exact action.
//   T3 refunds/payments/mass messages/deletions/settings: never automatic (not built yet).

export interface ApprovalFacts {
  status: "pending" | "approved" | "rejected" | "expired" | "executed";
  expiresAt: Date;
  payloadHash: string;
  id: string;
}

export type ToolVerdict =
  | { verdict: "allow"; reason: string; approvalId?: string }
  | { verdict: "confirm"; reason: string }
  | { verdict: "hold"; reason: string }
  | { verdict: "deny"; reason: string; approvalId?: string };

export function authorizeTool(input: {
  tier: RiskTier;
  /** The customer said yes to exactly this action, in this conversation, through the channel. */
  customerConfirmed: boolean;
  /** sha256 of the exact action payload; an approval only covers the same payload. */
  payloadHash: string;
  approval?: ApprovalFacts | null;
  now: Date;
}): ToolVerdict {
  const { tier, approval, now } = input;
  if (tier === 0) return { verdict: "allow", reason: "tier0_read_only" };
  if (tier === 1) {
    return input.customerConfirmed
      ? { verdict: "allow", reason: "tier1_customer_confirmed" }
      : { verdict: "confirm", reason: "tier1_needs_customer_yes" };
  }
  if (tier === 3) return { verdict: "deny", reason: "tier3_never_automatic" };
  // Tier 2: only a server-side approval of this exact payload, approved and unexpired.
  if (!approval) return { verdict: "hold", reason: "tier2_needs_approval" };
  if (approval.payloadHash !== input.payloadHash)
    return { verdict: "deny", reason: "approval_payload_mismatch", approvalId: approval.id };
  if (approval.status === "pending") return { verdict: "hold", reason: "approval_pending" };
  if (approval.status !== "approved")
    return { verdict: "deny", reason: `approval_${approval.status}`, approvalId: approval.id };
  if (approval.expiresAt <= now)
    return { verdict: "deny", reason: "approval_expired", approvalId: approval.id };
  return { verdict: "allow", reason: "tier2_approved", approvalId: approval.id };
}

// ---------------------------------------------------------------------------------------------
// Circuit breaker: an agent stops sending when errors exceed 20% over at least 50 events, or
// outbound volume reaches 3x its usual level.

export function breakerTrips(stats: {
  events: number;
  errors: number;
  outbound: number;
  usualOutbound: number;
}): string | null {
  if (stats.events >= 50 && stats.errors / stats.events > 0.2) return "error_spike";
  if (stats.usualOutbound > 0 && stats.outbound >= stats.usualOutbound * 3) return "volume_spike";
  return null;
}

// ---------------------------------------------------------------------------------------------
// AI disclosure at first contact (EU AI Act art. 50): every channel, voice included.

export function disclosure(channel: Channel, businessName: string): string {
  const who = `${businessName}'s AI assistant`;
  return channel === "voice"
    ? `Hello, you're speaking with ${who}. I'm an AI, and I can pass you to a person at any time.`
    : `Hi, I'm ${who}. I'm an AI, and you can ask for a person at any time.`;
}
