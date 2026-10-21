import { assertCan, check, checkCustomRole, ForbiddenError, isTenantPermission } from "@wyrm/auth";
import { roles, tenants, tenantUsers } from "@wyrm/db";
import { and, asc, count, desc, eq, isNull, or } from "drizzle-orm";
import { audit } from "./audit";
import { type Ctx, DomainError, guarded } from "./context";

/** Custom roles are part of the Growth and Enterprise plans, or a per-tenant feature flag. */
export const customRolesAllowed = (tenant: { plan: string; features: unknown }) =>
  tenant.plan === "growth" ||
  tenant.plan === "enterprise" ||
  (tenant.features as Record<string, unknown>)?.custom_roles === true;

export async function listRoles(ctx: Ctx, tenantId: string) {
  if (ctx.actor?.kind === "platform") assertCan(ctx.actor, "tenant_users.view");
  else if (!check(ctx.actor, "roles.view", { tenantId }).allowed)
    assertCan(ctx.actor, "staff.invite", { tenantId });
  return ctx.db
    .select()
    .from(roles)
    .where(or(isNull(roles.tenantId), eq(roles.tenantId, tenantId)))
    .orderBy(desc(roles.rank), asc(roles.name));
}

export async function createCustomRole(
  ctx: Ctx,
  input: { tenantId: string; name: string; rank: number; permissions: string[] },
) {
  const [tenant] = await ctx.db.select().from(tenants).where(eq(tenants.id, input.tenantId));
  if (!tenant) throw new DomainError("not_found", "Organisation not found.");
  const permissions = [...new Set(input.permissions)].filter(isTenantPermission);
  const decision =
    ctx.actor?.kind === "platform"
      ? check(ctx.actor, "tenant_users.manage")
      : checkCustomRole(ctx.actor, {
          tenantId: input.tenantId,
          rank: input.rank,
          permissions,
          planAllows: customRolesAllowed(tenant),
        });
  if (!decision.allowed) throw new ForbiddenError("roles.manage", decision.reason);
  if (permissions.includes("ownership.transfer"))
    throw new DomainError("bad_permission", "Ownership can't be part of a custom role.");
  const key =
    input.name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "_")
      .replace(/^_+|_+$/g, "")
      .slice(0, 40) || "custom";
  const [role] = await guarded(() =>
    ctx.db
      .insert(roles)
      .values({
        tenantId: input.tenantId,
        key,
        name: input.name.trim(),
        rank: Math.min(input.rank, 49),
        permissions,
        builtIn: false,
      })
      .returning(),
  );
  await audit(ctx, {
    action: "role.created",
    tenantId: input.tenantId,
    targetType: "role",
    targetId: role?.id,
    after: role,
  });
  return role;
}

export async function deleteCustomRole(ctx: Ctx, tenantId: string, roleId: string) {
  if (ctx.actor?.kind === "platform") assertCan(ctx.actor, "tenant_users.manage");
  else assertCan(ctx.actor, "roles.manage", { tenantId });
  const [{ inUse } = { inUse: 0 }] = await ctx.db
    .select({ inUse: count() })
    .from(tenantUsers)
    .where(eq(tenantUsers.roleId, roleId));
  if (inUse > 0) throw new DomainError("role_in_use", "Move people to another role first.");
  const [role] = await ctx.db
    .delete(roles)
    .where(and(eq(roles.id, roleId), eq(roles.tenantId, tenantId), eq(roles.builtIn, false)))
    .returning();
  if (!role) throw new DomainError("not_found", "Custom role not found.");
  await audit(ctx, {
    action: "role.deleted",
    tenantId,
    targetType: "role",
    targetId: roleId,
    before: role,
  });
}
