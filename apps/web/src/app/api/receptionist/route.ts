import { createHash } from "node:crypto";
import {
  type ChatMessage,
  createDemoGuard,
  type Proposal,
  RECEPTIONIST_TURN_ESTIMATED_CENTS,
  runReceptionistTurn,
} from "@wyrm/ai";
import { type Booking, SERVICES } from "@wyrm/receptionist";
import type { ReceptionistRequest, ReceptionistResponse } from "@/lib/receptionist-api";

export const maxDuration = 60;

const guard = createDemoGuard({
  dailyBudgetCents: Number(process.env.DEMO_DAILY_BUDGET_CENTS) || 500,
  // A conversation is ~10 messages; this allows a few full conversations per hour.
  requestsPerVisitorPerHour: 60,
});

const DAY = /^\d{4}-\d{2}-\d{2}$/;
const SERVICE_IDS = new Set(SERVICES.map((s) => s.id));

function visitorId(request: Request): string {
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  return createHash("sha256").update(`receptionist|${ip}`).digest("hex").slice(0, 16);
}

const isRecord = (v: unknown): v is Record<string, unknown> =>
  typeof v === "object" && v !== null && !Array.isArray(v);

function parseHistory(value: unknown): ChatMessage[] | null {
  if (!Array.isArray(value) || value.length === 0 || value.length > 60) return null;
  const out: ChatMessage[] = [];
  for (const m of value) {
    if (!isRecord(m) || typeof m.text !== "string" || m.text.length > 2000) return null;
    if (m.role !== "visitor" && m.role !== "receptionist") return null;
    out.push({ role: m.role, text: m.text });
  }
  return out.at(-1)?.role === "visitor" ? out : null;
}

function parseSlot(
  v: unknown,
): { serviceId: string; day: string; time: number; name: string } | null {
  if (!isRecord(v)) return null;
  const { serviceId, day, time, name } = v;
  if (typeof serviceId !== "string" || !SERVICE_IDS.has(serviceId)) return null;
  if (typeof day !== "string" || !DAY.test(day)) return null;
  if (typeof time !== "number" || !Number.isInteger(time) || time < 0 || time >= 24 * 60)
    return null;
  if (typeof name !== "string" || name.length > 40) return null;
  return { serviceId, day, time, name };
}

function parseBookings(value: unknown): Booking[] | null {
  if (!Array.isArray(value) || value.length > 10) return null;
  const out: Booking[] = [];
  for (const b of value) {
    const slot = parseSlot(b);
    if (!slot || !isRecord(b) || typeof b.reference !== "string" || b.reference.length > 12)
      return null;
    out.push({ ...slot, reference: b.reference });
  }
  return out;
}

function parsePending(value: unknown): Proposal | null | undefined {
  if (value === null) return null;
  const slot = parseSlot(value);
  if (!slot || !isRecord(value) || typeof value.id !== "string" || value.id.length > 60) {
    return undefined;
  }
  return { ...slot, id: value.id };
}

function parseClock(value: unknown): Date | null {
  if (!isRecord(value) || typeof value.day !== "string" || !DAY.test(value.day)) return null;
  const minutes = value.minutes;
  if (typeof minutes !== "number" || minutes < 0 || minutes >= 24 * 60) return null;
  const [y, m, d] = value.day.split("-").map(Number);
  return new Date(
    y ?? 1970,
    (m ?? 1) - 1,
    d ?? 1,
    Math.floor(minutes / 60),
    Math.floor(minutes % 60),
  );
}

const json = (body: ReceptionistResponse, status = 200) => Response.json(body, { status });

/**
 * One AI receptionist turn. Validates everything the browser sends, applies the demo guard,
 * and tells the page to fall back to the basic receptionist whenever the AI is unavailable.
 */
export async function POST(request: Request) {
  let body: Partial<Record<keyof ReceptionistRequest, unknown>>;
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return json({ status: "fallback", reason: "invalid_request" }, 400);
  }

  const history = parseHistory(body.history);
  const bookings = parseBookings(body.bookings ?? []);
  const pending = parsePending(body.pending ?? null);
  const now = parseClock(body.clock);
  if (!history || !bookings || pending === undefined || !now) {
    return json({ status: "fallback", reason: "invalid_request" }, 400);
  }

  if (!process.env.ANTHROPIC_API_KEY) return json({ status: "fallback", reason: "not_configured" });

  const visitor = visitorId(request);
  const decision = guard.check(visitor, RECEPTIONIST_TURN_ESTIMATED_CENTS);
  if (!decision.allowed) return json({ status: "fallback", reason: decision.reason });

  const outcome = await runReceptionistTurn({ history, bookings, pending, now });
  guard.record(visitor, outcome.costCents);

  return outcome.status === "ok"
    ? json({ status: "ok", text: outcome.text, events: outcome.events })
    : json({ status: "fallback", reason: outcome.reason });
}
