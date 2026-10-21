/**
 * Every permission in Wyrm, in one place. Tenant permission names match the `roles.permissions`
 * values in packages/db/migrations/0003_two_tier_users.sql (tested).
 */

export const TENANT_PERMISSIONS = [
  "staff.view",
  "staff.invite",
  "staff.edit",
  "staff.deactivate",
  "staff.remove",
  "roles.view",
  "roles.manage",
  "teams.view",
  "teams.manage",
  "teams.manage_own",
  "agents.view_all",
  "agents.use",
  "agents.configure",
  "agents.logs",
  "agents.assign",
  "agents.assign_own",
  "security.view",
  "security.manage",
  "audit.view",
  "billing.view",
  "billing.manage",
  "ownership.transfer",
] as const;
export type TenantPermission = (typeof TENANT_PERMISSIONS)[number];

export const PLATFORM_PERMISSIONS = [
  "platform.dashboard",
  "tenants.view",
  "tenants.manage",
  "tenants.suspend",
  "tenants.delete",
  "tenants.plan",
  "tenant_users.view",
  "tenant_users.manage",
  "platform_agents.view",
  "platform_agents.manage",
  "platform_staff.view",
  "platform_staff.manage",
  "platform_staff.manage_super",
  "impersonate",
  "platform_audit.view",
  "platform_settings.manage",
] as const;
export type PlatformPermission = (typeof PLATFORM_PERMISSIONS)[number];

export type Permission = TenantPermission | PlatformPermission;

export const PLATFORM_ROLES = ["super_admin", "platform_admin", "support", "billing"] as const;
export type PlatformRole = (typeof PLATFORM_ROLES)[number];

const ALL_PLATFORM = [...PLATFORM_PERMISSIONS];

export const PLATFORM_ROLE_PERMISSIONS: Record<PlatformRole, readonly PlatformPermission[]> = {
  super_admin: ALL_PLATFORM,
  platform_admin: ALL_PLATFORM.filter(
    (p) => p !== "platform_staff.manage_super" && p !== "platform_settings.manage",
  ),
  support: [
    "platform.dashboard",
    "tenants.view",
    "tenant_users.view",
    "platform_agents.view",
    "platform_staff.view",
    "impersonate",
    "platform_audit.view",
  ],
  billing: ["platform.dashboard", "tenants.view", "tenants.plan"],
};

export const PLATFORM_ROLE_LABELS: Record<PlatformRole, string> = {
  super_admin: "Super Admin",
  platform_admin: "Platform Admin",
  support: "Support",
  billing: "Billing",
};

/** Built-in tenant roles, highest first. Must match the seed rows in migration 0003. */
export const BUILT_IN_TENANT_ROLES = {
  owner: {
    name: "Owner",
    rank: 50,
    permissions: TENANT_PERMISSIONS.filter((p) => !p.endsWith("_own")),
  },
  admin: {
    name: "Admin",
    rank: 40,
    permissions: TENANT_PERMISSIONS.filter(
      (p) => !p.endsWith("_own") && !p.startsWith("billing.") && p !== "ownership.transfer",
    ),
  },
  manager: {
    name: "Manager",
    rank: 30,
    permissions: [
      "staff.view",
      "teams.view",
      "teams.manage_own",
      "agents.use",
      "agents.logs",
      "agents.assign_own",
    ] as TenantPermission[],
  },
  member: { name: "Member", rank: 20, permissions: ["agents.use"] as TenantPermission[] },
  viewer: { name: "Viewer", rank: 10, permissions: ["agents.logs"] as TenantPermission[] },
} as const;
export type BuiltInTenantRole = keyof typeof BUILT_IN_TENANT_ROLES;

/** Permissions a "view as" session may use when it is read-only. */
export const READ_ONLY_TENANT_PERMISSIONS: readonly TenantPermission[] = [
  "staff.view",
  "roles.view",
  "teams.view",
  "agents.view_all",
  "agents.logs",
  "security.view",
  "audit.view",
  "billing.view",
];

export const isTenantPermission = (p: string): p is TenantPermission =>
  (TENANT_PERMISSIONS as readonly string[]).includes(p);
export const isPlatformPermission = (p: string): p is PlatformPermission =>
  (PLATFORM_PERMISSIONS as readonly string[]).includes(p);
