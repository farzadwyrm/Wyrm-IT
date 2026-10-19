import { describe, expect, it } from "vitest";
import { QUESTIONS } from "./questions";
import { scoreAssessment } from "./score";
import { PILLARS, type Question } from "./types";

const q = (id: string, overrides: Partial<Question> = {}): Question => ({
  id,
  pillar: "identity",
  phase: 2,
  weight: 1,
  prompt: `Prompt ${id}`,
  whyItMatters: `Why ${id}`,
  ...overrides,
});

describe("scoreAssessment", () => {
  it("returns null scores when nothing is answered", () => {
    const result = scoreAssessment([q("a")], {});
    expect(result.overall).toBeNull();
    expect(result.findings).toEqual([]);
  });

  it("weights answers and gives half credit for partial", () => {
    const questions = [q("a", { weight: 3 }), q("b", { weight: 1 })];
    const result = scoreAssessment(questions, { a: "in_place", b: "partial" });
    // (3*1 + 1*0.5) / 4 = 87.5 -> 88
    expect(result.overall).toBe(88);
  });

  it("excludes not_applicable answers from the denominator", () => {
    const questions = [q("a"), q("b")];
    const result = scoreAssessment(questions, { a: "in_place", b: "not_applicable" });
    expect(result.overall).toBe(100);
  });

  it("reports every pillar, with null for pillars without answers", () => {
    const result = scoreAssessment([q("a", { pillar: "data" })], { a: "gap" });
    expect(result.pillars.map((p) => p.pillar)).toEqual([...PILLARS]);
    expect(result.pillars.find((p) => p.pillar === "data")?.percent).toBe(0);
    expect(result.pillars.find((p) => p.pillar === "network")?.percent).toBeNull();
  });

  it("orders findings by phase, then gaps before partials, then weight", () => {
    const questions = [
      q("late-gap", { phase: 3 }),
      q("early-partial", { phase: 1, weight: 3 }),
      q("early-gap-light", { phase: 1, weight: 1 }),
      q("early-gap-heavy", { phase: 1, weight: 3 }),
    ];
    const result = scoreAssessment(questions, {
      "late-gap": "gap",
      "early-partial": "partial",
      "early-gap-light": "gap",
      "early-gap-heavy": "gap",
    });
    expect(result.findings.map((f) => f.questionId)).toEqual([
      "early-gap-heavy",
      "early-gap-light",
      "early-partial",
      "late-gap",
    ]);
  });
});

describe("QUESTIONS bank", () => {
  it("has unique, stable ids", () => {
    const ids = QUESTIONS.map((x) => x.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("covers every pillar at least once", () => {
    for (const pillar of PILLARS) {
      expect(QUESTIONS.some((x) => x.pillar === pillar)).toBe(true);
    }
  });
});
