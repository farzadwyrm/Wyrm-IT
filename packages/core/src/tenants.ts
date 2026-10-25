import { createHash, randomBytes } from "node:crypto";
import { assertCan, check, ForbiddenError } from "@wyrm/auth";
import { agents, invitations, roles, tenants, tenantUsers } from "@wyrm/db";
import { and, count, desc, eq, ilike, isNull, or, type SQL } from "drizzle-orm";
import { audit } from "./audit";
import { type Ctx, DomainError, guarded } from "./context";

export const hashToken = (token: string) => createHash("sha256").update(token).digest("hex");
export const newToken = () => randomBytes(32).toString("base64url");

const PLANS = ["pilot", "starter", "growth", "enterprise"] as const;
export type Plan = (typeof PLANS)[number];

export async function listTenants(
  ctx: Ctx,
  filter: {
    search?: string;
    status?: "active" | "suspended";
    limit?: number;
    offset?: number;
  } = {},
) {
  assertCan(ctx.actor, "tenants.view");
  const where: SQL[] = [];
  if (filter.status) where.push(eq(tenants.status, filter.status));
  if (filter.search) {
    const q = `%${filter.search.replace(/[%_]/g, "")}%`;
    const cond = or(ilike(tenants.name, q), ilike(tenants.slug, q));
    if (cond) where.push(cond);
  }
  const rows = await ctx.db
    .select()
    .from(tenants)
    .where(where.length ? and(...where) : undefined)
    .orderBy(desc(tenants.createdAt))
    .limit(Math.min(filter.limit ?? 25, 100))
    .offset(filter.offset ?? 0);
  const [{ total } = { total: 0 }] = await ctx.db
    .select({ total: count() })
    .from(tenants)
    .where(where.length ? and(...where) : undefined);
  return { rows, total };
}

export async function getTenant(ctx: Ctx, tenantId: string) {
  const actor = ctx.actor;
  if (actor?.kind === "platform") assertCan(actor, "tenants.view");
  else assertCan(actor, "staff.view", { tenantId }); // tenant staff may read their own org
  const [tenant] = await ctx.db.select().from(tenants).where(eq(tenants.id, tenantId));
  if (!tenant) throw new DomainError("not_found", "Organisation not found.");
  return tenant;
}

/**
 * Creates a customer organisation and invites its first Owner. Returns the invitation token
 * once (it is stored only as a hash) so the caller can email the link.
 */
export async function createTenant(
  ctx: Ctx,
  input: {
    name: string;
    slug: string;
    plan?: Plan;
    seatLimit?: number;
    agentLimit?: number;
    ownerEmail: string;
  },
) {
  assertCan(ctx.actor, "tenants.manage");
  const email = input.ownerEmail.trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
    throw new DomainError("bad_email", "Owner email doesn't look right.");
  const token = newToken();
  const result = await guarded(() =>
    ctx.db.transaction(async (tx) => {
      const [tenant] = await tx
        .insert(tenants)
        .values({
          name: input.name.trim(),
          slug: input.slug,
          plan: input.plan ?? "pilot",
          seatLimit: input.seatLimit ?? 5,
          agentLimit: input.agentLimit ?? 1,
        })
        .returning();
      if (!tenant) throw new Error("tenant insert failed");
      const [owner] = await tx
        .select()
        .from(roles)
        .where(and(eq(roles.key, "owner"), isNull(roles.tenantId)));
      if (!owner) throw new Error("owner role missing");
      const [invite] = await tx
        .insert(invitations)
        .values({
          tenantId: tenant.id,
          email,
          roleId: owner.id,
          tokenHash: hashToken(token),
          invitedBy: ctx.actor?.kind === "platform" ? ctx.actor.userId : null,
          expiresAt: new Date(Date.now() + 7 * 86_400_000),
        })
        .returning();
      await audit(
        ctx,
        {
          action: "tenant.created",
          tenantId: tenant.id,
          targetType: "tenant",
          targetId: tenant.id,
          after: tenant,
        },
        tx,
      );
      await audit(
        ctx,
        {
          action: "invitation.created",
          tenantId: tenant.id,
          targetType: "invitation",
          targetId: invite?.id,
          after: { email, role: "owner" },
        },
        tx,
      );
      return { tenant, invitationId: invite?.id ?? null };
    }),
  );
  return { ...result, token };
}

/** Plan and limits need tenants.plan (Billing); name and feature flags need tenants.manage. */
export async function updateTenant(
  ctx: Ctx,
  tenantId: string,
  patch: {
    name?: string;
    plan?: Plan;
    seatLimit?: number;
    agentLimit?: number;
    /** AI spend cap per month, USD millionths (2000000 = $2.00). */
    aiMonthlyBudgetMicros?: number;
    features?: Record<string, boolean>;
  },
) {
  const touchesPlan =
    patch.plan !== undefined ||
    patch.seatLimit !== undefined ||
    patch.agentLimit !== undefined ||
    patch.aiMonthlyBudgetMicros !== undefined;
  if (
    patch.agentLimit !== undefined &&
    (!Number.isInteger(patch.agentLimit) || patch.agentLimit < 0 || patch.agentLimit > 100)
  )
    throw new DomainError("bad_limit", "Agents must be a whole number from 0 to 100.");
  if (
    patch.aiMonthlyBudgetMicros !== undefined &&
    (!Number.isInteger(patch.aiMonthlyBudgetMicros) ||
      patch.aiMonthlyBudgetMicros < 0 ||
      patch.aiMonthlyBudgetMicros > 1_000_000_000)
  )
    throw new DomainError("bad_budget", "AI budget must be between $0 and $1,000 a month.");
  const touchesProfile = patch.name !== undefined || patch.features !== undefined;
  if (touchesPlan) assertCan(ctx.actor, "tenants.plan");
  if (touchesProfile) assertCan(ctx.actor, "tenants.manage");
  if (patch.plan && !PLANS.includes(patch.plan)) throw new DomainError("bad_plan", "Unknown plan.");
  return guarded(() =>
    ctx.db.transaction(async (tx) => {
      const [before] = await tx.select().from(tenants).where(eq(tenants.id, tenantId));
      if (!before) throw new DomainError("not_found", "Organisation not found.");
      if (patch.seatLimit !== undefined) {
        const [{ used } = { used: 0 }] = await tx
          .select({ used: count() })
          .from(tenantUsers)
          .where(and(eq(tenantUsers.tenantId, tenantId), eq(tenantUsers.status, "active")));
        if (patch.seatLimit < used) {
          throw new DomainError(
            "seat_limit",
            `This organisation already has ${used} active staff.`,
          );
        }
      }
      const [after] = await tx
        .update(tenants)
        .set(patch)
        .where(eq(tenants.id, tenantId))
        .returning();
      await audit(
        ctx,
        {
          action: "tenant.updated",
          tenantId,
          targetType: "tenant",
          targetId: tenantId,
          before,
          after,
        },
        tx,
      );
      return after;
    }),
  );
}

