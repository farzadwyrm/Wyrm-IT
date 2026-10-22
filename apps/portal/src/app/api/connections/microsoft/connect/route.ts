import { randomBytes } from "node:crypto";
import { check } from "@wyrm/auth";
import { publicAgent } from "@wyrm/core";
import { type NextRequest, NextResponse } from "next/server";
import { getAccess } from "@/lib/auth";
import { authorizeUrl, microsoftConfig } from "@/lib/connectors/sharepoint";
import { serverDb } from "@/lib/db";

const ID = /^[0-9a-f-]{36}$/;

/** Starts "Sign in with Microsoft" for one SharePoint connection: owners and admins only. */
export async function GET(request: NextRequest) {
  const agentId = request.nextUrl.searchParams.get("agent") ?? "";
  const connectionId = request.nextUrl.searchParams.get("connection") ?? "";
  const db = serverDb();
  if (!ID.test(agentId) || !ID.test(connectionId) || !db)
    return NextResponse.redirect(new URL("/dashboard", request.url));
  const back = (q: string) =>
    NextResponse.redirect(new URL(`/dashboard/agents/${agentId}/connections?${q}`, request.url));
  const config = microsoftConfig();
  if (!config) return back("error=microsoft_off");
  const access = await getAccess();
  const actor = access?.actor ?? null;
  const agent = await publicAgent(db, agentId);
  if (
    !agent ||
    !actor ||
    actor.kind === "impersonating" ||
    !check(actor, "security.manage", { tenantId: agent.tenantId }).allowed ||
    !check(actor, "agents.configure", { tenantId: agent.tenantId, agentId }).allowed
  )
    return back("error=forbidden");

  const state = randomBytes(24).toString("base64url");
  const res = NextResponse.redirect(
    authorizeUrl(config.clientId, request.headers.get("host") ?? "", state),
  );
  // Ties Microsoft's answer to this browser, agent and connection (10 minutes, not readable by scripts).
  res.cookies.set("wyrm_ms", `${state}.${agentId}.${connectionId}`, {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/api/connections",
    maxAge: 600,
  });
  return res;
}
