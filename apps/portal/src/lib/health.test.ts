import type { CustomerHealth } from "@wyrm/core";
import { describe, expect, it } from "vitest";
import { clientHealth } from "./health";

const row = (over: Partial<CustomerHealth> = {}): CustomerHealth => ({
  tenantId: "00000000-0000-4000-8000-000000000001",
  name: "Fictional Dental",
  slug: "fictional-dental",
  plan: "starter",
  status: "active",
  agents: 1,
  liveAgents: 1,
  signedOff: 1,
  conversations7d: 12,
  handedOff7d: 1,
  waiting: 0,
  pendingApprovals: 0,
  spendMonthMicros: 1_000_000,
  budgetMicros: 20_000_000,
  lastConversationAt: new Date(),
  calendarErrors: 0,
  stopped: 0,
  ...over,
});

describe("clientHealth", () => {
  it("is healthy when live, busy and nothing waiting", () => {
    expect(clientHealth(row())).toEqual({ tone: "good", label: "Healthy", issues: [] });
  });

  it("puts broken things first", () => {
    const h = clientHealth(row({ calendarErrors: 1, waiting: 2 }));
    expect(h.tone).toBe("bad");
    expect(h.issues).toEqual(["Google Calendar disconnected", "2 waiting for the client"]);
  });

  it("flags work for someone without calling it broken", () => {
    expect(clientHealth(row({ pendingApprovals: 1 })).tone).toBe("warn");
    expect(clientHealth(row({ conversations7d: 0 })).issues).toEqual([
      "Live but no conversations this week",
    ]);
    expect(clientHealth(row({ spendMonthMicros: 17_000_000 })).issues).toEqual([
      "AI spend above 80% of budget",
    ]);
  });

  it("shows setup and suspension plainly", () => {
    expect(clientHealth(row({ liveAgents: 0, signedOff: 1 })).label).toBe("Setting up");
    expect(clientHealth(row({ liveAgents: 0, signedOff: 0 })).issues).toEqual([
      "Agent waiting for setup or sign-off",
    ]);
    expect(clientHealth(row({ status: "suspended", stopped: 1 })).label).toBe("Suspended");
    expect(clientHealth(row({ budgetMicros: 1, spendMonthMicros: 2 })).issues).toEqual([
      "AI budget used up",
    ]);
  });
});
