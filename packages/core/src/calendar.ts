import { createCipheriv, createDecipheriv, hkdfSync, randomBytes } from "node:crypto";
import { calendarConnections } from "@wyrm/db";
import { and, eq } from "drizzle-orm";
import { audit } from "./audit";
import { type Ctx, type Db, DomainError, guarded } from "./context";
import { agentGate } from "./operations";

/**
 * Google Calendar for bookings (roadmap phase 3). The refresh token is encrypted with AES-256-GCM
 * under a key derived from the server's secret, so the database never holds it in the clear and
 * signed-in users can't read even the ciphertext. All Google calls go through `CalendarApi`, which
 * tests replace with a fake.
 */

function key(secret: string) {
  if (secret.length < 20) throw new Error("calendar key secret missing");
  return Buffer.from(hkdfSync("sha256", secret, "wyrm-calendar", "refresh-token-v1", 32));
}

export function encryptToken(plain: string, secret: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key(secret), iv);
  const body = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  return Buffer.concat([iv, cipher.getAuthTag(), body]).toString("base64");
}

export function decryptToken(encoded: string, secret: string): string {
  const raw = Buffer.from(encoded, "base64");
  const decipher = createDecipheriv("aes-256-gcm", key(secret), raw.subarray(0, 12));
  decipher.setAuthTag(raw.subarray(12, 28));
  return Buffer.concat([decipher.update(raw.subarray(28)), decipher.final()]).toString("utf8");
}

/** Minutes east of UTC for a time zone at a given instant. */
function offsetMinutes(at: Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).formatToParts(at);
  const n = (t: string) => Number(parts.find((p) => p.type === t)?.value);
  const asUtc = Date.UTC(n("year"), n("month") - 1, n("day"), n("hour"), n("minute"));
  return Math.round((asUtc - at.getTime()) / 60_000);
}

/** A local wall-clock date and time in `timeZone` as the real instant. */
export function zonedTime(date: string, time: string, timeZone: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !/^\d{1,2}:\d{2}$/.test(time)) return null;
  const naive = new Date(`${date}T${time.padStart(5, "0")}:00Z`);
  if (Number.isNaN(naive.getTime())) return null;
  return new Date(naive.getTime() - offsetMinutes(naive, timeZone) * 60_000);
}

/** "30 min", "1 hour", "1h30" → minutes (default 30). */
export function durationMinutes(text: string | undefined): number {
  const t = (text ?? "").toLowerCase();
  const hours = t.match(/(\d+(?:\.\d+)?)\s*h(?:ours?|rs?)?\s*(\d{1,2})?/);
  const minutes = t.match(/(\d+)\s*m/);
  const total = hours
    ? Math.round(Number(hours[1]) * 60 + Number(hours[2] ?? 0))
    : minutes
      ? Number(minutes[1])
      : 0;
  return total >= 5 && total <= 600 ? total : 30;
}

export interface CalendarEvent {
  summary: string;
  description: string;
  start: Date;
  end: Date;
  timeZone: string;
}

export interface CalendarApi {
  accessToken(refreshToken: string): Promise<string>;
  /** True when anything is booked between start and end. */
  isBusy(accessToken: string, calendarId: string, start: Date, end: Date): Promise<boolean>;
  createEvent(
    accessToken: string,
    calendarId: string,
    event: CalendarEvent,
  ): Promise<{ id: string }>;
}

export function googleCalendarApi(
  clientId: string,
  clientSecret: string,
  fetchImpl: typeof fetch = fetch,
): CalendarApi {
  const call = async (url: string, init: RequestInit) => {
    const res = await fetchImpl(url, { ...init, signal: AbortSignal.timeout(8000) });
    if (!res.ok) throw new Error(`google_${res.status}`);
    return res.json() as Promise<Record<string, unknown>>;
  };
  return {
    async accessToken(refreshToken) {
      const json = await call("https://oauth2.googleapis.com/token", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          client_id: clientId,
          client_secret: clientSecret,
          refresh_token: refreshToken,
          grant_type: "refresh_token",
        }),
      });
      return String(json.access_token ?? "");
    },
    async isBusy(token, calendarId, start, end) {
      const json = await call("https://www.googleapis.com/calendar/v3/freeBusy", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          timeMin: start.toISOString(),
          timeMax: end.toISOString(),
          items: [{ id: calendarId }],
        }),
      });
      const cal = (json.calendars as Record<string, { busy?: unknown[] }> | undefined)?.[
        calendarId
      ];
      return (cal?.busy?.length ?? 0) > 0;
    },
    async createEvent(token, calendarId, event) {
      const json = await call(
        `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events`,
        {
          method: "POST",
          headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
          body: JSON.stringify({
            summary: event.summary,
            description: event.description,
            start: { dateTime: event.start.toISOString(), timeZone: event.timeZone },
            end: { dateTime: event.end.toISOString(), timeZone: event.timeZone },
          }),
        },
      );
      return { id: String(json.id ?? "") };
    },
  };
}

