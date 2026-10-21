import "server-only";
import { createDb } from "@wyrm/db/client";

let db: ReturnType<typeof createDb> | null = null;

/**
 * Direct Postgres connection for server-side reads and writes through `@wyrm/core` (which checks
 * permissions itself). Null when DATABASE_URL isn't set, e.g. in tests.
 */
export function serverDb() {
  const url = process.env.DATABASE_URL?.trim();
  if (!url) return null;
  db ??= createDb(url);
  return db;
}
