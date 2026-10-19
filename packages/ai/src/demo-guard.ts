/**
 * Guardrails for public AI demos: a per-visitor request limit and a global daily
 * spend cap. Every demo endpoint must call `check` before calling a model and
 * `record` after, so an abusive visitor can never run up an unbounded bill.
 *
 * This in-memory store is for local development and single-instance hosting.
 * Before launch on serverless hosting, back `DemoGuardStore` with Postgres or Redis.
 */

export interface DemoGuardOptions {
  dailyBudgetCents: number;
  requestsPerVisitorPerHour: number;
  now?: () => Date;
}

export type GuardDecision =
  | { allowed: true }
  | { allowed: false; reason: "daily_budget_exhausted" | "visitor_rate_limited" };

export interface DemoGuard {
  check(visitorId: string, estimatedCents: number): GuardDecision;
  record(visitorId: string, actualCents: number): void;
}

const HOUR_MS = 60 * 60 * 1000;

export function createDemoGuard(options: DemoGuardOptions): DemoGuard {
  const now = options.now ?? (() => new Date());
  let day = "";
  let spentToday = 0;
  const requests = new Map<string, number[]>();

  const rollDay = () => {
    const today = now().toISOString().slice(0, 10);
    if (today !== day) {
      day = today;
      spentToday = 0;
    }
  };

  const recentRequests = (visitorId: string): number[] => {
    const cutoff = now().getTime() - HOUR_MS;
    const recent = (requests.get(visitorId) ?? []).filter((t) => t > cutoff);
    requests.set(visitorId, recent);
    return recent;
  };

  return {
    check(visitorId, estimatedCents) {
      rollDay();
      if (spentToday + estimatedCents > options.dailyBudgetCents) {
        return { allowed: false, reason: "daily_budget_exhausted" };
      }
      if (recentRequests(visitorId).length >= options.requestsPerVisitorPerHour) {
        return { allowed: false, reason: "visitor_rate_limited" };
      }
      return { allowed: true };
    },
    record(visitorId, actualCents) {
      rollDay();
      spentToday += Math.max(0, actualCents);
      recentRequests(visitorId).push(now().getTime());
    },
  };
}
