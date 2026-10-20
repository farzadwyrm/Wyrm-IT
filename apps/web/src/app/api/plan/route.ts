import { createHash } from "node:crypto";
import {
  createDemoGuard,
  isPlannerAiConfigured,
  PLAN_ESTIMATED_CENTS,
  planWorkflow,
} from "@wyrm/ai";
import type { PlanRequest, PlanResponse } from "@/lib/plan-api";

export const maxDuration = 30;

const guard = createDemoGuard({
  dailyBudgetCents: Number(process.env.DEMO_DAILY_BUDGET_CENTS) || 500,
  requestsPerVisitorPerHour: 20,
});

const MIN_TASK = 3;
const MAX_TASK = 600;
const MAX_BODY_BYTES = 4_000;

function visitorId(request: Request): string {
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  return createHash("sha256").update(`plan|${ip}`).digest("hex").slice(0, 16);
}

const json = (body: PlanResponse, status = 200) => Response.json(body, { status });

/**
 * Designs an agent workflow for a visitor's task: a standard workflow when the task clearly
 * matches one (no AI), otherwise the AI, otherwise the closest standard workflow.
 */
export async function POST(request: Request) {
  const started = Date.now();
  let body: Partial<Record<keyof PlanRequest, unknown>>;
  try {
    const raw = await request.text();
    if (raw.length > MAX_BODY_BYTES) return json({ status: "error" }, 413);
    body = JSON.parse(raw) as typeof body;
  } catch {
    return json({ status: "error" }, 400);
  }
  const task = typeof body.task === "string" ? body.task.trim().replace(/\s+/g, " ") : "";
  if (task.length < MIN_TASK || task.length > MAX_TASK) return json({ status: "error" }, 400);

  const visitor = visitorId(request);
  const configured = isPlannerAiConfigured();
  const allowed = configured && guard.check(visitor, PLAN_ESTIMATED_CENTS).allowed;
  // Without the AI (not configured, or over the limits) visitors still get a standard workflow.
  const outcome = await planWorkflow(
    task,
    allowed ? {} : { claude: { apiKey: "" }, groq: { apiKey: "" } },
  );
  if (allowed) guard.record(visitor, outcome.costCents);

  const provider =
    outcome.status === "ok" ? outcome.provider : outcome.status === "fallback" ? "guide" : "none";
  // One line per request for Vercel log search (no task text or visitor data).
  console.info(
    `plan status=${outcome.status} provider=${provider} ai=${allowed ? "allowed" : configured ? "limited" : "off"} ms=${Date.now() - started}`,
  );

  if (outcome.status === "off_topic") return json({ status: "off_topic" });
  const workflow = outcome.workflow;
  if (!workflow) return json({ status: "unavailable" });
  return json({
    status: "ok",
    workflow,
    provider: outcome.status === "ok" ? outcome.provider : "guide",
    agent: outcome.agent
      ? { name: outcome.agent.name, href: `/agents/${outcome.agent.slug}` }
      : null,
  });
}
