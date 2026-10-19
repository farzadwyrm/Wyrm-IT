import { describe, expect, it } from "vitest";
import { QUESTIONS } from "./questions";
import { scoreAssessment } from "./score";
import { writeBasicSummary } from "./summary";
import type { Answer } from "./types";

const answerAll = (value: Answer) =>
  scoreAssessment(QUESTIONS, Object.fromEntries(QUESTIONS.map((q) => [q.id, value])));

describe("writeBasicSummary", () => {
  it("writes three paragraphs with score, fixes and an AI idea", () => {
    const text = writeBasicSummary(answerAll("gap"));
    const paragraphs = text.split("\n\n");
    expect(paragraphs).toHaveLength(3);
    expect(paragraphs[0]).toContain("overall score is 0%");
    expect(paragraphs[1]).toMatch(/^Fix these first\. First: .+\? .+ Second: .+\? .+ Third: .+\? /);
    expect(paragraphs[2]).toMatch(/^Once the basics above are fixed/);
    expect(paragraphs[2]).toContain("AI receptionist");
  });

  it("names the strongest and weakest areas when they differ", () => {
    const answers = Object.fromEntries(
      QUESTIONS.map((q): [string, Answer] => [q.id, q.pillar === "data" ? "gap" : "in_place"]),
    );
    const text = writeBasicSummary(scoreAssessment(QUESTIONS, answers));
    expect(text).toContain("needing most attention is data & backups (0%)");
  });

  it("suggests a documents assistant or automation when foundations are strong", () => {
    expect(writeBasicSummary(answerAll("in_place"))).toContain("small automation");
    expect(writeBasicSummary(answerAll("in_place"))).toContain("reported no gaps");
  });

  it("handles a scan where nothing applies", () => {
    expect(writeBasicSummary(answerAll("not_applicable"))).toContain("not enough to score");
  });

  it("is deterministic", () => {
    expect(writeBasicSummary(answerAll("partial"))).toBe(writeBasicSummary(answerAll("partial")));
  });
});
