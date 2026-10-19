import { describe, expect, it } from "vitest";
import { PILLAR_INFO, readinessBand } from "./pillars";
import { QUESTIONS } from "./questions";
import { parseAnswers } from "./score";
import { PILLARS } from "./types";

describe("readinessBand", () => {
  it.each([
    [0, "Foundations first"],
    [44, "Foundations first"],
    [45, "Nearly ready"],
    [74, "Nearly ready"],
    [75, "Ready to pilot AI"],
    [100, "Ready to pilot AI"],
  ])("score %i -> %s", (score, label) => {
    expect(readinessBand(score).label).toBe(label);
  });
});

describe("PILLAR_INFO", () => {
  it("has a label for every pillar", () => {
    for (const pillar of PILLARS) expect(PILLAR_INFO[pillar].label.length).toBeGreaterThan(0);
  });
});

describe("question bank size", () => {
  it("stays between 20 and 30 questions, with at least 2 per area", () => {
    expect(QUESTIONS.length).toBeGreaterThanOrEqual(20);
    expect(QUESTIONS.length).toBeLessThanOrEqual(30);
    for (const pillar of PILLARS) {
      expect(QUESTIONS.filter((q) => q.pillar === pillar).length).toBeGreaterThanOrEqual(2);
    }
  });
});

describe("parseAnswers", () => {
  const [first, second] = QUESTIONS;

  it("keeps only known ids with valid values", () => {
    const parsed = parseAnswers(QUESTIONS, {
      [first?.id ?? ""]: "gap",
      [second?.id ?? ""]: "definitely",
      "made.up": "in_place",
    });
    expect(parsed).toEqual({ [first?.id ?? ""]: "gap" });
  });

  it.each([null, "text", 42, ["gap"]])("returns no answers for %j", (input) => {
    expect(parseAnswers(QUESTIONS, input)).toEqual({});
  });
});
