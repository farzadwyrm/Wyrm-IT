import { createHash } from "node:crypto";
import { createDemoGuard, REPORT_ESTIMATED_CENTS, writeReadinessReport } from "@wyrm/ai";
import { parseAnswers, QUESTIONS, scoreAssessment, writeBasicSummary } from "@wyrm/assessment";
import type { ReportResponse } from "@/lib/scan";

// The model call can take a while; give it room on Vercel.
export const maxDuration = 60;

/** Fewer answers than this would give nothing meaningful to summarise. */
const MIN_ANSWERS = 12;

const guard = createDemoGuard({
  dailyBudgetCents: Number(process.env.DEMO_DAILY_BUDGET_CENTS) || 500,
  requestsPerVisitorPerHour: 3,
});

/** A one-way hash of the caller's IP: enough to rate-limit, never stored or logged. */
function visitorId(request: Request): string {
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  return createHash("sha256").update(ip).digest("hex").slice(0, 16);
}

const json = (body: ReportResponse, status = 200) => Response.json(body, { status });

/**
 * Writes the scan summary. Uses Claude when ANTHROPIC_API_KEY is set and the demo guard
 * allows it; otherwise (or if the AI call fails) returns the free rule-based summary,
 * so visitors always get a useful answer and the AI bill can never run away.
 */
export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return json({ status: "unavailable", reason: "invalid_request" }, 400);
  }

  // Never trust the browser's score: re-validate the answers and score on the server.
  const answers = parseAnswers(QUESTIONS, (body as { answers?: unknown } | null)?.answers);
  if (Object.keys(answers).length < MIN_ANSWERS) {
    return json({ status: "unavailable", reason: "too_few_answers" }, 400);
  }
  const result = scoreAssessment(QUESTIONS, answers);
  const basic = () => json({ status: "ok", text: writeBasicSummary(result), source: "basic" });

  if (!process.env.ANTHROPIC_API_KEY) return basic();

  const visitor = visitorId(request);
  if (!guard.check(visitor, REPORT_ESTIMATED_CENTS).allowed) return basic();

  const outcome = await writeReadinessReport(result);
  guard.record(visitor, outcome.costCents);

  return outcome.status === "ok"
    ? json({ status: "ok", text: outcome.text, source: "ai" })
    : basic();
}
