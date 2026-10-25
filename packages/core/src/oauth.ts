import { createHash } from "node:crypto";
import { oauthClients, oauthGrants, tenants } from "@wyrm/db";
import { and, eq, gt, isNull } from "drizzle-orm";
import { type Db, DomainError } from "./context";
import { hashToken, newToken } from "./tenants";

/**
 * Wyrm's OAuth 2.1 server for MCP clients (Claude, ChatGPT, Copilot Studio...). Public clients
 * only: PKCE S256 is required, redirect URIs must match exactly, codes are single use, and every
 * token is stored as a hash, bound to one client, one login and one organisation, and valid only
 * for the MCP endpoint it was issued for. Organisations opt in with `features.mcp`.
 */

export const MCP_SCOPE = "wyrm.agents";
const CODE_SECONDS = 600;
const ACCESS_SECONDS = 3600;
const REFRESH_SECONDS = 30 * 86_400;

/** https anywhere, http only for loopback (desktop clients). */
function validRedirect(uri: string): boolean {
  try {
    const u = new URL(uri);
    if (u.hash) return false;
    if (u.protocol === "https:") return true;
    return u.protocol === "http:" && ["localhost", "127.0.0.1", "[::1]"].includes(u.hostname);
  } catch {
    return false;
  }
}

/** Dynamic client registration (RFC 7591), public clients only. */
export async function registerClient(
  db: Db,
  input: { client_name?: unknown; redirect_uris?: unknown },
) {
  const uris = Array.isArray(input.redirect_uris)
    ? input.redirect_uris.filter((u): u is string => typeof u === "string").slice(0, 10)
    : [];
  if (uris.length === 0 || !uris.every((u) => u.length <= 500 && validRedirect(u)))
    throw new DomainError("invalid_redirect_uri", "Redirect URIs must be https (or loopback).");
  const name = typeof input.client_name === "string" ? input.client_name.trim().slice(0, 200) : "";
  const [row] = await db
    .insert(oauthClients)
    .values({ clientId: `wyrm_${newToken()}`, clientName: name, redirectUris: uris })
    .returning();
  if (!row) throw new DomainError("server_error", "Couldn't register the client.");
  return row;
}

export async function getClient(db: Db, clientId: string) {
  if (!clientId || clientId.length > 300) return null;
  const [row] = await db.select().from(oauthClients).where(eq(oauthClients.clientId, clientId));
  return row ?? null;
}

/** Fetches a client ID metadata document. The caller must block private and internal hosts. */
export type MetadataFetcher = (url: string) => Promise<unknown>;

const CIMD_REFRESH_MS = 86_400_000;

/**
 * The client for an authorization request. A client ID that is an https URL is a Client ID
 * Metadata Document (MCP 2025-11-25+, used by Claude): Wyrm fetches it, checks that it names
 * itself, and keeps a copy for a day. Other IDs must have registered first.
 */
export async function resolveClient(db: Db, clientId: string, fetchMetadata: MetadataFetcher) {
  if (!clientId.startsWith("https://")) return getClient(db, clientId);
  let url: URL;
  try {
    url = new URL(clientId);
  } catch {
    return null;
  }
  // The document's URL must have a path and no fragment or credentials.
  if (clientId.length > 300 || url.pathname === "/" || url.hash || url.username || url.password)
    return null;
  const cached = await getClient(db, clientId);
  if (cached && Date.now() - cached.createdAt.getTime() < CIMD_REFRESH_MS) return cached;
  let doc: Record<string, unknown>;
  try {
    doc = ((await fetchMetadata(clientId)) ?? {}) as Record<string, unknown>;
  } catch {
    return cached;
  }
  const uris = Array.isArray(doc.redirect_uris)
    ? doc.redirect_uris.filter((u): u is string => typeof u === "string").slice(0, 10)
    : [];
  if (doc.client_id !== clientId || uris.length === 0 || !uris.every((u) => validRedirect(u)))
    return null;
  const name = typeof doc.client_name === "string" ? doc.client_name.trim().slice(0, 200) : "";
  const [row] = await db
    .insert(oauthClients)
    .values({ clientId, clientName: name, redirectUris: uris })
    .onConflictDoUpdate({
      target: oauthClients.clientId,
      set: { clientName: name, redirectUris: uris, createdAt: new Date() },
    })
    .returning();
  return row ?? null;
}

/** Organisations that allow MCP access (phase 0: switched on per client by Wyrm). */
export async function mcpEnabled(db: Db, tenantId: string) {
  const [t] = await db.select().from(tenants).where(eq(tenants.id, tenantId));
  return Boolean(
    t && t.status === "active" && (t.features as Record<string, unknown>)?.mcp === true,
  );
}

