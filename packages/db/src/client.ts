import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

/**
 * Makes a pasted connection string safe to parse: trims spaces and wrapping quotes, and
 * percent-encodes the password, so passwords with symbols like # / ? @ work as typed.
 */
export function normalizeDbUrl(raw: string): string {
  const url = raw.trim().replace(/^["']|["']$/g, "");
  const match = /^(postgres(?:ql)?:\/\/)([^:/@]+):(.*)@([^@]+)$/.exec(url);
  if (!match) return url;
  const [, scheme, user, password = "", rest] = match;
  let plain = password;
  try {
    plain = decodeURIComponent(password);
  } catch {
    // not encoded yet (e.g. a lone %): use as typed
  }
  return `${scheme}${user}:${encodeURIComponent(plain)}@${rest}`;
}

/** Shape of a connection string for logs, never the password itself. */
export function describeDbUrl(raw: string): string {
  const url = normalizeDbUrl(raw);
  try {
    const parsed = new URL(url);
    return `${parsed.protocol}//${parsed.username}:***@${parsed.host}${parsed.pathname}`;
  } catch {
    return `unparseable (${url.length} chars, starts "${url.slice(0, 13)}")`;
  }
}

/**
 * Server-side Postgres connection for the portal's writes. Use the Supabase transaction pooler
 * URL (port 6543): prepared statements are off because the pooler doesn't keep them, and the
 * pool is small because each serverless instance opens its own.
 */
export function createDb(url: string) {
  const sql = postgres(normalizeDbUrl(url), {
    prepare: false,
    max: 3,
    idle_timeout: 20,
    connect_timeout: 10,
  });
  return drizzle(sql);
}
