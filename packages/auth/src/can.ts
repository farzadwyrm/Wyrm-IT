import {
  isPlatformPermission,
  isTenantPermission,
  type Permission,
  PLATFORM_ROLE_PERMISSIONS,
  type PlatformRole,
  READ_ONLY_TENANT_PERMISSIONS,
  type TenantPermission,
} from "./permissions";

/** Who is acting. Built once per request by the server from verified session data. */
export type Actor = PlatformActor | TenantActor | ImpersonatingActor;

export interface PlatformActor {
  kind: "platform";
  userId: string;
  role: PlatformRole;
  /** Signed in with a second factor in this session (Supabase AAL2). */
  mfa: boolean;
  active: boolean;
}

export interface TenantRoleInfo {
  id: string;
  key: string;
  rank: number;
  permissions: readonly string[];
}

export interface TenantActor {
  kind: "tenant";
  userId: string;
  tenantUserId: string;
  tenantId: string;
  role: TenantRoleInfo;
  active: boolean;
  tenantActive: boolean;
  /** Teams this user belongs to and the subset they manage. */
  teamIds: readonly string[];
  managedTeamIds: readonly string[];
  /** Agents this user can reach (direct or via a team), with the access level. */
  agentAccess: Readonly<Record<string, "use" | "configure" | "view_logs">>;
}

/** Wyrm staff viewing the app as a tenant user ("view as"). */
export interface ImpersonatingActor {
  kind: "impersonating";
  platform: PlatformActor;
  as: TenantActor;
  readOnly: boolean;
  sessionId: string;
  expiresAt: Date;
}

/** What the action touches. Tenant-scoped resources must carry their tenantId. */
export interface Resource {
  tenantId?: string;
  teamId?: string;
  agentId?: string;
}

export type Decision = { allowed: true } | { allowed: false; reason: string };

const allow: Decision = { allowed: true };
const deny = (reason: string): Decision => ({ allowed: false, reason });

function tenantDecision(
  actor: TenantActor,
  permission: TenantPermission,
  resource: Resource,
): Decision {
  if (!actor.active) return deny("account_deactivated");
  if (!actor.tenantActive) return deny("tenant_suspended");
  // Isolation: a tenant actor can only ever act inside its own tenant.
  if (resource.tenantId !== undefined && resource.tenantId !== actor.tenantId) {
    return deny("other_tenant");
  }
  const has = (p: string) => actor.role.permissions.includes(p);

  switch (permission) {
    case "teams.manage":
      if (has("teams.manage")) return allow;
      if (
        has("teams.manage_own") &&
        resource.teamId &&
        actor.managedTeamIds.includes(resource.teamId)
      )
        return allow;
      return deny("missing_permission");
    case "agents.assign":
      if (has("agents.assign")) return allow;
      if (has("agents.assign_own") && resource.agentId && actor.agentAccess[resource.agentId])
        return allow;
      return deny("missing_permission");
    case "agents.use":
    case "agents.configure":
    case "agents.logs": {
      if (!resource.agentId) return has(permission) ? allow : deny("missing_permission");
      if (has("agents.view_all") && has(permission)) return allow;
      const level = actor.agentAccess[resource.agentId];
      if (!level) return deny("no_agent_access");
      const levelGrants: Record<string, readonly string[]> = {
        configure: ["agents.use", "agents.configure", "agents.logs"],
        use: ["agents.use", "agents.logs"],
        view_logs: ["agents.logs"],
      };
      return levelGrants[level]?.includes(permission) ? allow : deny("agent_access_too_low");
    }
    default:
      return has(permission) ? allow : deny("missing_permission");
  }
}

/**
 * The central permission check. Every server action and API route calls this (never compare
 * role names elsewhere). Returns a reason when denied, for logs and error messages.
 */
export function check(
  actor: Actor | null,
  permission: Permission,
  resource: Resource = {},
): Decision {
  if (!actor) return deny("signed_out");

  if (actor.kind === "platform") {
    if (!actor.active) return deny("account_disabled");
    if (!isPlatformPermission(permission)) return deny("tenant_permission_needs_view_as");
    if (!actor.mfa) return deny("mfa_required");
    return PLATFORM_ROLE_PERMISSIONS[actor.role].includes(permission)
      ? allow
      : deny("missing_permission");
  }

  if (actor.kind === "impersonating") {
    if (actor.expiresAt.getTime() <= Date.now()) return deny("view_as_expired");
    if (!isTenantPermission(permission)) {
      // Platform permissions still come from the Wyrm staff member, not the tenant user.
      return check(actor.platform, permission, resource);
    }
    const staff = check(actor.platform, "impersonate");
    if (!staff.allowed) return staff;
    if (actor.readOnly && !READ_ONLY_TENANT_PERMISSIONS.includes(permission)) {
      return deny("view_as_read_only");
    }
    return tenantDecision(actor.as, permission, resource);
  }

  if (!isTenantPermission(permission)) return deny("platform_only");
  return tenantDecision(actor, permission, resource);
}

export const can = (actor: Actor | null, permission: Permission, resource?: Resource): boolean =>
  check(actor, permission, resource).allowed;

/** Throws a typed error when not allowed; for server actions. */
export class ForbiddenError extends Error {
  constructor(
    readonly permission: Permission,
    readonly reason: string,
  ) {
    super(`Not allowed: ${permission} (${reason})`);
    this.name = "ForbiddenError";
  }
}

export function assertCan(actor: Actor | null, permission: Permission, resource?: Resource): void {
  const decision = check(actor, permission, resource);
  if (!decision.allowed) throw new ForbiddenError(permission, decision.reason);
}
