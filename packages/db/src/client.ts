import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

/**
 * Server-side Postgres connection for the portal's writes. Use the Supabase transaction pooler
 * URL (port 6543): prepared statements are off because the pooler doesn't keep them, and the
 * pool is small because each serverless instance opens its own.
 */
export function createDb(url: string) {
  const sql = postgres(url, { prepare: false, max: 3, idle_timeout: 20, connect_timeout: 10 });
  return drizzle(sql);
}
