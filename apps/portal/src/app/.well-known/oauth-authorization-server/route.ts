import { MCP_SCOPE } from "@wyrm/core";
import { NextResponse } from "next/server";
import { portalBase } from "@/lib/mcp";

/** Authorization Server Metadata (RFC 8414): public clients, PKCE S256, dynamic registration. */
export async function GET() {
  const base = await portalBase();
  return NextResponse.json(
    {
      issuer: base,
      authorization_endpoint: `${base}/oauth/authorize`,
      token_endpoint: `${base}/oauth/token`,
      registration_endpoint: `${base}/oauth/register`,
      response_types_supported: ["code"],
      grant_types_supported: ["authorization_code", "refresh_token"],
      code_challenge_methods_supported: ["S256"],
      token_endpoint_auth_methods_supported: ["none"],
      scopes_supported: [MCP_SCOPE],
      authorization_response_iss_parameter_supported: true,
    },
    { headers: { "Cache-Control": "public, max-age=300", "Access-Control-Allow-Origin": "*" } },
  );
}
