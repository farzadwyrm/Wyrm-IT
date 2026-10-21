import type { Actor } from "@wyrm/auth";
import type { PgDatabase } from "drizzle-orm/pg-core";

/** Any Drizzle Postgres database: postgres-js in production, PGlite in tests. */
// biome-ignore lint/suspicious/noExplicitAny: driver-agnostic database handle
export type Db = PgDatabase<any, any, any>;

/** Request facts every operation needs: who is acting and from where. */
export interface Ctx {
  db: Db;
  actor: Actor | null;
  /** Client IP for the audit log (from x-forwarded-for), if known. */
  ip?: string | null;
}

/** A rule the user can fix (seat limit reached, wrong email...). Safe to show. */
export class DomainError extends Error {
  constructor(
    readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = "DomainError";
  }
}

const DB_RULES: [RegExp, string, string][] = [
  [
    /seat_limit/,
    "seat_limit",
    "This organisation has no free seats. Raise the seat limit or free a seat.",
  ],
  [/agent_limit/, "agent_limit", "This organisation has reached its agent limit."],
  [
    /identity_separation/,
    "identity_separation",
    "Wyrm staff and customer staff must use different accounts.",
  ],
  [/owner_required/, "owner_required", "Transfer ownership before changing the owner."],
  [
    /tenant_users_one_owner|duplicate key.*owner/,
    "one_owner",
    "An organisation has exactly one owner.",
  ],
  [/tenant_mismatch|role_scope/, "tenant_mismatch", "That belongs to another organisation."],
  [
    /invitations_one_pending|duplicate key.*invitations/,
    "already_invited",
    "This person already has a pending invitation.",
  ],
  [
    /tenant_users_tenant_id_email_key|tenant_users_tenant_id_user_id_key/,
    "already_member",
    "This person is already a member.",
  ],
  [/tenants_slug_key/, "slug_taken", "That short name is already taken."],
];

/** Turns a database rule violation into a DomainError; rethrows anything else. */
export function translateDbError(error: unknown): never {
  const message = error instanceof Error ? error.message : String(error);
  const detail = (error as { cause?: { message?: string } })?.cause?.message ?? "";
  for (const [pattern, code, text] of DB_RULES) {
    if (pattern.test(message) || pattern.test(detail)) throw new DomainError(code, text);
  }
  throw error;
}

/** Runs a database call and translates rule violations. */
export async function guarded<T>(run: () => Promise<T>): Promise<T> {
  try {
    return await run();
  } catch (error) {
    if (error instanceof DomainError) throw error;
    return translateDbError(error);
  }
}
