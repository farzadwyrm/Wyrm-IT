import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  type Actor,
  assertCan,
  BUILT_IN_TENANT_ROLES,
  can,
  check,
  checkCustomRole,
  checkPlatformStaffChange,
  checkRoleChange,
  checkStaffLifecycle,
  ForbiddenError,
  type PlatformActor,
  type TenantActor,
  type TenantRoleInfo,
} from "./index";

const role = (key: keyof typeof BUILT_IN_TENANT_ROLES): TenantRoleInfo => ({
  id: `role-${key}`,
  key,
  rank: BUILT_IN_TENANT_ROLES[key].rank,
  permissions: BUILT_IN_TENANT_ROLES[key].permissions,
});

const tenantActor = (
  key: keyof typeof BUILT_IN_TENANT_ROLES,
  over: Partial<TenantActor> = {},
): TenantActor => ({
  kind: "tenant",
  userId: `user-${key}`,
  tenantUserId: `tu-${key}`,
  tenantId: "tenant-a",
  role: role(key),
  active: true,
  tenantActive: true,
  teamIds: [],
  managedTeamIds: [],
  agentAccess: {},
  ...over,
});

const platform = (r: PlatformActor["role"], over: Partial<PlatformActor> = {}): PlatformActor => ({
  kind: "platform",
  userId: `staff-${r}`,
  role: r,
  mfa: true,
  active: true,
  ...over,
});

describe("built-in roles match the database seed", () => {
  it("has the same permissions as migration 0003", () => {
    const sql = readFileSync(
      new URL("../../db/migrations/0003_two_tier_users.sql", import.meta.url),
      "utf8",
    );
    for (const [key, def] of Object.entries(BUILT_IN_TENANT_ROLES)) {
      const match = new RegExp(`\\('${key}', '[^']+', (\\d+), true, array\\[([^\\]]*)\\]`).exec(
        sql,
      );
      expect(match, key).not.toBeNull();
      expect(Number(match?.[1])).toBe(def.rank);
      const perms = (match?.[2] ?? "").match(/'([^']+)'/g)?.map((p) => p.slice(1, -1)) ?? [];
      expect(new Set(perms)).toEqual(new Set(def.permissions));
    }
  });
});

describe("tenant isolation", () => {
  it("never lets a tenant user act on another tenant", () => {
    const owner = tenantActor("owner");
    expect(can(owner, "staff.edit", { tenantId: "tenant-a" })).toBe(true);
    expect(check(owner, "staff.edit", { tenantId: "tenant-b" })).toEqual({
      allowed: false,
      reason: "other_tenant",
    });
  });

  it("blocks deactivated users and suspended tenants", () => {
    expect(check(tenantActor("owner", { active: false }), "staff.view").allowed).toBe(false);
    expect(check(tenantActor("owner", { tenantActive: false }), "staff.view")).toEqual({
      allowed: false,
      reason: "tenant_suspended",
    });
  });

  it("keeps platform and tenant permissions apart", () => {
    expect(can(tenantActor("owner"), "tenants.manage")).toBe(false);
    expect(check(platform("super_admin"), "staff.edit").allowed).toBe(false);
  });
});

describe("tenant roles", () => {
  it.each([
    ["owner", "billing.manage", true],
    ["admin", "billing.manage", false],
    ["admin", "ownership.transfer", false],
    ["admin", "staff.invite", true],
    ["manager", "staff.invite", false],
    ["member", "staff.view", false],
    ["viewer", "agents.use", false],
  ] as const)("%s → %s = %s", (key, permission, expected) => {
    expect(can(tenantActor(key), permission, { tenantId: "tenant-a" })).toBe(expected);
  });

  it("scopes managers to their own teams and agents", () => {
    const manager = tenantActor("manager", {
      managedTeamIds: ["team-1"],
      agentAccess: { "agent-1": "use" },
    });
    expect(can(manager, "teams.manage", { teamId: "team-1" })).toBe(true);
    expect(can(manager, "teams.manage", { teamId: "team-2" })).toBe(false);
    expect(can(manager, "agents.assign", { agentId: "agent-1" })).toBe(true);
    expect(can(manager, "agents.assign", { agentId: "agent-2" })).toBe(false);
  });

  it("uses per-agent access levels", () => {
    const member = tenantActor("member", { agentAccess: { a1: "use", a2: "view_logs" } });
    expect(can(member, "agents.use", { agentId: "a1" })).toBe(true);
    expect(can(member, "agents.use", { agentId: "a2" })).toBe(false);
    expect(can(member, "agents.logs", { agentId: "a2" })).toBe(true);
    expect(can(member, "agents.configure", { agentId: "a1" })).toBe(false);
    expect(can(member, "agents.use", { agentId: "a3" })).toBe(false);
    expect(can(tenantActor("admin"), "agents.configure", { agentId: "a3" })).toBe(true);
  });
});

describe("platform roles", () => {
  it.each([
    ["super_admin", "platform_staff.manage_super", true],
    ["platform_admin", "platform_staff.manage_super", false],
    ["platform_admin", "tenants.suspend", true],
    ["support", "tenants.view", true],
    ["support", "tenants.manage", false],
    ["support", "impersonate", true],
    ["billing", "tenants.plan", true],
    ["billing", "tenant_users.view", false],
  ] as const)("%s → %s = %s", (r, permission, expected) => {
    expect(can(platform(r), permission)).toBe(expected);
  });

  it("requires MFA for all platform actions", () => {
    expect(check(platform("super_admin", { mfa: false }), "tenants.view")).toEqual({
      allowed: false,
      reason: "mfa_required",
    });
  });
});

