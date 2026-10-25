import { createDemoGuard } from "@wyrm/ai";
import { DomainError, registerClient } from "@wyrm/core";
import { type NextRequest, NextResponse } from "next/server";
import { serverDb } from "@/lib/db";
import { NO_STORE } from "@/lib/mcp";

/** Dynamic client registration (RFC 7591) for MCP clients. 20 registrations an hour per IP. */

const guard = createDemoGuard({ dailyBudgetCents: 500, requestsPerVisitorPerHour: 20 });
const CORS = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "Content-Type" };

export async function POST(request: NextRequest) {
  const db = serverDb();
  if (!db) return NextResponse.json({ error: "temporarily_unavailable" }, { status: 503 });
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  if (!guard.check(ip, 1).allowed)
    return NextResponse.json(
      { error: "slow_down" },
      { status: 429, headers: { ...NO_STORE, ...CORS } },
    );
  let body: Record<string, unknown> = {};
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json(
      { error: "invalid_client_metadata" },
      { status: 400, headers: { ...NO_STORE, ...CORS } },
    );
  }
  try {
    const client = await registerClient(db, body);
    guard.record(ip, 0);
    return NextResponse.json(
      {
        client_id: client.clientId,
        client_name: client.clientName,
        redirect_uris: client.redirectUris,
        token_endpoint_auth_method: "none",
        grant_types: ["authorization_code", "refresh_token"],
        response_types: ["code"],
        client_id_issued_at: Math.floor(client.createdAt.getTime() / 1000),
      },
      { status: 201, headers: { ...NO_STORE, ...CORS } },
    );
  } catch (e) {
    if (e instanceof DomainError)
      return NextResponse.json(
        { error: "invalid_redirect_uri", error_description: e.message },
        { status: 400, headers: { ...NO_STORE, ...CORS } },
      );
    throw e;
  }
}

export function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: { ...CORS, "Access-Control-Allow-Methods": "POST" },
  });
}