/** After the signed-in user approves: a single-use code for the client's redirect URI. */
export async function createAuthCode(
  db: Db,
  input: {
    clientId: string;
    userId: string;
    tenantId: string;
    redirectUri: string;
    codeChallenge: string;
    resource: string;
  },
) {
  const client = await getClient(db, input.clientId);
  if (!client?.redirectUris.includes(input.redirectUri))
    throw new DomainError("invalid_request", "Unknown client or redirect URI.");
  if (!/^[A-Za-z0-9_-]{43,128}$/.test(input.codeChallenge))
    throw new DomainError("invalid_request", "A PKCE S256 code challenge is required.");
  if (!(await mcpEnabled(db, input.tenantId)))
    throw new DomainError("access_denied", "This organisation hasn't switched on AI app access.");
  const code = newToken();
  await db.insert(oauthGrants).values({
    kind: "code",
    tokenHash: hashToken(code),
    clientId: input.clientId,
    userId: input.userId,
    tenantId: input.tenantId,
    scope: MCP_SCOPE,
    resource: input.resource,
    redirectUri: input.redirectUri,
    codeChallenge: input.codeChallenge,
    expiresAt: new Date(Date.now() + CODE_SECONDS * 1000),
  });
  return code;
}

const s256 = (verifier: string) => createHash("sha256").update(verifier).digest("base64url");

async function issueTokens(
  db: Db,
  grant: { clientId: string; userId: string; tenantId: string; resource: string },
) {
  const access = newToken();
  const refresh = newToken();
  // Only these fields carry over from the code or the old refresh token.
  const base = {
    clientId: grant.clientId,
    userId: grant.userId,
    tenantId: grant.tenantId,
    resource: grant.resource,
    scope: MCP_SCOPE,
  };
  await db.insert(oauthGrants).values([
    {
      ...base,
      kind: "access",
      tokenHash: hashToken(access),
      expiresAt: new Date(Date.now() + ACCESS_SECONDS * 1000),
    },
    {
      ...base,
      kind: "refresh",
      tokenHash: hashToken(refresh),
      expiresAt: new Date(Date.now() + REFRESH_SECONDS * 1000),
    },
  ]);
  return {
    access_token: access,
    token_type: "Bearer" as const,
    expires_in: ACCESS_SECONDS,
    refresh_token: refresh,
    scope: MCP_SCOPE,
  };
}

/** Marks a grant used; only one caller can win (single use even under races). */
async function consume(db: Db, id: string) {
  const [row] = await db
    .update(oauthGrants)
    .set({ usedAt: new Date() })
    .where(and(eq(oauthGrants.id, id), isNull(oauthGrants.usedAt)))
    .returning({ id: oauthGrants.id });
  return Boolean(row);
}

/** authorization_code grant with PKCE. Errors use RFC 6749 codes. */
export async function exchangeCode(
  db: Db,
  input: { code: string; clientId: string; redirectUri: string; codeVerifier: string },
) {
  const [grant] = await db
    .select()
    .from(oauthGrants)
    .where(and(eq(oauthGrants.tokenHash, hashToken(input.code)), eq(oauthGrants.kind, "code")));
  if (
    !grant ||
    grant.usedAt ||
    grant.revokedAt ||
    grant.expiresAt <= new Date() ||
    grant.clientId !== input.clientId ||
    grant.redirectUri !== input.redirectUri ||
    !input.codeVerifier ||
    s256(input.codeVerifier) !== grant.codeChallenge
  )
    throw new DomainError("invalid_grant", "The code is invalid, expired or already used.");
  if (!(await consume(db, grant.id)))
    throw new DomainError("invalid_grant", "The code was already used.");
  if (!(await mcpEnabled(db, grant.tenantId)))
    throw new DomainError("invalid_grant", "AI app access is switched off for this organisation.");
  return issueTokens(db, grant);
}

/** refresh_token grant: rotates (the old refresh token stops working). */
export async function refreshTokens(db: Db, input: { refreshToken: string; clientId: string }) {
  const [grant] = await db
    .select()
    .from(oauthGrants)
    .where(
      and(
        eq(oauthGrants.tokenHash, hashToken(input.refreshToken)),
        eq(oauthGrants.kind, "refresh"),
      ),
    );
  if (
    !grant ||
    grant.usedAt ||
    grant.revokedAt ||
    grant.expiresAt <= new Date() ||
    grant.clientId !== input.clientId ||
    !(await consume(db, grant.id)) ||
    !(await mcpEnabled(db, grant.tenantId))
  )
    throw new DomainError("invalid_grant", "The refresh token is invalid or expired.");
  return issueTokens(db, grant);
}

/** The login and organisation behind a bearer token, or null. Checks audience and expiry. */
export async function verifyAccessToken(db: Db, token: string, resource: string) {
  if (!token || token.length > 200) return null;
  const [grant] = await db
    .select()
    .from(oauthGrants)
    .where(
      and(
        eq(oauthGrants.tokenHash, hashToken(token)),
        eq(oauthGrants.kind, "access"),
        isNull(oauthGrants.revokedAt),
        gt(oauthGrants.expiresAt, new Date()),
      ),
    );
  if (!grant || grant.resource !== resource) return null;
  if (!(await mcpEnabled(db, grant.tenantId))) return null;
  return { userId: grant.userId, tenantId: grant.tenantId, clientId: grant.clientId };
}
