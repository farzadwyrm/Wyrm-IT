import { type Actor, check, type Decision, type TenantActor, type TenantRoleInfo } from "./can";
import type { PlatformRole, TenantPermission } from "./permissions";

const deny = (reason: string): Decision => ({ allowed: false, reason });

/** True if `held` includes `p`, or the broader version of a scoped `*_own` permission. */
const covers = (held: readonly string[], p: string) =>
  held.includes(p) || (p.endsWith("_own") && held.includes(p.slice(0, -4)));
const allow: Decision = { allowed: true };

/** The tenant identity behind an actor (the "view as" user when impersonating). */
const tenantSide = (actor: Actor): TenantActor | null =>
  actor.kind === "tenant" ? actor : actor.kind === "impersonating" ? actor.as : null;

/**
 * May `actor` give `target` (currently `currentRole`, or a new invitee) the role `newRole`?
 * Rules: nobody grants Owner (only ownership transfer does); you can't change your own role;
 * you can only change people ranked below you; you can only grant roles at or below your own
 * rank whose permissions you hold yourself. Wyrm platform admins may set any non-owner role.
 */
export function checkRoleChange(
  actor: Actor | null,
  input: {
    tenantId: string;
    newRole: TenantRoleInfo;
    /** Null for a new invitation. */
    target: { userId: string; currentRole: TenantRoleInfo } | null;
  },
): Decision {
  if (!actor) return deny("signed_out");
  if (input.newRole.key === "owner") return deny("use_ownership_transfer");
  // Wyrm staff manage customer users through their platform permission.
  if (actor.kind === "platform") return check(actor, "tenant_users.manage");

  const permission = input.target ? "staff.edit" : "staff.invite";
  const base = check(actor, permission, { tenantId: input.tenantId });
  if (!base.allowed) return base;

  const me = tenantSide(actor);
  if (!me) return deny("no_tenant_identity");
  if (input.target?.userId === me.userId) return deny("cannot_change_own_role");
  if (input.target && input.target.currentRole.rank >= me.role.rank)
    return deny("target_outranks_you");
  if (input.newRole.rank > me.role.rank) return deny("role_above_yours");
  const missing = input.newRole.permissions.filter((p) => !covers(me.role.permissions, p));
  if (missing.length > 0) return deny("role_has_permissions_you_lack");
  return allow;
}

/** May `actor` deactivate, reactivate or remove `target`? Never the owner, never yourself. */
export function checkStaffLifecycle(
  actor: Actor | null,
  action: "deactivate" | "reactivate" | "remove",
  input: { tenantId: string; target: { userId: string; role: TenantRoleInfo } },
): Decision {
  if (!actor) return deny("signed_out");
  if (input.target.role.key === "owner") return deny("owner_protected");
  if (actor.kind === "platform") return check(actor, "tenant_users.manage");
  const permission: TenantPermission = action === "remove" ? "staff.remove" : "staff.deactivate";
  const base = check(actor, permission, { tenantId: input.tenantId });
  if (!base.allowed) return base;
  const me = tenantSide(actor);
  if (me) {
    if (input.target.userId === me.userId) return deny("cannot_change_yourself");
    if (input.target.role.rank >= me.role.rank) return deny("target_outranks_you");
  }
  return allow;
}

/** Custom roles: only permissions you hold yourself, ranked below you, and only if the plan allows. */
export function checkCustomRole(
  actor: Actor | null,
  input: { tenantId: string; rank: number; permissions: readonly string[]; planAllows: boolean },
): Decision {
  if (!actor) return deny("signed_out");
  const base = check(actor, "roles.manage", { tenantId: input.tenantId });
  if (!base.allowed) return base;
  if (!input.planAllows) return deny("plan_does_not_include_custom_roles");
  if (input.rank >= 50) return deny("rank_too_high");
  const me = tenantSide(actor);
  if (me) {
    if (input.rank >= me.role.rank) return deny("role_above_yours");
    if (input.permissions.some((p) => !covers(me.role.permissions, p)))
      return deny("role_has_permissions_you_lack");
  }
  return allow;
}

/** Platform staff management: Platform Admins can't touch Super Admins or create them. */
export function checkPlatformStaffChange(
  actor: Actor | null,
  input: { newRole: PlatformRole; target: { userId: string; role: PlatformRole } | null },
): Decision {
  if (actor?.kind !== "platform") return deny("platform_only");
  const base = check(actor, "platform_staff.manage");
  if (!base.allowed) return base;
  const touchesSuper = input.newRole === "super_admin" || input.target?.role === "super_admin";
  if (touchesSuper && !check(actor, "platform_staff.manage_super").allowed) {
    return deny("only_super_admins_manage_super_admins");
  }
  if (input.target?.userId === actor.userId) return deny("cannot_change_own_role");
  return allow;
}
