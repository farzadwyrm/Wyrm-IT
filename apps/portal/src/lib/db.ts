import "server-only";
import { createDb, describeDbUrl } from "@wyrm/db/client";

let db: ReturnType<typeof createDb> | null = null;

/**
 * Direct Postgres connection for server-side reads and writes through `@wyrm/core` (which checks
 * permissions itself). Null when DATABASE_URL isn't set (e.g. in tests) or can't be parsed.
 */
export function serverDb() {
  const url = process.env.DATABASE_URL;
  if (!url?.trim()) return null;
  try {
    db ??= createDb(url);
    return db;
  } catch (cause) {
    console.error(
      `portal: DATABASE_URL rejected (${describeDbUrl(url)}):`,
      cause instanceof Error ? cause.message : cause,
    );
    return null;
  }
}
