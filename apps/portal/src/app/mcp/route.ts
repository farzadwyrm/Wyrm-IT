import { createDemoGuard } from "@wyrm/ai";
import {
  assertMcpActor,
  DomainError,
  handleMcpMessage,
  loadActor,
  verifyAccessToken,
} from "@wyrm/core";
import { type NextRequest, NextResponse } from "next/server";
import { serverDb } from "@/lib/db";
import { mcpDeps, mcpResource, NO_STORE, portalBase } from "@/lib/mcp";

/**
 * Wyrm's MCP endpoint (Streamable HTTP, stateless JSON responses). Every request carries an
 * OAuth access token issued for this endpoint; the organisation and member come from that
 * token only. Abuse limit: 120 requests an hour per token, plus each organisation's AI budget.
 */

const guard = createDemoGuard({ dailyBudgetCents: 500, requestsPerVisitorPerHour: 120 });

const unauthorized = async () => {
  const base = await portalBase();
  return NextResponse.json(
    { error: "invalid_token" },
    {
      status: 401,
      headers: {
        ...NO_STORE,
        "WWW-Authenticate": `Bearer resource_metadata="${base}/.well-known/oauth-protected-resource/mcp", error="invalid_token"`,
      },
    },
  );
};

export async function POST(request: NextRequest) {
  const db = serverDb();
  if (!db) return NextResponse.json({ error: "unavailable" }, { status: 503, headers: NO_STORE });
  const token = request.headers.get("authorization")?.match(/^Bearer\s+(\S+)$/i)?.[1] ?? "";
  const base = await portalBase();
  const grant = await verifyAccessToken(db, token, mcpResource(base));
  if (!grant) return unauthorized();

  const allowed = guard.check(grant.clientId + grant.userId, 1);
  if (!allowed.allowed)
    return NextResponse.json(
      { jsonrpc: "2.0", id: null, error: { code: -32000, message: "Too many requests" } },
      { status: 429, headers: NO_STORE },
    );

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { jsonrpc: "2.0", id: null, error: { code: -32700, message: "Parse error" } },
      { status: 400, headers: NO_STORE },
    );
  }
  if (Array.isArray(body))
    return NextResponse.json(
      { jsonrpc: "2.0", id: null, error: { code: -32600, message: "Batches are not supported" } },
      { status: 400, headers: NO_STORE },
    );

  const ctx = {
    db,
    actor: await loadActor(db, { userId: grant.userId, mfa: false, tenantId: grant.tenantId }),
  };
  const caller = { tenantId: grant.tenantId, userId: grant.userId };
  try {
    assertMcpActor(ctx, caller);
  } catch (e) {
    if (e instanceof DomainError) return unauthorized();
    throw e;
  }
  const deps = mcpDeps(null);
  if (!deps) return NextResponse.json({ error: "unavailable" }, { status: 503, headers: NO_STORE });

  try {
    const response = await handleMcpMessage(ctx, caller, body, deps);
    guard.record(grant.clientId + grant.userId, 0);
    if (!response) return new NextResponse(null, { status: 202, headers: NO_STORE });
    return NextResponse.json(response, { headers: NO_STORE });
  } catch (error) {
    console.error("mcp request failed", error instanceof Error ? error.message : error);
    const id = (body as { id?: unknown })?.id;
    return NextResponse.json(
      {
        jsonrpc: "2.0",
        id: typeof id === "string" || typeof id === "number" ? id : null,
        error: { code: -32603, message: "Internal error" },
      },
      { status: 500, headers: NO_STORE },
    );
  }
}

/** No server-to-client stream: every answer comes back on the POST. */
export function GET() {
  return new NextResponse(null, { status: 405, headers: { Allow: "POST", ...NO_STORE } });
}

export function DELETE() {
  return new NextResponse(null, { status: 405, headers: { Allow: "POST", ...NO_STORE } });
}
