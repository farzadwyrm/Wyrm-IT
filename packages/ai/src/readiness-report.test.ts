import type Anthropic from "@anthropic-ai/sdk";
import { type Answers, QUESTIONS, scoreAssessment } from "@wyrm/assessment";
import { describe, expect, it, vi } from "vitest";
import { costInCents } from "./models";
import { buildReportPrompt, writeReadinessReport } from "./readiness-report";

const allGaps: Answers = Object.fromEntries(QUESTIONS.map((q) => [q.id, "gap"]));
const result = scoreAssessment(QUESTIONS, allGaps);

/** Minimal stand-in for the SDK client: only the call the report makes. */
function fakeClient(create: (...args: unknown[]) => Promise<unknown>) {
  return { messages: { create: vi.fn(create) } } as unknown as Anthropic;
}

describe("buildReportPrompt", () => {
  it("includes the score, every area and at most 8 findings", () => {
    const prompt = buildReportPrompt(result);
    expect(prompt).toContain("Overall score: 0%");
    expect(prompt).toContain("Accounts & access: 0%");
    expect(prompt.match(/^\d+\. \[/gm)?.length).toBe(8);
  });

  it("says when there are no gaps", () => {
    const allGood = scoreAssessment(
      QUESTIONS,
      Object.fromEntries(QUESTIONS.map((q) => [q.id, "in_place"])),
    );
    expect(buildReportPrompt(allGood)).toContain("Reported gaps: none.");
  });
});

describe("costInCents", () => {
  it("prices Opus 5.5 at $4 in / $20 out per million tokens", () => {
    expect(costInCents("claude-opus-5-5", 1_000_000, 0)).toBeCloseTo(400);
    expect(costInCents("claude-opus-5-5", 0, 1_000)).toBeCloseTo(2);
  });
});

describe("writeReadinessReport", () => {
  it("is unavailable without an API key, without calling anything", async () => {
    const outcome = await writeReadinessReport(result, { apiKey: "" });
    expect(outcome).toEqual({ status: "unavailable", reason: "not_configured", costCents: 0 });
  });

  it("returns the text and cost on success", async () => {
    const client = fakeClient(async () => ({
      model: "claude-haiku-5-5",
      stop_reason: "end_turn",
      usage: { input_tokens: 1000, output_tokens: 500 },
      content: [
        { type: "thinking", thinking: "" },
        { type: "text", text: "  Based on your answers...  " },
      ],
    }));
    const outcome = await writeReadinessReport(result, { client });
    expect(outcome).toMatchObject({ status: "ok", text: "Based on your answers..." });
    // Haiku 5.5: 1000 x $0.10/M + 500 x $0.50/M = $0.00035
    expect(outcome.costCents).toBeCloseTo(0.035);
  });

  it("treats a refusal as unavailable but still counts its cost", async () => {
    const client = fakeClient(async () => ({
      model: "claude-haiku-5-5",
      stop_reason: "refusal",
      usage: { input_tokens: 1000, output_tokens: 0 },
      content: [],
    }));
    const outcome = await writeReadinessReport(result, { client });
    expect(outcome).toMatchObject({ status: "unavailable", reason: "refused" });
    expect(outcome.costCents).toBeGreaterThan(0);
  });

  it("never throws when the API call fails", async () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const client = fakeClient(async () => {
      throw new Error("network down");
    });
    await expect(writeReadinessReport(result, { client })).resolves.toEqual({
      status: "unavailable",
      reason: "error",
      costCents: 0,
    });
    errorSpy.mockRestore();
  });
});
