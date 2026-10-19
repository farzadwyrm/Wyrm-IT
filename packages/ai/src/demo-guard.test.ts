import { describe, expect, it } from "vitest";
import { createDemoGuard } from "./demo-guard";

const clock = (iso: string) => {
  let t = new Date(iso).getTime();
  return {
    now: () => new Date(t),
    advance: (ms: number) => {
      t += ms;
    },
  };
};

describe("createDemoGuard", () => {
  it("blocks a request that would exceed the daily budget", () => {
    const c = clock("2026-10-19T10:00:00Z");
    const guard = createDemoGuard({
      dailyBudgetCents: 10,
      requestsPerVisitorPerHour: 100,
      now: c.now,
    });
    guard.record("v1", 8);
    expect(guard.check("v2", 3)).toEqual({ allowed: false, reason: "daily_budget_exhausted" });
    expect(guard.check("v2", 2)).toEqual({ allowed: true });
  });

  it("resets the budget on a new UTC day", () => {
    const c = clock("2026-10-19T23:59:00Z");
    const guard = createDemoGuard({
      dailyBudgetCents: 10,
      requestsPerVisitorPerHour: 100,
      now: c.now,
    });
    guard.record("v1", 10);
    expect(guard.check("v1", 1).allowed).toBe(false);
    c.advance(2 * 60 * 1000);
    expect(guard.check("v1", 1).allowed).toBe(true);
  });

  it("rate-limits a single visitor per rolling hour without affecting others", () => {
    const c = clock("2026-10-19T10:00:00Z");
    const guard = createDemoGuard({
      dailyBudgetCents: 1000,
      requestsPerVisitorPerHour: 2,
      now: c.now,
    });
    guard.record("v1", 1);
    guard.record("v1", 1);
    expect(guard.check("v1", 1)).toEqual({ allowed: false, reason: "visitor_rate_limited" });
    expect(guard.check("v2", 1)).toEqual({ allowed: true });
    c.advance(60 * 60 * 1000 + 1);
    expect(guard.check("v1", 1)).toEqual({ allowed: true });
  });

  it("ignores negative recorded costs", () => {
    const c = clock("2026-10-19T10:00:00Z");
    const guard = createDemoGuard({
      dailyBudgetCents: 5,
      requestsPerVisitorPerHour: 100,
      now: c.now,
    });
    guard.record("v1", -100);
    expect(guard.check("v1", 6).allowed).toBe(false);
  });
});
