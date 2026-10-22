import { timingSafeEqual } from "node:crypto";
import { DomainError, publicAgent, storeConnectionSecret } from "@wyrm/core";
import { type NextRequest, NextResponse } from "next/server";
import { coreContext, requireAccess } from "@/lib/auth";
import { ConnectorError, connectionKey } from "@/lib/connectors";
import { exchangeCode, microsoftConfig, writeScopes } from "@/lib/connectors/sharepoint";
import { serverDb } from "@/lib/db";

const same = (a: string, b: string) =>
  a.length === b.length && timingSafeEqual(Buffer.from(a), Buffer.from(b));

/** Microsoft sends the manager back here: check the state, keep the refresh token encrypted. */
export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const [saved = "", agentId = "", connectionId = ""] = (
    request.cookies.get("wyrm_ms")?.value ?? ""
  ).split(".");
  const ok = /^[0-9a-f-]{36}$/.test(agentId) && /^[0-9a-f-]{36}$/.test(connectionId);
  const back = (q: string) => {
    const res = NextResponse.redirect(
      new URL(ok ? `/dashboard/agents/${agentId}/connections?${q}` : "/dashboard", request.url),
    );
    res.cookies.delete({ name: "wyrm_ms", path: "/api/connections" });
    return res;
  };
  const db = serverDb();
  if (!ok || !microsoftConfig() || !db) return back("error=microsoft_off");
  if (params.get("error")) return back("error=microsoft_denied");
  const code = params.get("code") ?? "";
  if (!saved || !same(saved, params.get("state") ?? "") || !code)
    return back("error=microsoft_failed");

  const access = await requireAccess();
  const agent = await publicAgent(db, agentId);
  if (!agent) return back("error=not_found");
  try {
    const tokens = await exchangeCode(code, request.headers.get("host") ?? "");
    if (!tokens.refresh_token) return back("error=microsoft_failed");
    if (writeScopes(tokens.scope ?? "").length) return back("error=not_read_only");
    // The id_token came straight from Microsoft over TLS; only the account name is read from it.
    let account = "";
    try {
      const claims = JSON.parse(
        Buffer.from((tokens.id_token ?? "").split(".")[1] ?? "", "base64url").toString("utf8"),
      ) as { email?: string; preferred_username?: string };
      account = (claims.email ?? claims.preferred_username ?? "").slice(0, 200);
    } catch {
      account = "";
    }
    await storeConnectionSecret(await coreContext(access), {
      tenantId: agent.tenantId,
      agentId,
      id: connectionId,
      secret: tokens.refresh_token,
      encryptionKey: connectionKey(),
      config: account ? { account } : {},
    });
  } catch (e) {
    return back(
      `error=${e instanceof DomainError ? e.code : e instanceof ConnectorError ? "microsoft_failed" : "microsoft_failed"}`,
    );
  }
  return back("notice=microsoft_connected");
}