/** Suspend blocks every member and pauses agents (data kept); reactivate restores access. */
export async function setTenantStatus(ctx: Ctx, tenantId: string, status: "active" | "suspended") {
  assertCan(ctx.actor, "tenants.suspend");
  return ctx.db.transaction(async (tx) => {
    const [before] = await tx.select().from(tenants).where(eq(tenants.id, tenantId));
    if (!before) throw new DomainError("not_found", "Organisation not found.");
    const [after] = await tx
      .update(tenants)
      .set({ status })
      .where(eq(tenants.id, tenantId))
      .returning();
    await audit(
      ctx,
      {
        action: status === "suspended" ? "tenant.suspended" : "tenant.reactivated",
        tenantId,
        targetType: "tenant",
        targetId: tenantId,
        before: { status: before.status },
        after: { status },
      },
      tx,
    );
    return after;
  });
}

export async function deleteTenant(ctx: Ctx, tenantId: string, confirmSlug: string) {
  assertCan(ctx.actor, "tenants.delete");
  const [tenant] = await ctx.db.select().from(tenants).where(eq(tenants.id, tenantId));
  if (!tenant) throw new DomainError("not_found", "Organisation not found.");
  // Suspending first stops its agents and logins, so nothing is mid-conversation when it goes.
  if (tenant.status !== "suspended")
    throw new DomainError("not_suspended", "Suspend the client before deleting it.");
  if (tenant.slug !== confirmSlug)
    throw new DomainError("confirm", "Type the short name to confirm.");
  // The owner-protection trigger allows removal only together with the tenant itself.
  await ctx.db.transaction(async (tx) => {
    await audit(
      ctx,
      {
        action: "tenant.deleted",
        tenantId: null,
        targetType: "tenant",
        targetId: tenantId,
        before: tenant,
      },
      tx,
    );
    await tx.delete(tenants).where(eq(tenants.id, tenantId));
  });
}

/** Moves ownership to another active member; the old owner becomes an Admin. */
export async function transferOwnership(ctx: Ctx, tenantId: string, toTenantUserId: string) {
  const actor = ctx.actor;
  const allowed =
    actor?.kind === "platform"
      ? check(actor, "tenants.manage")
      : check(actor, "ownership.transfer", { tenantId });
  if (!allowed.allowed) throw new ForbiddenError("ownership.transfer", allowed.reason);
  return guarded(() =>
    ctx.db.transaction(async (tx) => {
      const [ownerRole] = await tx
        .select()
        .from(roles)
        .where(and(eq(roles.key, "owner"), isNull(roles.tenantId)));
      const [adminRole] = await tx
        .select()
        .from(roles)
        .where(and(eq(roles.key, "admin"), isNull(roles.tenantId)));
      const [current] = await tx
        .select()
        .from(tenantUsers)
        .where(and(eq(tenantUsers.tenantId, tenantId), eq(tenantUsers.isOwner, true)));
      const [next] = await tx
        .select()
        .from(tenantUsers)
        .where(and(eq(tenantUsers.id, toTenantUserId), eq(tenantUsers.tenantId, tenantId)));
      if (!ownerRole || !adminRole || !next)
        throw new DomainError("not_found", "Member not found in this organisation.");
      if (next.status !== "active")
        throw new DomainError("inactive", "The new owner must be an active member.");
      if (current)
        await tx
          .update(tenantUsers)
          .set({ roleId: adminRole.id })
          .where(eq(tenantUsers.id, current.id));
      await tx.update(tenantUsers).set({ roleId: ownerRole.id }).where(eq(tenantUsers.id, next.id));
      await audit(
        ctx,
        {
          action: "ownership.transferred",
          tenantId,
          targetType: "tenant_user",
          targetId: next.id,
          before: { owner: current?.email ?? null },
          after: { owner: next.email },
        },
        tx,
      );
    }),
  );
}

export async function tenantCounts(ctx: Ctx, tenantId: string) {
  const [{ staff } = { staff: 0 }] = await ctx.db
    .select({ staff: count() })
    .from(tenantUsers)
    .where(and(eq(tenantUsers.tenantId, tenantId), eq(tenantUsers.status, "active")));
  const [{ agentCount } = { agentCount: 0 }] = await ctx.db
    .select({ agentCount: count() })
    .from(agents)
    .where(eq(agents.tenantId, tenantId));
  return { staff, agents: agentCount };
}
