import "server-only";
import { createHash } from "node:crypto";
import { lookup } from "node:dns/promises";
import { isIP } from "node:net";
import type { McpDeps } from "@wyrm/core";
import { headers } from "next/headers";
import { knowledgeDeps, modelDeps } from "./models";

/**
 * Wyrm agents over MCP: the public addresses AI apps use, and the engine's dependencies.
 * Everything is derived from the request host, so previews and production each describe
 * themselves.
 */

export async function portalBase() {
  const host = (await headers()).get("host") ?? "wyrm-portal.vercel.app";
  const local = host.startsWith("localhost") || host.startsWith("127.0.0.1");
  return `${local ? "http" : "https"}://${host}`;
}

export const mcpResource = (base: string) => `${base}/mcp`;

/** Null when the server secret is missing: the MCP endpoint then stays closed. */
export function mcpDeps(user: string | null): McpDeps | null {
  const key = process.env.SUPABASE_SECRET_KEY?.trim();
  if (!key) return null;
  return {
    runtime: modelDeps().deps,
    knowledge: knowledgeDeps(user),
    // A separate key for booking confirmations, derived so no extra secret is needed.
    secret: createHash("sha256").update(`wyrm-mcp-confirm:${key}`).digest("hex"),
  };
}

export const NO_STORE = { "Cache-Control": "no-store" };

/** Private, loopback, link-local and other non-public addresses (SSRF guard). */
function isPrivateAddress(address: string): boolean {
  if (isIP(address) === 6) {
    const a = address.toLowerCase();
    if (a.startsWith("::ffff:")) return isPrivateAddress(a.slice(7));
    return a === "::1" || a === "::" || /^(fc|fd|fe8|fe9|fea|feb)/.test(a);
  }
  const [b0 = 0, b1 = 0] = address.split(".").map(Number);
  return (
    b0 === 0 ||
    b0 === 10 ||
    b0 === 127 ||
    (b0 === 100 && b1 >= 64 && b1 <= 127) ||
    (b0 === 169 && b1 === 254) ||
    (b0 === 172 && b1 >= 16 && b1 <= 31) ||
    (b0 === 192 && b1 === 168) ||
    b0 >= 224
  );
}

/**
 * Fetches an MCP client's metadata document: https only, public addresses only, no redirects,
 * 5 seconds and 16 KB at most.
 */
export async function fetchClientMetadata(url: string): Promise<unknown> {
  const u = new URL(url);
  if (u.protocol !== "https:" || u.port || isIP(u.hostname.replace(/^\[|\]$/g, "")))
    throw new Error("blocked_url");
  const addresses = await lookup(u.hostname, { all: true });
  if (addresses.length === 0 || addresses.some((a) => isPrivateAddress(a.address)))
    throw new Error("blocked_address");
  const response = await fetch(url, {
    redirect: "manual",
    signal: AbortSignal.timeout(5000),
    headers: { Accept: "application/json" },
  });
  if (!response.ok) throw new Error(`status_${response.status}`);
  const body = await response.text();
  if (body.length > 16_384) throw new Error("too_large");
  return JSON.parse(body);
}
