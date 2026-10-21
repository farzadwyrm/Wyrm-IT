import { describe, expect, it } from "vitest";
import {
  activeRules,
  blockedTopic,
  buildInstructions,
  checkAction,
  DEFAULT_LIMITS,
  findConflicts,
  isOpen,
  missingInfo,
  type Policy,
  policyIntents,
  procedureForIntent,
  procedureFromTemplate,
  type Rule,
} from "./studio";

// Fictional business only.
const rule = (id: string, text: string, scope: Rule["scope"] = {}, priority = 0): Rule => ({
  id,
  text,
  scope,
  priority,
  enabled: true,
});

const policy: Policy = {
  profile: {
    timezone: "UTC",
    hours: { mon: { open: "09:00", close: "17:00" }, sat: { open: "09:00", close: "13:00" } },
    services: [{ name: "Check-up", price: "65 EUR" }],
  },
  rules: [
    rule("r1", "Never discuss insurance claims."),
    rule("r2", "After hours, always offer to take a message.", { when: "closed" }),
    rule("r3", "On the phone, keep answers very short.", { channels: ["voice"] }, 5),
  ],
  procedures: [procedureFromTemplate("book"), procedureFromTemplate("cancel")],
  limits: { ...DEFAULT_LIMITS, blockedTopics: ["insurance"], maxDiscountPercent: 10 },
};

describe("opening hours", () => {
  it("knows open, closed and missing days in the business's time zone", () => {
    expect(isOpen(policy.profile, new Date("2026-10-19T10:00:00Z"))).toBe(true); // Monday
    expect(isOpen(policy.profile, new Date("2026-10-19T18:00:00Z"))).toBe(false);
    expect(isOpen(policy.profile, new Date("2026-10-20T10:00:00Z"))).toBe(false); // Tuesday: closed
    expect(isOpen({}, new Date())).toBe(true); // unknown hours: don't block
  });
});

describe("rules", () => {
  it("apply only in their scope, most specific and highest priority first", () => {
    const phoneOpen = activeRules(policy.rules, { channel: "voice", open: true, returning: false });
    expect(phoneOpen.map((r) => r.id)).toEqual(["r3", "r1"]);
    const chatClosed = activeRules(policy.rules, {
      channel: "web_chat",
      open: false,
      returning: false,
    });
    expect(chatClosed.map((r) => r.id)).toEqual(["r2", "r1"]);
  });

  it("warn about rules that disagree on the same subject", () => {
    const conflicts = findConflicts([
      rule("a", "Always offer a free whitening consultation."),
      rule("b", "Never offer whitening to new patients."),
      rule("c", "Never discuss insurance claims."),
    ]);
    expect(conflicts).toEqual([
      { a: "a", b: "b", reason: 'Both mention "whitening" but disagree.' },
    ]);
  });

  it("ignore rules in separate scopes", () => {
    expect(
      findConflicts([
        rule("a", "Always offer a callback.", { channels: ["voice"] }),
        rule("b", "Never offer a callback.", { channels: ["web_chat"] }),
      ]),
    ).toEqual([]);
  });
});

describe("procedures", () => {
  it("map intents to enabled procedures and list missing info", () => {
    expect(policyIntents(policy)).toEqual(expect.arrayContaining(["booking", "cancel", "prices"]));
    const book = procedureForIntent(policy, "booking");
    if (!book) throw new Error("expected a booking procedure");
    expect(book.template).toBe("book");
    expect(
      missingInfo(book, { name: "Ana Example", service: "Check-up" }).map((f) => f.key),
    ).toEqual(["phone", "date", "time"]);
    expect(procedureForIntent(policy, "quote")).toBeNull();
  });
});

describe("limits are checked in code", () => {
  const now = new Date("2026-10-19T10:00:00Z");
  it("allow bookings only inside the notice and window", () => {
    expect(
      checkAction("book", { date: "2026-10-21", time: "10:00" }, policy.limits, now),
    ).toMatchObject({ ok: true });
    expect(checkAction("book", { date: "2026-10-19", time: "11:00" }, policy.limits, now)).toEqual({
      ok: false,
      reason: "too_soon",
    });
    expect(checkAction("book", { date: "2027-01-30", time: "10:00" }, policy.limits, now)).toEqual({
      ok: false,
      reason: "too_far_ahead",
    });
    expect(checkAction("book", { date: "next tuesday" }, policy.limits, now)).toEqual({
      ok: false,
      reason: "needs_valid_date",
    });
  });

  it("send cancellations and quotes to a person, and cap discounts", () => {
    expect(
      checkAction("cancel", { date: "2026-10-19", time: "18:00" }, policy.limits, now),
    ).toEqual({
      ok: true,
      needsApproval: true,
      reason: "late_cancellation",
    });
    expect(checkAction("quote", {}, policy.limits, now)).toMatchObject({ needsApproval: true });
    expect(checkAction("message", { discount_percent: "25" }, policy.limits, now)).toEqual({
      ok: false,
      reason: "discount_over_limit",
    });
  });

  it("spot blocked topics", () => {
    expect(blockedTopic("Does my INSURANCE cover this?", policy.limits)).toBe("insurance");
    expect(blockedTopic("When are you open?", policy.limits)).toBeNull();
    const claims = { ...policy.limits, blockedTopics: ["insurance claims"] };
    expect(blockedTopic("Does my insurance claim cover a filling?", claims)).toBe(
      "insurance claims",
    );
    expect(blockedTopic("Do you accept insurance?", claims)).toBeNull();
  });
});

describe("instructions", () => {
  it("follow precedence: safety, limits, procedure, rules, facts, voice", () => {
    const text = buildInstructions(policy, {
      businessName: "Bright Smile Dental",
      agentName: "Front desk",
      situation: { channel: "web_chat", open: true, returning: false },
      procedure: policy.procedures[0] ?? null,
      collected: { name: "Ana Example" },
      today: "2026-10-19",
    });
    const order = ["SAFETY", "LIMITS", "PROCEDURE", "RULES", "FACTS", "VOICE"].map((h) =>
      text.indexOf(h),
    );
    expect(order.every((v, i) => v >= 0 && (i === 0 || v > (order[i - 1] ?? 0)))).toBe(true);
    expect(text).toContain("Never offer a discount above 10%");
    expect(text).toContain("Still needed: Phone number");
    expect(text).toContain("Check-up, 65 EUR");
    expect(text).not.toContain("keep answers very short"); // phone-only rule
  });
});
