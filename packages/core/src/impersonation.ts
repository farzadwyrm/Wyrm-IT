import { assertCan } from "@wyrm/auth";
import { impersonationSessions, tenantUsers } from "@wyrm/db";
import { and, eq, isNull } from "drizzle-orm";
import { audit } from "./audit";
import { type Ctx, DomainError } from "./context";

const MINUTES = 30;

/**
 * Starts a time-limited "view as" session. Needs a reason; Support sessions are read-only.
 * Logged against the tenant, so its Owner sees it in their audit log.
 */
export async function startViewAs(ctx: Ctx, input: { tenantUserId: string; reason: string }) {
  const actor = ctx.actor;
  if (actor?.kind !== "platform")
    throw new DomainError("platform_only", "Only Wyrm staff can view as a customer.");
  assertCan(actor, "impersonate");
  const reason = input.reason.trim();
  if (reason.length < 5)
    throw new DomainError("reason_required", "Give a short reason (at least 5 characters).");
  const [target] = await ctx.db
    .select()
    .from(tenantUsers)
    .where(eq(tenantUsers.id, input.tenantUserId));
  if (!target) throw new DomainError("not_found", "User not found.");
  const readOnly = actor.role === "support";
  const [session] = await ctx.db
    .insert(impersonationSessions)
    .values({
      platformUserId: actor.userId,
      tenantId: target.tenantId,
      tenantUserId: target.id,
      reason: reason.slice(0, 500),
      readOnly,
      expiresAt: new Date(Date.now() + MINUTES * 60_000),
    })
    .returning();
  await audit(ctx, {
    action: "impersonation.started",
    tenantId: target.tenantId,
    targetType: "tenant_user",
    targetId: target.id,
    after: { reason, readOnly, minutes: MINUTES, as: target.email },
    extra: { impersonation_session: session?.id },
  });
  return session;
}

export async function endViewAs(ctx: Ctx, sessionId: string) {
  const actor = ctx.actor;
  const staffId =
    actor?.kind === "impersonating"
      ? actor.platform.userId
      : actor?.kind === "platform"
        ? actor.userId
        : null;
  if (!staffId) return;
  const [session] = await ctx.db
    .update(impersonationSessions)
    .set({ endedAt: new Date() })
    .where(
      and(
        eq(impersonationSessions.id, sessionId),
        eq(impersonationSessions.platformUserId, staffId),
        isNull(impersonationSessions.endedAt),
      ),
    )
    .returning();
  if (session) {
    await audit(ctx, {
      action: "impersonation.ended",
      tenantId: session.tenantId,
      targetType: "tenant_user",
      targetId: session.tenantUserId,
      extra: { impersonation_session: session.id },
    });
  }
}