describe("view as (impersonation)", () => {
  const session = (staff: PlatformActor, readOnly: boolean, minutes = 30): Actor => ({
    kind: "impersonating",
    platform: staff,
    as: tenantActor("owner"),
    readOnly,
    sessionId: "s1",
    expiresAt: new Date(Date.now() + minutes * 60_000),
  });

  it("is read-only for Support", () => {
    const s = session(platform("support"), true);
    expect(can(s, "staff.view", { tenantId: "tenant-a" })).toBe(true);
    expect(check(s, "staff.edit", { tenantId: "tenant-a" })).toEqual({
      allowed: false,
      reason: "view_as_read_only",
    });
  });

  it("lets admins act with the tenant user's permissions, never more", () => {
    const s = session(platform("platform_admin"), false);
    expect(can(s, "staff.edit", { tenantId: "tenant-a" })).toBe(true);
    expect(can(s, "staff.edit", { tenantId: "tenant-b" })).toBe(false);
  });

  it("ends when the time limit passes", () => {
    expect(check(session(platform("super_admin"), false, -1), "staff.view")).toEqual({
      allowed: false,
      reason: "view_as_expired",
    });
  });

  it("is refused for staff without the impersonate permission", () => {
    expect(can(session(platform("billing"), true), "staff.view", { tenantId: "tenant-a" })).toBe(
      false,
    );
  });
});

describe("no privilege escalation", () => {
  const change = (
    actor: Actor,
    newRole: TenantRoleInfo,
    target: { userId: string; currentRole: TenantRoleInfo } | null,
  ) => checkRoleChange(actor, { tenantId: "tenant-a", newRole, target });

  it("lets admins grant roles at or below their own", () => {
    const admin = tenantActor("admin");
    expect(change(admin, role("member"), null).allowed).toBe(true);
    expect(change(admin, role("admin"), null).allowed).toBe(true);
    expect(
      change(admin, role("manager"), { userId: "u2", currentRole: role("member") }).allowed,
    ).toBe(true);
  });

  it("never grants owner, never above your own rank", () => {
    expect(change(tenantActor("owner"), role("owner"), null)).toEqual({
      allowed: false,
      reason: "use_ownership_transfer",
    });
    const manager = tenantActor("manager", {
      role: { ...role("manager"), permissions: [...role("manager").permissions, "staff.invite"] },
    });
    expect(change(manager, role("admin"), null)).toEqual({
      allowed: false,
      reason: "role_above_yours",
    });
  });

  it("can't change your own role or anyone ranked at or above you", () => {
    const admin = tenantActor("admin");
    expect(
      change(admin, role("member"), { userId: admin.userId, currentRole: role("admin") }).allowed,
    ).toBe(false);
    expect(change(admin, role("member"), { userId: "u9", currentRole: role("admin") })).toEqual({
      allowed: false,
      reason: "target_outranks_you",
    });
  });

  it("protects the owner and yourself from deactivation", () => {
    const admin = tenantActor("admin");
    const target = (k: keyof typeof BUILT_IN_TENANT_ROLES, userId = "u2") => ({
      tenantId: "tenant-a",
      target: { userId, role: role(k) },
    });
    expect(checkStaffLifecycle(admin, "deactivate", target("member")).allowed).toBe(true);
    expect(checkStaffLifecycle(admin, "deactivate", target("owner"))).toEqual({
      allowed: false,
      reason: "owner_protected",
    });
    expect(checkStaffLifecycle(admin, "remove", target("admin", admin.userId)).allowed).toBe(false);
    expect(
      checkStaffLifecycle(platform("platform_admin"), "deactivate", target("admin")).allowed,
    ).toBe(true);
    expect(checkStaffLifecycle(platform("support"), "deactivate", target("member")).allowed).toBe(
      false,
    );
  });

  it("limits custom roles to your own permissions, below your rank, if the plan allows", () => {
    const admin = tenantActor("admin");
    const input = {
      tenantId: "tenant-a",
      rank: 25,
      permissions: ["agents.use", "staff.view"],
      planAllows: true,
    };
    expect(checkCustomRole(admin, input).allowed).toBe(true);
    expect(checkCustomRole(admin, { ...input, planAllows: false }).allowed).toBe(false);
    expect(checkCustomRole(admin, { ...input, permissions: ["billing.manage"] }).allowed).toBe(
      false,
    );
    expect(checkCustomRole(admin, { ...input, rank: 40 }).allowed).toBe(false);
  });

  it("keeps Super Admins out of Platform Admins' reach", () => {
    const pa = platform("platform_admin");
    expect(checkPlatformStaffChange(pa, { newRole: "support", target: null }).allowed).toBe(true);
    expect(checkPlatformStaffChange(pa, { newRole: "super_admin", target: null }).allowed).toBe(
      false,
    );
    expect(
      checkPlatformStaffChange(pa, {
        newRole: "support",
        target: { userId: "x", role: "super_admin" },
      }).allowed,
    ).toBe(false);
    expect(
      checkPlatformStaffChange(platform("super_admin"), { newRole: "super_admin", target: null })
        .allowed,
    ).toBe(true);
  });
});

describe("assertCan", () => {
  it("throws a typed error with the reason", () => {
    expect(() => assertCan(null, "staff.view")).toThrow(ForbiddenError);
    expect(() => assertCan(tenantActor("member"), "staff.view")).toThrow(/missing_permission/);
  });
});
