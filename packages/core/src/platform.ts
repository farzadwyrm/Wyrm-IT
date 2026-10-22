import { assertCan, checkPlatformStaffChange, ForbiddenError, type PlatformRole } from "@wyrm/auth";
import {
  agentLaunches,
  agents,
  approvals,
  auditLogs,
  calendarConnections,
  conversations,
  killSwitches,
  platformUsers,
  tenants,
  tenantUsers,
  usageDaily,
} from "@wyrm/db";
import {
  and,
  asc,
  count,
  eq,
  gte,
  ilike,
  isNotNull,
  isNull,
  ne,
  or,
  type SQL,
  sql,
} from "drizzle-orm";
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

export interface CustomerHealth {
  tenantId: string;
  name: string;
  slug: string;
  plan: string;
  status: string;
  agents: number;
  liveAgents: number;
  signedOff: number;
  conversations7d: number;
  handedOff7d: number;
  waiting: number;
  pendingApprovals: number;
  spendMonthMicros: number;
  budgetMicros: number;
  lastConversationAt: Date | null;
  calendarErrors: number;
  stopped: number;
}

/** One row per client for Wyrm's back office: setup, activity, what's waiting and spend. */
export async function customerHealth(ctx: Ctx, now = new Date()): Promise<CustomerHealth[]> {
  assertCan(ctx.actor, "platform.dashboard");
  const weekAgo = new Date(now.getTime() - 7 * 86_400_000);
  const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1))
    .toISOString()
    .slice(0, 10);
  const n = (filter?: SQL) => sql<number>`count(*) filter (where ${filter ?? sql`true`})::int`;
  // One query at a time (the pooled connection is small); a slow step is logged by name.
  const step = async <T>(label: string, query: PromiseLike<T>): Promise<T> => {
    const started = Date.now();
    console.info("customerHealth: step", label);
    const result = await query;
    const ms = Date.now() - started;
    if (ms > 1000) console.warn("customerHealth: slow step", label, ms);
    return result;
  };
  const list = await step(
    "tenants",
    ctx.db.select().from(tenants).orderBy(asc(tenants.name)).limit(200),
  );
  const agentRows = await step(
    "agents",
    ctx.db
      .select({ tenantId: agents.tenantId, all: n(), live: n(eq(agents.status, "live")) })
      .from(agents)
      .groupBy(agents.tenantId),
  );
  const convRows = await step(
    "conversations",
    ctx.db
      .select({
        tenantId: conversations.tenantId,
        week: n(gte(conversations.startedAt, weekAgo)),
        handedOff: n(
          and(gte(conversations.startedAt, weekAgo), eq(conversations.outcome, "handed_off")),
        ),
        waiting: n(sql`'needs_attention' = any(${conversations.flags})`),
        last: sql<Date | null>`max(${conversations.startedAt})`,
      })
      .from(conversations)
      .groupBy(conversations.tenantId),
  );
  const approvalRows = await step(
    "approvals",
    ctx.db
      .select({ tenantId: approvals.tenantId, pending: n() })
      .from(approvals)
      .where(eq(approvals.status, "pending"))
      .groupBy(approvals.tenantId),
  );
  const spendRows = await step(
    "usage",
    ctx.db
      .select({
        tenantId: usageDaily.tenantId,
        cost: sql<number>`coalesce(sum(${usageDaily.costMicros}), 0)::bigint`,
      })
      .from(usageDaily)
      .where(gte(usageDaily.day, monthStart))
      .groupBy(usageDaily.tenantId),
  );
  const launchRows = await step(
    "launches",
    ctx.db
      .select({
        tenantId: agentLaunches.tenantId,
        signed: n(isNotNull(agentLaunches.signedOffAt)),
      })
      .from(agentLaunches)
      .groupBy(agentLaunches.tenantId),
  );
  const calRows = await step(
    "calendar",
    ctx.db
      .select({
        tenantId: calendarConnections.tenantId,
        errors: n(ne(calendarConnections.status, "ok")),
      })
      .from(calendarConnections)
      .groupBy(calendarConnections.tenantId),
  );
  const switchRows = await step(
    "switches",
    ctx.db
      .select({ tenantId: killSwitches.tenantId, stopped: n() })
      .from(killSwitches)
      .where(isNull(killSwitches.clearedAt))
      .groupBy(killSwitches.tenantId),
  );
  const index = <T extends { tenantId: string | null }>(rows: T[]) =>
    new Map(rows.map((r) => [r.tenantId ?? "", r]));
  const [a, c, p, s, l, cal, sw] = [
    index(agentRows),
    index(convRows),
    index(approvalRows),
    index(spendRows),
    index(launchRows),
    index(calRows),
    index(switchRows),
  ];
  return list.map((t) => {
    const last = c.get(t.id)?.last;
    return {
      tenantId: t.id,
      name: t.name,
      slug: t.slug,
      plan: t.plan,
      status: t.status,
      agents: Number(a.get(t.id)?.all ?? 0),
      liveAgents: Number(a.get(t.id)?.live ?? 0),
      signedOff: Number(l.get(t.id)?.signed ?? 0),
      conversations7d: Number(c.get(t.id)?.week ?? 0),
      handedOff7d: Number(c.get(t.id)?.handedOff ?? 0),
      waiting: Number(c.get(t.id)?.waiting ?? 0),
      pendingApprovals: Number(p.get(t.id)?.pending ?? 0),
      spendMonthMicros: Number(s.get(t.id)?.cost ?? 0),
      budgetMicros: t.aiMonthlyBudgetMicros,
      lastConversationAt: last ? new Date(last) : null,
      calendarErrors: Number(cal.get(t.id)?.errors ?? 0),
      stopped: Number(sw.get(t.id)?.stopped ?? 0),
    };
  });
}
