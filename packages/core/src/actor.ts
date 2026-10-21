import type { Actor, TenantActor } from "@wyrm/auth";
import {
  agentAccess,
  impersonationSessions,
  platformUsers,
  roles,
  teamMembers,
  tenants,
  tenantUsers,
} from "@wyrm/db";
import { and, eq, gt, inArray, isNull, or } from "drizzle-orm";
import type { Db } from "./context";

/** Builds the tenant side of an actor for one membership (the "view as" target too). */
export async function loadTenantActor(db: Db, tenantUserId: string): Promise<TenantActor | null> {
  const [row] = await db
    .select({ tu: tenantUsers, role: roles, tenant: tenants })
    .from(tenantUsers)
    .innerJoin(roles, eq(roles.id, tenantUsers.roleId))
    .innerJoin(tenants, eq(tenants.id, tenantUsers.tenantId))
    .where(eq(tenantUsers.id, tenantUserId));
  if (!row) return null;

  const teams = await db
    .select({ teamId: teamMembers.teamId, isManager: teamMembers.isManager })
    .from(teamMembers)
    .where(eq(teamMembers.tenantUserId, tenantUserId));
  const teamIds = teams.map((t) => t.teamId);

  const subjects = [
    and(eq(agentAccess.subjectType, "user"), eq(agentAccess.subjectId, tenantUserId)),
    ...(teamIds.length
      ? [and(eq(agentAccess.subjectType, "team"), inArray(agentAccess.subjectId, teamIds))]
      : []),
  ];
  const grants = await db
    .select({ agentId: agentAccess.agentId, level: agentAccess.level })
    .from(agentAccess)
    .where(and(eq(agentAccess.tenantId, row.tu.tenantId), or(...subjects)));
  const rank = { view_logs: 1, use: 2, configure: 3 } as const;
  const access: Record<string, "use" | "configure" | "view_logs"> = {};
  for (const g of grants) {
    const current = access[g.agentId];
    if (!current || rank[g.level] > rank[current]) access[g.agentId] = g.level;
  }

  return {
    kind: "tenant",
    userId: row.tu.userId,
    tenantUserId: row.tu.id,
    tenantId: row.tu.tenantId,
    role: {
      id: row.role.id,
      key: row.role.key,
      rank: row.role.rank,
      permissions: row.role.permissions,
    },
    active: row.tu.status === "active",
    tenantActive: row.tenant.status === "active",
    teamIds,
    managedTeamIds: teams.filter((t) => t.isManager).map((t) => t.teamId),
    agentAccess: access,
  };
}

/** The organisations a customer login belongs to (active memberships of active tenants). */
export async function listMyTenants(db: Db, userId: string) {
  return db
    .select({
      tenantUserId: tenantUsers.id,
      tenantId: tenants.id,
      name: tenants.name,
      slug: tenants.slug,
      roleName: roles.name,
    })
    .from(tenantUsers)
    .innerJoin(tenants, eq(tenants.id, tenantUsers.tenantId))
    .innerJoin(roles, eq(roles.id, tenantUsers.roleId))
    .where(
      and(
        eq(tenantUsers.userId, userId),
        eq(tenantUsers.status, "active"),
        eq(tenants.status, "active"),
      ),
    )
    .orderBy(tenants.name);
}

/**
 * Who is acting, from verified session facts. Wyrm staff get a platform actor (or a "view as"
 * actor while a session is open); customers get the tenant actor for the chosen organisation
 * (default: their first). Returns null for logins with no active access: e.g. every member of
 * a suspended tenant, which is how suspended tenants are locked out.
 */
export async function loadActor(
  db: Db,
  input: {
    userId: string;
    mfa: boolean;
    tenantId?: string | null;
    viewAsSessionId?: string | null;
  },
): Promise<Actor | null> {
  const [staff] = await db.select().from(platformUsers).where(eq(platformUsers.id, input.userId));
  if (staff) {
    const platform = {
      kind: "platform" as const,
      userId: staff.id,
      role: staff.platformRole,
      mfa: input.mfa,
      active: staff.status === "active",
    };
    if (input.viewAsSessionId) {
      const [session] = await db
        .select()
        .from(impersonationSessions)
        .where(
          and(
            eq(impersonationSessions.id, input.viewAsSessionId),
            eq(impersonationSessions.platformUserId, staff.id),
            isNull(impersonationSessions.endedAt),
            gt(impersonationSessions.expiresAt, new Date()),
          ),
        );
      const as = session ? await loadTenantActor(db, session.tenantUserId) : null;
      if (session && as) {
        return {
          kind: "impersonating",
          platform,
          as,
          readOnly: session.readOnly,
          sessionId: session.id,
          expiresAt: session.expiresAt,
        };
      }
    }
    return platform;
  }

  const mine = await listMyTenants(db, input.userId);
  const chosen = mine.find((m) => m.tenantId === input.tenantId) ?? mine[0];
  return chosen ? loadTenantActor(db, chosen.tenantUserId) : null;
}
