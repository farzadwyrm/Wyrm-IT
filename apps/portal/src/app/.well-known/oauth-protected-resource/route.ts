import { MCP_SCOPE } from "@wyrm/core";
import { NextResponse } from "next/server";
import { mcpResource, portalBase } from "@/lib/mcp";

/** Protected Resource Metadata (RFC 9728) for the MCP endpoint. */
export async function GET() {
  const base = await portalBase();
  return NextResponse.json(
    {
      resource: mcpResource(base),
      authorization_servers: [base],
      scopes_supported: [MCP_SCOPE],
      bearer_methods_supported: ["header"],
      resource_name: "Wyrm AI agents",
      resource_documentation: `${base}/`,
    },
    { headers: { "Cache-Control": "public, max-age=300", "Access-Control-Allow-Origin": "*" } },
  );
}
