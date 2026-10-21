import { assertCan, check, ForbiddenError } from "@wyrm/auth";
import { teamMembers, teams, tenantUsers } from "@wyrm/db";
import { and, asc, eq } from "drizzle-orm";
import { audit } from "./audit";
import { type Ctx, DomainError, guarded } from "./context";

function assertTeams(ctx: Ctx, tenantId: string, teamId?: string) {
  const decision =
    ctx.actor?.kind === "platform"
      ? check(ctx.actor, "tenant_users.manage")
      : check(ctx.actor, "teams.manage", { tenantId, ...(teamId ? { teamId } : {}) });
  if (!decision.allowed) throw new ForbiddenError("teams.manage", decision.reason);
}

export async function listTeams(ctx: Ctx, tenantId: string) {
  if (ctx.actor?.kind === "platform") assertCan(ctx.actor, "tenant_users.view");
  else assertCan(ctx.actor, "teams.view", { tenantId });
  const rows = await ctx.db
    .select()
    .from(teams)
    .where(eq(teams.tenantId, tenantId))
    .orderBy(asc(teams.name));
  const members = await ctx.db
    .select({
      teamId: teamMembers.teamId,
      tenantUserId: teamMembers.tenantUserId,
      isManager: teamMembers.isManager,
      email: tenantUsers.email,
    })
    .from(teamMembers)
    .innerJoin(tenantUsers, eq(tenantUsers.id, teamMembers.tenantUserId))
    .where(eq(teamMembers.tenantId, tenantId));
  return rows.map((t) => ({ ...t, members: members.filter((m) => m.teamId === t.id) }));
}

/** Creating, renaming and deleting teams needs full teams.manage (not just your own teams). */
export async function createTeam(ctx: Ctx, tenantId: string, name: string) {
  assertTeams(ctx, tenantId);
  const [team] = await guarded(() =>
    ctx.db.insert(teams).values({ tenantId, name: name.trim() }).returning(),
  );
  await audit(ctx, {
    action: "team.created",
    tenantId,
    targetType: "team",
    targetId: team?.id,
    after: { name },
  });
  return team;
}

export async function renameTeam(ctx: Ctx, tenantId: string, teamId: string, name: string) {
  assertTeams(ctx, tenantId);
  const [team] = await guarded(() =>
    ctx.db
      .update(teams)
      .set({ name: name.trim() })
      .where(and(eq(teams.id, teamId), eq(teams.tenantId, tenantId)))
      .returning(),
  );
  if (!team) throw new DomainError("not_found", "Team not found.");
  await audit(ctx, {
    action: "team.renamed",
    tenantId,
    targetType: "team",
    targetId: teamId,
    after: { name },
  });
}

export async function deleteTeam(ctx: Ctx, tenantId: string, teamId: string) {
  assertTeams(ctx, tenantId);
  const [team] = await ctx.db
    .delete(teams)
    .where(and(eq(teams.id, teamId), eq(teams.tenantId, tenantId)))
    .returning();
  if (!team) throw new DomainError("not_found", "Team not found.");
  await audit(ctx, {
    action: "team.deleted",
    tenantId,
    targetType: "team",
    targetId: teamId,
    before: { name: team.name },
  });
}

/** Managers may add or remove members of the teams they manage. */
export async function setTeamMember(
  ctx: Ctx,
  input: {
    tenantId: string;
    teamId: string;
    tenantUserId: string;
    member: boolean;
    isManager?: boolean;
  },
) {
  assertTeams(ctx, input.tenantId, input.teamId);
  if (input.isManager !== undefined) assertTeams(ctx, input.tenantId); // only full team admins pick managers
  if (input.member) {
    await guarded(() =>
      ctx.db
        .insert(teamMembers)
        .values({
          teamId: input.teamId,
          tenantUserId: input.tenantUserId,
          tenantId: input.tenantId,
          isManager: input.isManager ?? false,
        })
        .onConflictDoUpdate({
          target: [teamMembers.teamId, teamMembers.tenantUserId],
          set: { isManager: input.isManager ?? false },
        }),
    );
  } else {
    await ctx.db
      .delete(teamMembers)
      .where(
        and(
          eq(teamMembers.teamId, input.teamId),
          eq(teamMembers.tenantUserId, input.tenantUserId),
          eq(teamMembers.tenantId, input.tenantId),
        ),
      );
  }
  await audit(ctx, {
    action: input.member ? "team.member_added" : "team.member_removed",
    tenantId: input.tenantId,
    targetType: "team",
    targetId: input.teamId,
    after: { tenantUserId: input.tenantUserId, isManager: input.isManager ?? false },
  });
}
