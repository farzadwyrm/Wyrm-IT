import { createHash } from "node:crypto";
import {
  createDemoGuard,
  EXTRACT_ESTIMATED_CENTS,
  extractSteps,
  isAnalyserAiConfigured,
} from "@wyrm/ai";
import type { StepsRequest, StepsResponse } from "@/lib/analyse-api";

export const maxDuration = 30;

const guard = createDemoGuard({
  dailyBudgetCents: Number(process.env.DEMO_DAILY_BUDGET_CENTS) || 500,
  requestsPerVisitorPerHour: 20,
});

const MAX_BODY_BYTES = 8_000;
const MAX_WALKTHROUGH = 3_000;

function visitorId(request: Request): string {
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  return createHash("sha256").update(`analyse|${ip}`).digest("hex").slice(0, 16);
}

const json = (body: StepsResponse, status = 200) => Response.json(body, { status });
const field = (v: unknown, max: number) => (typeof v === "string" ? v.trim().slice(0, max) : "");

/**
 * Drafts process steps from the owner's walk-through (AI if available, keyword rules
 * otherwise). Scoring happens in the browser with `@wyrm/agents`; nothing is stored here.
 */
export async function POST(request: Request) {
  const started = Date.now();
  let body: Partial<Record<keyof StepsRequest, unknown>>;
  try {
    const raw = await request.text();
    if (raw.length > MAX_BODY_BYTES) return json({ status: "error" }, 413);
    body = JSON.parse(raw) as typeof body;
  } catch {
    return json({ status: "error" }, 400);
  }
  const walkthrough = field(body.walkthrough, MAX_WALKTHROUGH);
  if (walkthrough.split(/\s+/).length < 4) return json({ status: "error" }, 400);

  const visitor = visitorId(request);
  const configured = isAnalyserAiConfigured();
  const allowed = configured && guard.check(visitor, EXTRACT_ESTIMATED_CENTS).allowed;
  const outcome = await extractSteps(
    { walkthrough, outcome: field(body.outcome, 300), trigger: field(body.trigger, 60) },
    allowed ? {} : { claude: { apiKey: "" }, groq: { apiKey: "" } },
  );
  if (allowed) guard.record(visitor, outcome.costCents);

  // One line per request for Vercel log search (no walk-through text or visitor data).
  console.info(
    `analyse status=ok provider=${outcome.provider} steps=${outcome.steps.length} ai=${allowed ? "allowed" : configured ? "limited" : "off"} ms=${Date.now() - started}`,
  );
  if (outcome.steps.length === 0) return json({ status: "error" }, 422);
  return json({ status: "ok", steps: outcome.steps, provider: outcome.provider });
}
