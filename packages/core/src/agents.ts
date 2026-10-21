import { assertCan, check, ForbiddenError } from "@wyrm/auth";
import { agentAccess, agents, tenants } from "@wyrm/db";
import { and, asc, eq, inArray } from "drizzle-orm";
import { audit } from "./audit";
import { type Ctx, DomainError, guarded } from "./context";

export const AGENT_TYPES = [
  "receptionist",
  "inbox",
  "knowledge",
  "sales",
  "back_office",
  "support",
  "quote",
  "payment_reminder",
  "scheduling",
  "reporting",
  "reviews",
  "meeting",
] as const;
export type AgentType = (typeof AGENT_TYPES)[number];

/** Wyrm staff see every agent; tenant staff see all (agents.view_all) or only granted ones. */
export async function listAgents(ctx: Ctx, tenantId?: string) {
  const actor = ctx.actor;
  if (actor?.kind === "platform") {
    assertCan(actor, "platform_agents.view");
    return ctx.db
      .select({ agent: agents, tenantName: tenants.name })
      .from(agents)
      .innerJoin(tenants, eq(tenants.id, agents.tenantId))
      .where(tenantId ? eq(agents.tenantId, tenantId) : undefined)
      .orderBy(asc(tenants.name), asc(agents.name));
  }
  const me = actor?.kind === "impersonating" ? actor.as : actor;
  if (me?.kind !== "tenant" || (tenantId && tenantId !== me.tenantId)) {
    throw new ForbiddenError("agents.use", "other_tenant");
  }
  const decision = check(actor, "agents.use", { tenantId: me.tenantId });
  const logs = check(actor, "agents.logs", { tenantId: me.tenantId });
  if (!decision.allowed && !logs.allowed && Object.keys(me.agentAccess).length === 0) return [];
  const all = me.role.permissions.includes("agents.view_all");
  const ids = Object.keys(me.agentAccess);
  if (!all && ids.length === 0) return [];
  return ctx.db
    .select({ agent: agents, tenantName: tenants.name })
    .from(agents)
    .innerJoin(tenants, eq(tenants.id, agents.tenantId))
    .where(
      all
        ? eq(agents.tenantId, me.tenantId)
        : and(eq(agents.tenantId, me.tenantId), inArray(agents.id, ids)),
    )
    .orderBy(asc(agents.name));
}

/** Wyrm provisions agents for a tenant (counts against the agent limit). */
export async function provisionAgent(
  ctx: Ctx,
  input: { tenantId: string; name: string; type: AgentType },
) {
  assertCan(ctx.actor, "platform_agents.manage");
  if (!AGENT_TYPES.includes(input.type)) throw new DomainError("bad_type", "Unknown agent type.");
  const [agent] = await guarded(() =>
    ctx.db
      .insert(agents)
      .values({ tenantId: input.tenantId, name: input.name.trim(), type: input.type })
      .returning(),
  );
  await audit(ctx, {
    action: "agent.provisioned",
    tenantId: input.tenantId,
    targetType: "agent",
    targetId: agent?.id,
    after: agent,
  });
  return agent;
}

export async function revokeAgent(ctx: Ctx, tenantId: string, agentId: string) {
  assertCan(ctx.actor, "platform_agents.manage");
  const [agent] = await ctx.db
    .delete(agents)
    .where(and(eq(agents.id, agentId), eq(agents.tenantId, tenantId)))
    .returning();
  if (!agent) throw new DomainError("not_found", "Agent not found.");
  await audit(ctx, {
    action: "agent.revoked",
    tenantId,
    targetType: "agent",
    targetId: agentId,
    before: agent,
  });
}