// ---------------------------------------------------------------------------------------------
// Connections

export async function saveCalendarConnection(
  ctx: Ctx,
  input: {
    tenantId: string;
    agentId: string;
    email: string | null;
    refreshToken: string;
    scopes: string;
    secret: string;
  },
) {
  agentGate(ctx, "agents.configure", input.tenantId, input.agentId);
  if (!input.refreshToken)
    throw new DomainError(
      "calendar_no_token",
      "Google didn't give long-term access. Try connecting again.",
    );
  const values = {
    accountEmail: input.email?.slice(0, 200) ?? null,
    refreshTokenEnc: encryptToken(input.refreshToken, input.secret),
    scopes: input.scopes.slice(0, 500),
    status: "ok" as const,
    lastError: null,
    lastCheckedAt: new Date(),
    connectedBy: ctx.actor?.kind === "impersonating" ? null : (ctx.actor?.userId ?? null),
    connectedAt: new Date(),
  };
  await guarded(() =>
    ctx.db
      .insert(calendarConnections)
      .values({ ...values, agentId: input.agentId, tenantId: input.tenantId })
      .onConflictDoUpdate({ target: calendarConnections.agentId, set: values }),
  );
  await audit(ctx, {
    action: "calendar.connected",
    tenantId: input.tenantId,
    targetType: "agent",
    targetId: input.agentId,
    after: { email: values.accountEmail },
  });
}

export async function disconnectCalendar(ctx: Ctx, input: { tenantId: string; agentId: string }) {
  agentGate(ctx, "agents.configure", input.tenantId, input.agentId);
  await ctx.db
    .delete(calendarConnections)
    .where(
      and(
        eq(calendarConnections.agentId, input.agentId),
        eq(calendarConnections.tenantId, input.tenantId),
      ),
    );
  await audit(ctx, {
    action: "calendar.disconnected",
    tenantId: input.tenantId,
    targetType: "agent",
    targetId: input.agentId,
  });
}

/** Connection details for screens (never the token). */
export async function calendarStatus(ctx: Ctx, tenantId: string, agentId: string) {
  agentGate(ctx, "agents.logs", tenantId, agentId);
  const [row] = await ctx.db
    .select({
      accountEmail: calendarConnections.accountEmail,
      status: calendarConnections.status,
      lastCheckedAt: calendarConnections.lastCheckedAt,
      lastError: calendarConnections.lastError,
      connectedAt: calendarConnections.connectedAt,
    })
    .from(calendarConnections)
    .where(
      and(eq(calendarConnections.agentId, agentId), eq(calendarConnections.tenantId, tenantId)),
    );
  return row ?? null;
}

/**
 * Books a slot if it is free. Returns "booked", "busy", or "unavailable" (no connection or an
 * error: the caller then falls back to a request for the team). Records the health of the link.
 */
export async function bookOnCalendar(
  db: Db,
  input: { agentId: string; api: CalendarApi; secret: string; event: CalendarEvent },
): Promise<"booked" | "busy" | "unavailable"> {
  const [conn] = await db
    .select()
    .from(calendarConnections)
    .where(eq(calendarConnections.agentId, input.agentId));
  if (!conn || conn.status === "revoked") return "unavailable";
  try {
    const token = await input.api.accessToken(decryptToken(conn.refreshTokenEnc, input.secret));
    if (await input.api.isBusy(token, conn.calendarId, input.event.start, input.event.end))
      return "busy";
    await input.api.createEvent(token, conn.calendarId, input.event);
    await db
      .update(calendarConnections)
      .set({ status: "ok", lastError: null, lastCheckedAt: new Date() })
      .where(eq(calendarConnections.agentId, input.agentId));
    return "booked";
  } catch (error) {
    const message = error instanceof Error ? error.message : "error";
    await db
      .update(calendarConnections)
      .set({
        status: /google_(400|401)/.test(message) ? "revoked" : "error",
        lastError: message.slice(0, 300),
        lastCheckedAt: new Date(),
      })
      .where(eq(calendarConnections.agentId, input.agentId));
    return "unavailable";
  }
}
