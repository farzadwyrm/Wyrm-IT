import { createHash } from "node:crypto";
import { createDemoGuard, REPORT_ESTIMATED_CENTS, writeReadinessReport } from "@wyrm/ai";
import { parseAnswers, QUESTIONS, scoreAssessment } from "@wyrm/assessment";
import type { ReportResponse } from "@/lib/scan";

// The model call can take a while; give it room on Vercel.
export const maxDuration = 60;

/** Fewer answers than this would give the AI nothing meaningful to summarise. */
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

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return json({ status: "unavailable", reason: "error" }, 400);
  }

  // Never trust the browser's score: re-validate the answers and score on the server.
  const answers = parseAnswers(QUESTIONS, (body as { answers?: unknown } | null)?.answers);
  if (Object.keys(answers).length < MIN_ANSWERS) {
    return json({ status: "unavailable", reason: "too_few_answers" }, 400);
  }
  const result = scoreAssessment(QUESTIONS, answers);

  const visitor = visitorId(request);
  const decision = guard.check(visitor, REPORT_ESTIMATED_CENTS);
  if (!decision.allowed) {
    return json({ status: "unavailable", reason: decision.reason }, 429);
  }

  const outcome = await writeReadinessReport(result);
  if (outcome.status === "unavailable" && outcome.reason === "not_configured") {
    return json({ status: "unavailable", reason: "not_configured" }, 503);
  }
  guard.record(visitor, outcome.costCents);

  return outcome.status === "ok"
    ? json({ status: "ok", text: outcome.text })
    : json({ status: "unavailable", reason: outcome.reason }, 502);
}
