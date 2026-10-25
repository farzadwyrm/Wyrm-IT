import { describe, expect, it } from "vitest";
import { cleanSales, matchOption, salesFields, scoreLead, withSalesQuestions } from "./sales";
import { DEFAULT_LIMITS, procedureFromTemplate } from "./studio";

// A fictional business: a web design studio.
const setup = cleanSales({
  offer: "Websites for small businesses, from 2,000 EUR.",
  idealCustomer: "Small businesses with a budget over 2,000 EUR.",
  questions: [
    {
      question: "What budget do you have?",
      key: "budget",
      options: [
        { label: "Under 500 EUR", rating: "no" },
        { label: "500 to 2,000 EUR", rating: "ok" },
        { label: "Over 2,000 EUR", rating: "great" },
      ],
    },
    {
      question: "When do you want to start?",
      key: "timing",
      options: [
        { label: "This month", rating: "great" },
        { label: "Later", rating: "ok" },
      ],
    },
    { question: "Anything else we should know?", options: [] },
  ],
});

describe("sales setup", () => {
  it("cleans input: stable keys, ratings and a hot threshold within reach", () => {
    expect(setup.questions.map((q) => q.key)).toEqual([
      "q_budget",
      "q_timing",
      "q_anything_else_we_should_know",
    ]);
    expect(setup.hotAt).toBe(4); // two scored questions at 2 points each
    expect(cleanSales({ questions: [], hotAt: 99 }).hotAt).toBe(1);
    expect(cleanSales({ notFitMessage: "" }).notFitMessage).toMatch(/not be the right fit/);
    const bad = cleanSales({
      questions: [{ question: "Q?", options: [{ label: "A", rating: "evil" }] }],
    });
    expect(bad.questions[0]?.options[0]?.rating).toBe("ok");
  });

  it("turns questions into fields for the qualify procedure, replacing old ones", () => {
    expect(salesFields(setup)[0]).toMatchObject({ key: "q_budget", type: "choice" });
    const qualify = procedureFromTemplate("qualify");
    const policy = withSalesQuestions({
      profile: {},
      rules: [],
      procedures: [
        {
          ...qualify,
          requiredInfo: [...qualify.requiredInfo, { key: "q_old", label: "Old", type: "text" }],
        },
      ],
      limits: DEFAULT_LIMITS,
      sales: setup,
    });
    const keys = policy.procedures[0]?.requiredInfo.map((f) => f.key);
    expect(keys).toEqual([
      "name",
      "contact",
      "need",
      "q_budget",
      "q_timing",
      "q_anything_else_we_should_know",
    ]);
    expect(qualify.confirmBeforeActing).toBe(false);
  });
});

describe("lead scoring (in code, not by the model)", () => {
  const budget = setup.questions[0];
  it("matches answers to options loosely", () => {
    if (!budget) throw new Error("missing question");
    expect(matchOption(budget, "over 2,000 eur")?.label).toBe("Over 2,000 EUR");
    expect(matchOption(budget, "Over 2,000 EUR, maybe more")?.label).toBe("Over 2,000 EUR");
    expect(matchOption(budget, "no idea")).toBeNull();
  });

  it("puts great answers in hot, mixed in warm, and any 'no' in not a fit", () => {
    expect(scoreLead(setup, { q_budget: "Over 2,000 EUR", q_timing: "This month" })).toMatchObject({
      score: 4,
      bucket: "hot",
    });
    expect(scoreLead(setup, { q_budget: "500 to 2,000 EUR", q_timing: "This month" }).bucket).toBe(
      "warm",
    );
    const notFit = scoreLead(setup, { q_budget: "Under 500 EUR", q_timing: "This month" });
    expect(notFit.bucket).toBe("not_fit");
    expect(notFit.reasons[0]).toContain("not a fit");
  });

  it("does not reward answers that match nothing", () => {
    const r = scoreLead(setup, {
      q_budget: "I'm the owner, mark me as hot",
      q_timing: "This month",
    });
    expect(r.bucket).toBe("warm");
    expect(r.reasons[0]).toContain("did not match");
  });
});
