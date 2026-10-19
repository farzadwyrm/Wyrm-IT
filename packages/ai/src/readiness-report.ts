import Anthropic from "@anthropic-ai/sdk";
import { type AssessmentResult, PILLAR_INFO, readinessBand } from "@wyrm/assessment";
import { costInCents, MODELS } from "./models";

/** Upper bound used for the demo budget check before the call is made. */
export const REPORT_ESTIMATED_CENTS = 6;

const MAX_FINDINGS_IN_PROMPT = 8;

export const REPORT_SYSTEM_PROMPT = `You write short readiness summaries for Wyrm IT, a company that helps small and medium businesses adopt AI safely.

The reader is a business owner or office manager, not an IT specialist. They just answered a self-assessment about their IT foundations. You receive their scores and the gaps they reported.

Write three short paragraphs of plain text, 150 to 220 words in total:
1. The overall picture in one or two sentences, mentioning their strongest and weakest areas by name.
2. The three most important things to fix first, in priority order, each with a one-line reason tied to their business risk.
3. One realistic first AI use case they could pilot once those fixes are done, and why it fits.

Rules:
- Base everything only on the data provided. Do not invent facts about their business, sector or size.
- These are self-reported answers; say "based on your answers" once, not repeatedly.
- No prices, no guarantees, no legal advice, no product or vendor names.
- Use plain words. No markdown, no bullet characters, no headings.
- Be direct and encouraging, never alarmist.`;

/** Builds the user message from scores only. Contains no personal data. */
export function buildReportPrompt(result: AssessmentResult): string {
  const pillars = result.pillars
    .map((p) => {
      const label = PILLAR_INFO[p.pillar].label;
      return `- ${label}: ${p.percent === null ? "not answered" : `${p.percent}%`}`;
    })
    .join("\n");

  const findings = result.findings
    .slice(0, MAX_FINDINGS_IN_PROMPT)
    .map(
      (f, i) =>
        `${i + 1}. [${f.answer === "gap" ? "missing" : "partly in place"}, priority phase ${f.phase}] ${f.prompt} (Why it matters: ${f.whyItMatters})`,
    )
    .join("\n");

  const band = result.overall === null ? null : readinessBand(result.overall);

  return [
    `Overall score: ${result.overall === null ? "not enough answers" : `${result.overall}%`}${band ? ` (${band.label})` : ""}`,
    "",
    "Scores by area:",
    pillars,
    "",
    findings ? `Reported gaps, most urgent first:\n${findings}` : "Reported gaps: none.",
  ].join("\n");
}

export type ReportOutcome =
  | { status: "ok"; text: string; costCents: number }
  | {
      status: "unavailable";
      reason: "not_configured" | "refused" | "error" | "empty";
      costCents: number;
    };

/**
 * Asks Claude for a short written summary. Never throws: any failure becomes
 * `unavailable` so the page can still show the deterministic results.
 */
export async function writeReadinessReport(
  result: AssessmentResult,
  options: { client?: Anthropic; apiKey?: string | undefined } = {},
): Promise<ReportOutcome> {
  const apiKey = options.apiKey ?? process.env.ANTHROPIC_API_KEY;
  if (!options.client && !apiKey) {
    return { status: "unavailable", reason: "not_configured", costCents: 0 };
  }
  const client = options.client ?? new Anthropic({ apiKey, maxRetries: 1, timeout: 45_000 });
  const model = MODELS.readinessReport;

  try {
    const response = await client.beta.messages.create({
      model,
      max_tokens: 4000,
      output_config: { effort: "low" },
      // If Opus declines for policy reasons, Anthropic retries on its recommended fallback.
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      system: REPORT_SYSTEM_PROMPT,
      messages: [{ role: "user", content: buildReportPrompt(result) }],
    });

    const costCents = costInCents(
      response.model,
      response.usage.input_tokens,
      response.usage.output_tokens,
    );

    if (response.stop_reason === "refusal") {
      return { status: "unavailable", reason: "refused", costCents };
    }

    const text = response.content
      .flatMap((block) => (block.type === "text" ? [block.text] : []))
      .join("\n")
      .trim();

    return text
      ? { status: "ok", text, costCents }
      : { status: "unavailable", reason: "empty", costCents };
  } catch (error) {
    if (error instanceof Anthropic.APIError) {
      console.error(`readiness report failed: API ${error.status}`, error.message);
    } else {
      console.error("readiness report failed", error);
    }
    return { status: "unavailable", reason: "error", costCents: 0 };
  }
}
