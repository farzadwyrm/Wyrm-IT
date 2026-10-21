import { randomBytes } from "node:crypto";
import { check } from "@wyrm/auth";
import { publicAgent } from "@wyrm/core";
import { type NextRequest, NextResponse } from "next/server";
import { getAccess } from "@/lib/auth";
import { CALENDAR_SCOPES, calendarConfig, calendarRedirect } from "@/lib/calendar";
import { serverDb } from "@/lib/db";

/** Starts "Connect Google Calendar" for one agent: staff who configure it only. */
export async function GET(request: NextRequest) {
  const agentId = request.nextUrl.searchParams.get("agent") ?? "";
  const back = (q: string) =>
    NextResponse.redirect(new URL(`/dashboard/agents/${agentId}/launch?${q}`, request.url));
  const config = calendarConfig();
  const db = serverDb();
  if (!/^[0-9a-f-]{36}$/.test(agentId) || !db)
    return NextResponse.redirect(new URL("/dashboard", request.url));
  if (!config) return back("error=calendar_off");
  const access = await getAccess();
  const agent = await publicAgent(db, agentId);
  const actor = access?.actor ?? null;
  if (
    !agent ||
    !actor ||
    !check(actor, "agents.configure", { tenantId: agent.tenantId, agentId }).allowed ||
    actor.kind === "impersonating"
  )
    return back("error=forbidden");

  const state = randomBytes(24).toString("base64url");
  const host = request.headers.get("host") ?? "";
  const google = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  google.search = new URLSearchParams({
    client_id: config.clientId,
    redirect_uri: calendarRedirect(host),
    response_type: "code",
    scope: CALENDAR_SCOPES,
    access_type: "offline",
    prompt: "consent",
    include_granted_scopes: "true",
    state,
  }).toString();
  const res = NextResponse.redirect(google);
  // The state ties Google's answer to this browser and this agent (10 minutes, not readable by scripts).
  res.cookies.set("wyrm_cal", `${state}.${agentId}`, {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/api/calendar",
    maxAge: 600,
  });
  return res;
}
