import { timingSafeEqual } from "node:crypto";
import { DomainError, publicAgent, saveCalendarConnection } from "@wyrm/core";
import { type NextRequest, NextResponse } from "next/server";
import { coreContext, requireAccess } from "@/lib/auth";
import { calendarConfig, calendarRedirect } from "@/lib/calendar";
import { serverDb } from "@/lib/db";

const same = (a: string, b: string) =>
  a.length === b.length && timingSafeEqual(Buffer.from(a), Buffer.from(b));

/** Google sends the owner back here: check the state, swap the code for tokens, store them encrypted. */
export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const [savedState = "", agentId = ""] = (request.cookies.get("wyrm_cal")?.value ?? "").split(".");
  const back = (q: string) => {
    const res = NextResponse.redirect(
      new URL(
        `/dashboard/agents/${/^[0-9a-f-]{36}$/.test(agentId) ? agentId : ""}/launch?${q}`,
        request.url,
      ),
    );
    res.cookies.delete({ name: "wyrm_cal", path: "/api/calendar" });
    return res;
  };
  const config = calendarConfig();
  const db = serverDb();
  if (!config || !db) return back("error=calendar_off");
  if (params.get("error")) return back("error=calendar_denied");
  const code = params.get("code") ?? "";
  if (!savedState || !same(savedState, params.get("state") ?? "") || !code)
    return back("error=calendar_failed");

  const access = await requireAccess();
  const agent = await publicAgent(db, agentId);
  if (!agent) return back("error=not_found");

  const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: config.clientId,
      client_secret: config.clientSecret,
      redirect_uri: calendarRedirect(request.headers.get("host") ?? ""),
      grant_type: "authorization_code",
    }),
    signal: AbortSignal.timeout(8000),
  }).catch(() => null);
  if (!tokenRes?.ok) return back("error=calendar_failed");
  const tokens = (await tokenRes.json()) as {
    refresh_token?: string;
    scope?: string;
    id_token?: string;
  };
  // The id_token came straight from Google over TLS; we only read the email from it.
  let email: string | null = null;
  try {
    const payload = JSON.parse(
      Buffer.from((tokens.id_token ?? "").split(".")[1] ?? "", "base64url").toString("utf8"),
    ) as { email?: string };
    email = payload.email ?? null;
  } catch {
    email = null;
  }
  try {
    await saveCalendarConnection(await coreContext(access), {
      tenantId: agent.tenantId,
      agentId,
      email,
      refreshToken: tokens.refresh_token ?? "",
      scopes: tokens.scope ?? "",
      secret: config.secret,
    });
  } catch (e) {
    return back(`error=${e instanceof DomainError ? e.code : "calendar_failed"}`);
  }
  return back("notice=calendar_connected");
}
