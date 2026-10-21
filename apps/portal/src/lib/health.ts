import type { CustomerHealth } from "@wyrm/core";

export type HealthTone = "bad" | "warn" | "plain" | "good";

export interface ClientHealth {
  tone: HealthTone;
  label: string;
  /** Every problem found, most serious first (empty when healthy). */
  issues: string[];
}

/**
 * Wyrm's view of one client, from the back-office row. Red: something is broken for their
 * customers. Amber: someone has to act (them or us). Grey: not live yet. Green: running fine.
 */
export function clientHealth(row: CustomerHealth): ClientHealth {
  if (row.status !== "active") return { tone: "plain", label: "Suspended", issues: [] };
  const bad: string[] = [];
  const warn: string[] = [];
  if (row.stopped > 0) bad.push(`${row.stopped} off switch${row.stopped === 1 ? "" : "es"} on`);
  if (row.calendarErrors > 0) bad.push("Google Calendar disconnected");
  if (row.budgetMicros > 0 && row.spendMonthMicros >= row.budgetMicros)
    bad.push("AI budget used up");
  const waiting = row.waiting + row.pendingApprovals;
  if (waiting > 0) warn.push(`${waiting} waiting for the client`);
  if (row.agents > row.liveAgents && row.signedOff < row.agents)
    warn.push("Agent waiting for setup or sign-off");
  if (row.budgetMicros > 0 && row.spendMonthMicros >= row.budgetMicros * 0.8 && !bad.length)
    warn.push("AI spend above 80% of budget");
  if (row.liveAgents > 0 && row.conversations7d === 0)
    warn.push("Live but no conversations this week");
  if (bad.length) return { tone: "bad", label: "Needs help", issues: [...bad, ...warn] };
  if (warn.length) return { tone: "warn", label: "Check", issues: warn };
  if (row.liveAgents === 0) return { tone: "plain", label: "Setting up", issues: [] };
  return { tone: "good", label: "Healthy", issues: [] };
}
