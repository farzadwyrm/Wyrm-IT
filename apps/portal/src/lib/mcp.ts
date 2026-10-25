import "server-only";
import { createHash } from "node:crypto";
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
