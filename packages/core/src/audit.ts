import type { Actor } from "@wyrm/auth";
import { auditLogs } from "@wyrm/db";
import { and, desc, eq, type SQL } from "drizzle-orm";
import type { Ctx, Db } from "./context";

export interface AuditEntry {
  action: string;
  tenantId?: string | null;
  targetType?: string;
  targetId?: string | undefined;
  before?: unknown;
  after?: unknown;
  extra?: Record<string, unknown>;
}

function actorFields(actor: Actor | null) {
  if (!actor) return { actorType: "system" as const, actorId: null, meta: {} };
  if (actor.kind === "platform")
    return { actorType: "platform" as const, actorId: actor.userId, meta: {} };
  if (actor.kind === "impersonating") {
    return {
      actorType: "platform" as const,
      actorId: actor.platform.userId,
      meta: { impersonation_session: actor.sessionId, viewing_as: actor.as.tenantUserId },
    };
  }
  return { actorType: "tenant" as const, actorId: actor.userId, meta: {} };
}

/** Records who did what, when, from where, with before/after values. */
export async function audit(ctx: Ctx, entry: AuditEntry, db: Db = ctx.db): Promise<void> {
  const who = actorFields(ctx.actor);
  await db.insert(auditLogs).values({
    tenantId: entry.tenantId ?? null,
    actorType: who.actorType,
    actorId: who.actorId,
    action: entry.action,
    targetType: entry.targetType ?? null,
    targetId: entry.targetId ?? null,
    metadata: {
      ...who.meta,
      ...(entry.before !== undefined ? { before: entry.before } : {}),
      ...(entry.after !== undefined ? { after: entry.after } : {}),
      ...(entry.extra ?? {}),
    },
    ip: ctx.ip ?? null,
  });
}

export async function listAudit(
  db: Db,
  filter: { tenantId?: string | null; action?: string; limit?: number; offset?: number },
) {
  const where: SQL[] = [];
  if (filter.tenantId) where.push(eq(auditLogs.tenantId, filter.tenantId));
  if (filter.action) where.push(eq(auditLogs.action, filter.action));
  return db
    .select()
    .from(auditLogs)
    .where(where.length ? and(...where) : undefined)
    .orderBy(desc(auditLogs.createdAt), desc(auditLogs.id))
    .limit(Math.min(filter.limit ?? 50, 200))
    .offset(filter.offset ?? 0);
}
