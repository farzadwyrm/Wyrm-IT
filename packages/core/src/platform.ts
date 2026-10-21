import { assertCan, checkPlatformStaffChange, ForbiddenError, type PlatformRole } from "@wyrm/auth";
import { agents, auditLogs, platformUsers, tenants, tenantUsers } from "@wyrm/db";
import { and, asc, count, eq, gte, ilike, or, type SQL } from "drizzle-orm";
import { audit } from "./audit";
import { type Ctx, DomainError, guarded } from "./context";

export async function listPlatformStaff(ctx: Ctx) {
  assertCan(ctx.actor, "platform_staff.view");
  return ctx.db.select().from(platformUsers).orderBy(asc(platformUsers.email));
}

/** Adds a Wyrm staff member (their login must already exist; the portal creates it if needed). */
export async function addPlatformStaff(
  ctx: Ctx,
  input: { userId: string; email: string; role: PlatformRole; name?: string },
) {
  const decision = checkPlatformStaffChange(ctx.actor, { newRole: input.role, target: null });
  if (!decision.allowed) throw new ForbiddenError("platform_staff.manage", decision.reason);
  const [row] = await guarded(() =>
    ctx.db
      .insert(platformUsers)
      .values({
        id: input.userId,
        email: input.email.toLowerCase(),
        platformRole: input.role,
        name: input.name ?? null,
      })
      .returning(),
  );
  await audit(ctx, {
    action: "platform_staff.added",
    targetType: "platform_user",
    targetId: input.userId,
    after: { email: input.email, role: input.role },
  });
  return row;
}

export async function changePlatformStaff(
  ctx: Ctx,
  input: { userId: string; role?: PlatformRole; status?: "active" | "disabled" },
) {
  const [current] = await ctx.db
    .select()
    .from(platformUsers)
    .where(eq(platformUsers.id, input.userId));
  if (!current) throw new DomainError("not_found", "Staff member not found.");
  const decision = checkPlatformStaffChange(ctx.actor, {
    newRole: input.role ?? current.platformRole,
    target: { userId: current.id, role: current.platformRole },
  });
  if (!decision.allowed) throw new ForbiddenError("platform_staff.manage", decision.reason);
  const patch = {
    ...(input.role ? { platformRole: input.role } : {}),
    ...(input.status ? { status: input.status } : {}),
  };
  await ctx.db.update(platformUsers).set(patch).where(eq(platformUsers.id, input.userId));
  await audit(ctx, {
    action: "platform_staff.changed",
    targetType: "platform_user",
    targetId: input.userId,
    before: { role: current.platformRole, status: current.status },
    after: patch,
  });
}

/** Search every customer user across tenants (Wyrm staff only). */
export async function searchAllUsers(
  ctx: Ctx,
  filter: {
    search?: string;
    tenantId?: string;
    status?: "active" | "deactivated";
    limit?: number;
    offset?: number;
  } = {},
) {
  assertCan(ctx.actor, "tenant_users.view");
  const where: SQL[] = [];
  if (filter.tenantId) where.push(eq(tenantUsers.tenantId, filter.tenantId));
  if (filter.status) where.push(eq(tenantUsers.status, filter.status));
  if (filter.search) {
    const q = `%${filter.search.replace(/[%_]/g, "")}%`;
    const cond = or(ilike(tenantUsers.email, q), ilike(tenantUsers.name, q));
    if (cond) where.push(cond);
  }
  return ctx.db
    .select({ user: tenantUsers, tenantName: tenants.name, tenantSlug: tenants.slug })
    .from(tenantUsers)
    .innerJoin(tenants, eq(tenants.id, tenantUsers.tenantId))
    .where(where.length ? and(...where) : undefined)
    .orderBy(asc(tenantUsers.email))
    .limit(Math.min(filter.limit ?? 50, 200))
    .offset(filter.offset ?? 0);
}

export async function platformStats(ctx: Ctx) {
  assertCan(ctx.actor, "platform.dashboard");
  const weekAgo = new Date(Date.now() - 7 * 86_400_000);
  const one = async <T extends { n: number }>(q: Promise<T[]>) => (await q)[0]?.n ?? 0;
  const [activeTenants, suspendedTenants, activeUsers, liveAgents, newTenants, signups] =
    await Promise.all([
      one(ctx.db.select({ n: count() }).from(tenants).where(eq(tenants.status, "active"))),
      one(ctx.db.select({ n: count() }).from(tenants).where(eq(tenants.status, "suspended"))),
      one(ctx.db.select({ n: count() }).from(tenantUsers).where(eq(tenantUsers.status, "active"))),
      one(ctx.db.select({ n: count() }).from(agents).where(eq(agents.status, "live"))),
      one(ctx.db.select({ n: count() }).from(tenants).where(gte(tenants.createdAt, weekAgo))),
      one(
        ctx.db
          .select({ n: count() })
          .from(auditLogs)
          .where(
            and(eq(auditLogs.action, "invitation.accepted"), gte(auditLogs.createdAt, weekAgo)),
          ),
      ),
    ]);
  return {
    activeTenants,
    suspendedTenants,
    activeUsers,
    liveAgents,
    newTenantsThisWeek: newTenants,
    signupsThisWeek: signups,
  };
}