/** Live / paused: Wyrm staff, or tenant staff who may configure that agent. */
export async function setAgentStatus(
  ctx: Ctx,
  input: { tenantId: string; agentId: string; status: "draft" | "live" | "paused" },
) {
  const decision =
    ctx.actor?.kind === "platform"
      ? check(ctx.actor, "platform_agents.manage")
      : check(ctx.actor, "agents.configure", { tenantId: input.tenantId, agentId: input.agentId });
  if (!decision.allowed) throw new ForbiddenError("agents.configure", decision.reason);
  const [tenant] = await ctx.db.select().from(tenants).where(eq(tenants.id, input.tenantId));
  if (input.status === "live" && tenant?.status !== "active") {
    throw new DomainError("tenant_suspended", "Agents of a suspended organisation stay paused.");
  }
  const [agent] = await ctx.db
    .update(agents)
    .set({ status: input.status })
    .where(and(eq(agents.id, input.agentId), eq(agents.tenantId, input.tenantId)))
    .returning();
  if (!agent) throw new DomainError("not_found", "Agent not found.");
  await audit(ctx, {
    action: "agent.status_changed",
    tenantId: input.tenantId,
    targetType: "agent",
    targetId: input.agentId,
    after: { status: input.status },
  });
}

export async function listAgentAccess(ctx: Ctx, tenantId: string, agentId: string) {
  if (ctx.actor?.kind === "platform") assertCan(ctx.actor, "platform_agents.view");
  else assertCan(ctx.actor, "agents.assign", { tenantId, agentId });
  return ctx.db
    .select()
    .from(agentAccess)
    .where(and(eq(agentAccess.agentId, agentId), eq(agentAccess.tenantId, tenantId)));
}

/** Grant or change access: Admins for any agent, Managers only for agents they can reach. */
export async function grantAgentAccess(
  ctx: Ctx,
  input: {
    tenantId: string;
    agentId: string;
    subjectType: "user" | "team";
    subjectId: string;
    level: "use" | "configure" | "view_logs";
  },
) {
  const decision =
    ctx.actor?.kind === "platform"
      ? check(ctx.actor, "platform_agents.manage")
      : check(ctx.actor, "agents.assign", { tenantId: input.tenantId, agentId: input.agentId });
  if (!decision.allowed) throw new ForbiddenError("agents.assign", decision.reason);
  // Managers can't hand out more than they have.
  const me =
    ctx.actor?.kind === "tenant"
      ? ctx.actor
      : ctx.actor?.kind === "impersonating"
        ? ctx.actor.as
        : null;
  if (me && !me.role.permissions.includes("agents.assign")) {
    const order = { view_logs: 1, use: 2, configure: 3 } as const;
    const mine = me.agentAccess[input.agentId];
    if (!mine || order[input.level] > order[mine])
      throw new ForbiddenError("agents.assign", "level_above_yours");
  }
  await guarded(() =>
    ctx.db
      .insert(agentAccess)
      .values(input)
      .onConflictDoUpdate({
        target: [agentAccess.agentId, agentAccess.subjectType, agentAccess.subjectId],
        set: { level: input.level },
      }),
  );
  await audit(ctx, {
    action: "agent.access_granted",
    tenantId: input.tenantId,
    targetType: "agent",
    targetId: input.agentId,
    after: { subject: `${input.subjectType}:${input.subjectId}`, level: input.level },
  });
}

export async function revokeAgentAccess(
  ctx: Ctx,
  input: { tenantId: string; agentId: string; subjectType: "user" | "team"; subjectId: string },
) {
  const decision =
    ctx.actor?.kind === "platform"
      ? check(ctx.actor, "platform_agents.manage")
      : check(ctx.actor, "agents.assign", { tenantId: input.tenantId, agentId: input.agentId });
  if (!decision.allowed) throw new ForbiddenError("agents.assign", decision.reason);
  await ctx.db
    .delete(agentAccess)
    .where(
      and(
        eq(agentAccess.agentId, input.agentId),
        eq(agentAccess.tenantId, input.tenantId),
        eq(agentAccess.subjectType, input.subjectType),
        eq(agentAccess.subjectId, input.subjectId),
      ),
    );
  await audit(ctx, {
    action: "agent.access_revoked",
    tenantId: input.tenantId,
    targetType: "agent",
    targetId: input.agentId,
    before: { subject: `${input.subjectType}:${input.subjectId}` },
  });
}
