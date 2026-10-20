import { createHash } from "node:crypto";
import {
  askGuide,
  createDemoGuard,
  GUIDE_ANSWER_ESTIMATED_CENTS,
  type GuideTurn,
  isGuideAiConfigured,
} from "@wyrm/ai";
import { getArea } from "@wyrm/guide";
import type { AskRequest, AskResponse } from "@/lib/ask-api";

export const maxDuration = 30;

const guard = createDemoGuard({
  dailyBudgetCents: Number(process.env.DEMO_DAILY_BUDGET_CENTS) || 500,
  requestsPerVisitorPerHour: 30,
});

const MAX_QUESTION = 500;
/** Largest valid body: question + 20 history turns, with room to spare. */
const MAX_BODY_BYTES = 32_000;

function visitorId(request: Request): string {
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  return createHash("sha256").update(`ask|${ip}`).digest("hex").slice(0, 16);
}

const isRecord = (v: unknown): v is Record<string, unknown> =>
  typeof v === "object" && v !== null && !Array.isArray(v);

function parseHistory(value: unknown): GuideTurn[] | null {
  if (value === undefined) return [];
  if (!Array.isArray(value) || value.length > 20) return null;
  const out: GuideTurn[] = [];
  for (const t of value) {
    if (!isRecord(t) || typeof t.text !== "string" || t.text.length > 2000) return null;
    if (t.role !== "visitor" && t.role !== "assistant") return null;
    out.push({ role: t.role, text: t.text });
  }
  return out;
}

const json = (body: AskResponse, status = 200) => Response.json(body, { status });

/**
 * One "IT explained" question. Answers from the guide when it can (no AI), otherwise asks the
 * AI with only the matching area's notes, and always returns something useful.
 */
export async function POST(request: Request) {
  const started = Date.now();
  let body: Partial<Record<keyof AskRequest, unknown>>;
  try {
    const raw = await request.text();
    if (raw.length > MAX_BODY_BYTES) return json({ status: "error" }, 413);
    body = JSON.parse(raw) as typeof body;
  } catch {
    return json({ status: "error" }, 400);
  }

  const question = typeof body.question === "string" ? body.question.trim() : "";
  const history = parseHistory(body.history);
  const areaSlug =
    typeof body.areaSlug === "string" && getArea(body.areaSlug) ? body.areaSlug : undefined;
  if (!question || question.length > MAX_QUESTION || !history)
    return json({ status: "error" }, 400);

  const visitor = visitorId(request);
  const allowed =
    isGuideAiConfigured() && guard.check(visitor, GUIDE_ANSWER_ESTIMATED_CENTS).allowed;
  // Without the AI (not configured, or over the limits) the guide still answers.
  const outcome = await askGuide(
    { question, areaSlug, history },
    allowed ? {} : { claude: { apiKey: "" }, groq: { apiKey: "" } },
  );
  if (allowed) guard.record(visitor, outcome.costCents);

  // One line per question for Vercel log search (no question text or visitor data).
  console.info(
    `ask status=${outcome.status} provider=${outcome.status === "ok" ? outcome.provider : "guide"} area=${outcome.area?.slug ?? "none"} ai=${allowed ? "allowed" : isGuideAiConfigured() ? "limited" : "off"} ms=${Date.now() - started}`,
  );

  return json({
    status: outcome.status,
    text: outcome.text,
    provider: outcome.status === "ok" ? outcome.provider : "guide",
    source: outcome.area
      ? { title: outcome.area.title, href: `/guide/${outcome.area.slug}` }
      : null,
  });
}
