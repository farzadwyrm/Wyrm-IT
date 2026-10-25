import { DomainError, exchangeCode, refreshTokens } from "@wyrm/core";
import { type NextRequest, NextResponse } from "next/server";
import { serverDb } from "@/lib/db";
import { NO_STORE } from "@/lib/mcp";

/** Token endpoint: authorization_code (with PKCE) and refresh_token grants, public clients. */

const CORS = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "Content-Type" };
const error = (code: string, status = 400) =>
  NextResponse.json({ error: code }, { status, headers: { ...NO_STORE, ...CORS } });

export async function POST(request: NextRequest) {
  const db = serverDb();
  if (!db) return error("temporarily_unavailable", 503);
  let form: URLSearchParams;
  try {
    const type = request.headers.get("content-type") ?? "";
    form = type.includes("application/json")
      ? new URLSearchParams((await request.json()) as Record<string, string>)
      : new URLSearchParams(await request.text());
  } catch {
    return error("invalid_request");
  }
  const get = (k: string) => (form.get(k) ?? "").slice(0, 500);
  try {
    const grantType = get("grant_type");
    const tokens =
      grantType === "authorization_code"
        ? await exchangeCode(db, {
            code: get("code"),
            clientId: get("client_id"),
            redirectUri: get("redirect_uri"),
            codeVerifier: get("code_verifier"),
          })
        : grantType === "refresh_token"
          ? await refreshTokens(db, {
              refreshToken: get("refresh_token"),
              clientId: get("client_id"),
            })
          : null;
    if (!tokens) return error("unsupported_grant_type");
    return NextResponse.json(tokens, { headers: { ...NO_STORE, ...CORS, Pragma: "no-cache" } });
  } catch (e) {
    if (e instanceof DomainError)
      return error(e.code === "invalid_grant" ? "invalid_grant" : "invalid_request");
    throw e;
  }
}

export function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: { ...CORS, "Access-Control-Allow-Methods": "POST" },
  });
}
