import "server-only";
import { resolveClient } from "@wyrm/core";
import { serverDb } from "@/lib/db";
import { fetchClientMetadata, mcpResource, portalBase } from "@/lib/mcp";

/** A validated authorization request. Problems are shown on the page, never redirected. */
export interface AuthRequest {
  clientId: string;
  clientName: string;
  redirectUri: string;
  state: string;
  codeChallenge: string;
  resource: string;
}

const one = (v: string | string[] | undefined) => (typeof v === "string" ? v.slice(0, 500) : "");

export async function parseAuthRequest(
  params: Record<string, string | string[] | undefined>,
): Promise<{ ok: true; request: AuthRequest } | { ok: false; problem: string }> {
  const db = serverDb();
  if (!db) return { ok: false, problem: "The portal can't reach its database right now." };
  const clientId = one(params.client_id);
  const redirectUri = one(params.redirect_uri);
  const client = await resolveClient(db, clientId, fetchClientMetadata);
  if (!client) return { ok: false, problem: "This app isn't registered with Wyrm." };
  if (!client.redirectUris.includes(redirectUri))
    return { ok: false, problem: "This app's return address doesn't match its registration." };
  if (one(params.response_type) !== "code")
    return { ok: false, problem: "Only the authorization code flow is supported." };
  if (one(params.code_challenge_method) !== "S256" || !one(params.code_challenge))
    return { ok: false, problem: "The app must use PKCE (S256)." };
  const expected = mcpResource(await portalBase());
  const resource = one(params.resource) || expected;
  if (resource !== expected) return { ok: false, problem: "Unknown resource." };
  return {
    ok: true,
    request: {
      clientId,
      clientName: client.clientName || "An AI app",
      redirectUri,
      state: one(params.state),
      codeChallenge: one(params.code_challenge),
      resource,
    },
  };
}

/** Where to send the browser back to the app, with the given parameters. */
export function backToApp(redirectUri: string, values: Record<string, string>) {
  const url = new URL(redirectUri);
  for (const [k, v] of Object.entries(values)) if (v) url.searchParams.set(k, v);
  return url.toString();
}
