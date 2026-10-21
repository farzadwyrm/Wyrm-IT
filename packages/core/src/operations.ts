import { createHash } from "node:crypto";
import { type Actor, check, ForbiddenError, type Permission } from "@wyrm/auth";
import {
  agentDecisions,
  agentSettingsVersions,
  agents,
  agentTests,
  approvals,
  conversationMessages,
  conversations,
  corrections,
  killSwitches,
  type OUTCOMES,
  tenants,
  usageDaily,
} from "@wyrm/db";
import {
  and,
  asc,
  desc,
  eq,
  gte,
  ilike,
  inArray,
  isNull,
  lt,
  or,
  type SQL,
  sql,
} from "drizzle-orm";
import { audit } from "./audit";
import { type Ctx, DomainError, guarded } from "./context";

type Outcome = (typeof OUTCOMES)[number];

/** The tenant side of an actor (a "view as" session acts as its target). */
function tenantSide(actor: Actor | null) {
  if (actor?.kind === "tenant") return actor;
  if (actor?.kind === "impersonating") return actor.as;
  return null;
}

/** Per-agent check that mirrors `can()`: Wyrm staff use platform permissions. */
export function agentGate(
  ctx: Ctx,
  permission: Extract<Permission, "agents.logs" | "agents.use" | "agents.configure">,
  tenantId: string,
  agentId: string | null,
) {
  const platformPermission =
    permission === "agents.logs" ? "platform_agents.view" : "platform_agents.manage";
  const decision =
    ctx.actor?.kind === "platform"
      ? check(ctx.actor, platformPermission)
      : check(ctx.actor, permission, agentId ? { tenantId, agentId } : { tenantId });
  if (!decision.allowed) throw new ForbiddenError(permission, decision.reason);
}

/** Agents whose conversations this actor may read: null = all of the tenant's. */
export function visibleAgentIds(ctx: Ctx, tenantId: string): string[] | null {
  if (ctx.actor?.kind === "platform") {
    agentGate(ctx, "agents.logs", tenantId, null);
    return null;
  }
  const me = tenantSide(ctx.actor);
  if (!me || me.tenantId !== tenantId) throw new ForbiddenError("agents.logs", "other_tenant");
  const all =
    me.role.permissions.includes("agents.view_all") && me.role.permissions.includes("agents.logs");
  return all ? null : Object.keys(me.agentAccess);
}

function agentScope(column: typeof conversations.agentId, ids: string[] | null): SQL | undefined {
  if (ids === null) return undefined;
  return ids.length ? inArray(column, ids) : sql`false`;
}

// ---------------------------------------------------------------------------------------------
// Conversations

export interface ConversationFilter {
  agentId?: string;
  outcome?: Outcome;
  channel?: (typeof conversations.channel.enumValues)[number];
  needsAttention?: boolean;
  search?: string;
  from?: Date;
  to?: Date;
  limit?: number;
  offset?: number;
}

export async function listConversations(
  ctx: Ctx,
  tenantId: string,
  filter: ConversationFilter = {},
) {
  const ids = visibleAgentIds(ctx, tenantId);
  const where: (SQL | undefined)[] = [
    eq(conversations.tenantId, tenantId),
    agentScope(conversations.agentId, ids),
  ];
  if (filter.agentId) where.push(eq(conversations.agentId, filter.agentId));
  if (filter.outcome) where.push(eq(conversations.outcome, filter.outcome));
  if (filter.channel) where.push(eq(conversations.channel, filter.channel));
  if (filter.needsAttention) where.push(sql`'needs_attention' = any(${conversations.flags})`);
  if (filter.from) where.push(gte(conversations.startedAt, filter.from));
  if (filter.to) where.push(lt(conversations.startedAt, filter.to));
  if (filter.search) {
    const q = `%${filter.search.replace(/[%_]/g, "").slice(0, 80)}%`;
    where.push(or(ilike(conversations.summary, q), ilike(conversations.customerLabel, q)));
  }
  const rows = await ctx.db
    .select({ conversation: conversations, agentName: agents.name })
    .from(conversations)
    .leftJoin(agents, eq(agents.id, conversations.agentId))
    .where(and(...where))
    .orderBy(desc(conversations.startedAt))
    .limit(Math.min(filter.limit ?? 25, 100))
    .offset(filter.offset ?? 0);
  return rows;
}

/** One conversation with its messages and the brain's decisions ("why this agent"). */
export async function getConversation(ctx: Ctx, tenantId: string, conversationId: string) {
  const [row] = await ctx.db
    .select()
    .from(conversations)
    .where(and(eq(conversations.id, conversationId), eq(conversations.tenantId, tenantId)));
  if (!row) throw new DomainError("not_found", "Conversation not found.");
  agentGate(ctx, "agents.logs", tenantId, row.agentId);
  const [messages, decisions] = await Promise.all([
    ctx.db
      .select()
      .from(conversationMessages)
      .where(eq(conversationMessages.conversationId, conversationId))
      .orderBy(asc(conversationMessages.id)),
    ctx.db
      .select()
      .from(agentDecisions)
      .where(
        and(
          eq(agentDecisions.conversationId, conversationId),
          eq(agentDecisions.tenantId, tenantId),
        ),
      )
      .orderBy(asc(agentDecisions.id)),
  ]);
  return { conversation: row, messages, decisions };
}

/** Marks a handoff or callback as dealt with (removes it from the to-do list). */
export async function resolveAttention(ctx: Ctx, tenantId: string, conversationId: string) {
  const [row] = await ctx.db
    .select()
    .from(conversations)
    .where(and(eq(conversations.id, conversationId), eq(conversations.tenantId, tenantId)));
  if (!row) throw new DomainError("not_found", "Conversation not found.");
  agentGate(ctx, "agents.use", tenantId, row.agentId);
  await ctx.db
    .update(conversations)
    .set({ flags: sql`array_remove(${conversations.flags}, 'needs_attention')` })
    .where(eq(conversations.id, conversationId));
  await audit(ctx, {
    action: "conversation.resolved",
    tenantId,
    targetType: "conversation",
    targetId: conversationId,
  });
}

// ---------------------------------------------------------------------------------------------
// Approvals (tier 2: staff who may configure the agent; tier 3: owners and admins as well).

export const hashPayload = (payload: unknown) =>
  createHash("sha256")
    .update(JSON.stringify(payload ?? {}))
    .digest("hex");

export async function listApprovals(
  ctx: Ctx,
  tenantId: string,
  status: "pending" | "all" = "pending",
) {
  const ids = visibleAgentIds(ctx, tenantId);
  return ctx.db
    .select({ approval: approvals, agentName: agents.name })
    .from(approvals)
    .leftJoin(agents, eq(agents.id, approvals.agentId))
    .where(
      and(
        eq(approvals.tenantId, tenantId),
        agentScope(approvals.agentId as unknown as typeof conversations.agentId, ids),
        status === "pending" ? eq(approvals.status, "pending") : undefined,
      ),
    )
    .orderBy(desc(approvals.requestedAt))
    .limit(100);
}

export async function decideApproval(
  ctx: Ctx,
  input: { tenantId: string; approvalId: string; approve: boolean; reason?: string },
) {
  const [row] = await ctx.db
    .select()
    .from(approvals)
    .where(and(eq(approvals.id, input.approvalId), eq(approvals.tenantId, input.tenantId)));
  if (!row) throw new DomainError("not_found", "Approval not found.");
  agentGate(ctx, "agents.configure", input.tenantId, row.agentId);
  if (row.riskTier >= 3 && ctx.actor?.kind !== "platform") {
    const d = check(ctx.actor, "security.manage", { tenantId: input.tenantId });
    if (!d.allowed) throw new ForbiddenError("security.manage", d.reason);
  }
  if (row.status !== "pending")
    throw new DomainError("approval_used", "This request was already decided.");
  if (row.expiresAt <= new Date()) {
    await ctx.db.update(approvals).set({ status: "expired" }).where(eq(approvals.id, row.id));
    throw new DomainError(
      "approval_expired",
      "This request expired. The customer was told someone will follow up.",
    );
  }
  const reviewer =
    ctx.actor?.kind === "impersonating" ? ctx.actor.platform.userId : (ctx.actor?.userId ?? null);
  const reason = input.reason?.trim().slice(0, 500) || null;
  if (!input.approve && !reason)
    throw new DomainError("reason_required", "Say briefly why you're rejecting it.");
  const [after] = await guarded(() =>
    ctx.db
      .update(approvals)
      .set({
        status: input.approve ? "approved" : "rejected",
        decidedBy: reviewer,
        decisionReason: reason,
      })
      .where(eq(approvals.id, row.id))
      .returning(),
  );
  await audit(ctx, {
    action: input.approve ? "approval.approved" : "approval.rejected",
    tenantId: input.tenantId,
    targetType: "approval",
    targetId: row.id,
    before: { status: row.status, action: row.action, tier: row.riskTier },
    after: { status: after?.status, reason },
  });
  return after;
}

// ---------------------------------------------------------------------------------------------
// Teaching: corrections and tests

export async function addCorrection(
  ctx: Ctx,
  input: {
    tenantId: string;
    agentId: string;
    correctAnswer: string;
    wrongAnswer?: string;
    topic?: string;
    conversationId?: string;
    messageId?: number;
    /** Also save a test so the agent must keep answering this right. */
    question?: string;
  },
) {
  agentGate(ctx, "agents.configure", input.tenantId, input.agentId);
  const correct = input.correctAnswer.trim();
  if (correct.length < 3)
    throw new DomainError("too_short", "Write the right answer (at least a few words).");
  const createdBy = ctx.actor?.kind === "impersonating" ? null : (ctx.actor?.userId ?? null);
  return guarded(() =>
    ctx.db.transaction(async (tx) => {
      let testId: string | null = null;
      if (input.question?.trim()) {
        const [test] = await tx
          .insert(agentTests)
          .values({
            tenantId: input.tenantId,
            agentId: input.agentId,
            name: (input.topic?.trim() || input.question.trim()).slice(0, 120),
            turns: [input.question.trim().slice(0, 1000)],
            expectation: `Answers in line with: ${correct}`.slice(0, 1000),
            source: "correction",
            sourceConversationId: input.conversationId ?? null,
            createdBy,
          })
          .returning();
        testId = test?.id ?? null;
      }
      const [row] = await tx
        .insert(corrections)
        .values({
          tenantId: input.tenantId,
          agentId: input.agentId,
          conversationId: input.conversationId ?? null,
          messageId: input.messageId ?? null,
          topic: input.topic?.trim().slice(0, 80) || null,
          wrongAnswer: input.wrongAnswer?.slice(0, 2000) ?? null,
          correctAnswer: correct.slice(0, 2000),
          testId,
          createdBy,
        })
        .returning();
      await audit(
        ctx,
        {
          action: "correction.added",
          tenantId: input.tenantId,
          targetType: "agent",
          targetId: input.agentId,
          after: { topic: input.topic ?? null, testId },
        },
        tx,
      );
      return row;
    }),
  );
}

export async function listCorrections(ctx: Ctx, tenantId: string, agentId?: string) {
  const ids = visibleAgentIds(ctx, tenantId);
  return ctx.db
    .select({ correction: corrections, agentName: agents.name })
    .from(corrections)
    .innerJoin(agents, eq(agents.id, corrections.agentId))
    .where(
      and(
        eq(corrections.tenantId, tenantId),
        ids === null ? undefined : ids.length ? inArray(corrections.agentId, ids) : sql`false`,
        agentId ? eq(corrections.agentId, agentId) : undefined,
      ),
    )
    .orderBy(desc(corrections.createdAt))
    .limit(200);
}

export async function retireCorrection(ctx: Ctx, tenantId: string, correctionId: string) {
  const [row] = await ctx.db
    .select()
    .from(corrections)
    .where(and(eq(corrections.id, correctionId), eq(corrections.tenantId, tenantId)));
  if (!row) throw new DomainError("not_found", "Correction not found.");
  agentGate(ctx, "agents.configure", tenantId, row.agentId);
  await ctx.db.update(corrections).set({ status: "retired" }).where(eq(corrections.id, row.id));
  await audit(ctx, {
    action: "correction.retired",
    tenantId,
    targetType: "correction",
    targetId: row.id,
  });
}

/** "Turn this call into a test": the customer's messages become the test's turns. */
export async function testFromConversation(
  ctx: Ctx,
  input: { tenantId: string; conversationId: string; name: string; expectation: string },
) {
  const { conversation, messages } = await getConversation(
    ctx,
    input.tenantId,
    input.conversationId,
  );
  if (!conversation.agentId) throw new DomainError("no_agent", "This conversation had no agent.");
  agentGate(ctx, "agents.configure", input.tenantId, conversation.agentId);
  const turns = messages
    .filter((m) => m.role === "customer")
    .map((m) => m.body.slice(0, 1000))
    .slice(0, 20);
  if (turns.length === 0) throw new DomainError("no_turns", "No customer messages to test with.");
  const [test] = await guarded(() =>
    ctx.db
      .insert(agentTests)
      .values({
        tenantId: input.tenantId,
        agentId: conversation.agentId as string,
        name: input.name.trim().slice(0, 120) || "Test from a conversation",
        turns,
        expectation: input.expectation.trim().slice(0, 1000),
        source: "conversation",
        sourceConversationId: conversation.id,
        createdBy: ctx.actor?.kind === "impersonating" ? null : (ctx.actor?.userId ?? null),
      })
      .returning(),
  );
  await audit(ctx, {
    action: "test.created",
    tenantId: input.tenantId,
    targetType: "agent_test",
    targetId: test?.id,
  });
  return test;
}

export async function listTests(ctx: Ctx, tenantId: string, agentId: string) {
  agentGate(ctx, "agents.logs", tenantId, agentId);
  return ctx.db
    .select()
    .from(agentTests)
    .where(and(eq(agentTests.tenantId, tenantId), eq(agentTests.agentId, agentId)))
    .orderBy(desc(agentTests.createdAt));
}

// ---------------------------------------------------------------------------------------------
// Settings versions: draft, publish, restore

export async function listVersions(ctx: Ctx, tenantId: string, agentId: string) {
  agentGate(ctx, "agents.logs", tenantId, agentId);
  return ctx.db
    .select()
    .from(agentSettingsVersions)
    .where(
      and(eq(agentSettingsVersions.tenantId, tenantId), eq(agentSettingsVersions.agentId, agentId)),
    )
    .orderBy(desc(agentSettingsVersions.createdAt))
    .limit(50);
}

/** Saves settings as a new draft version (not live until published). */
export async function saveDraft(
  ctx: Ctx,
  input: { tenantId: string; agentId: string; settings: Record<string, unknown> },
) {
  agentGate(ctx, "agents.configure", input.tenantId, input.agentId);
  if (JSON.stringify(input.settings).length > 100_000)
    throw new DomainError("too_large", "These settings are too large.");
  const [version] = await guarded(() =>
    ctx.db
      .insert(agentSettingsVersions)
      .values({
        tenantId: input.tenantId,
        agentId: input.agentId,
        settings: input.settings,
        createdBy: ctx.actor?.kind === "impersonating" ? null : (ctx.actor?.userId ?? null),
      })
      .returning(),
  );
  await audit(ctx, {
    action: "agent.draft_saved",
    tenantId: input.tenantId,
    targetType: "agent",
    targetId: input.agentId,
    after: { version: version?.id },
  });
  return version;
}

/** Publishes a version: the agent uses it from now on (also how "restore" works). */
export async function publishVersion(
  ctx: Ctx,
  input: { tenantId: string; agentId: string; versionId: string },
) {
  agentGate(ctx, "agents.configure", input.tenantId, input.agentId);
  const [version] = await ctx.db
    .select()
    .from(agentSettingsVersions)
    .where(
      and(
        eq(agentSettingsVersions.id, input.versionId),
        eq(agentSettingsVersions.agentId, input.agentId),
        eq(agentSettingsVersions.tenantId, input.tenantId),
      ),
    );
  if (!version) throw new DomainError("not_found", "Version not found.");
  const restoring = version.publishedAt !== null;
  const published = await ctx.db.transaction(async (tx) => {
    // Restoring an older version publishes a copy, so the history stays in order.
    const [row] = restoring
      ? await tx
          .insert(agentSettingsVersions)
          .values({
            tenantId: input.tenantId,
            agentId: input.agentId,
            settings: version.settings,
            createdBy: ctx.actor?.kind === "impersonating" ? null : (ctx.actor?.userId ?? null),
            publishedAt: new Date(),
          })
          .returning()
      : await tx
          .update(agentSettingsVersions)
          .set({ publishedAt: new Date() })
          .where(eq(agentSettingsVersions.id, version.id))
          .returning();
    await tx.update(agents).set({ config: version.settings }).where(eq(agents.id, input.agentId));
    await audit(
      ctx,
      {
        action: restoring ? "agent.version_restored" : "agent.version_published",
        tenantId: input.tenantId,
        targetType: "agent",
        targetId: input.agentId,
        after: { version: row?.id, from: version.id },
      },
      tx,
    );
    return row;
  });
  return published;
}

// ---------------------------------------------------------------------------------------------
// Off switches. Customers pause an agent (agents.configure) or everything (security.manage);
// Wyrm staff can also switch off a tool or provider, or everything for everyone.

export async function listSwitches(ctx: Ctx, tenantId: string) {
  if (ctx.actor?.kind === "platform") agentGate(ctx, "agents.logs", tenantId, null);
  else visibleAgentIds(ctx, tenantId);
  return ctx.db
    .select()
    .from(killSwitches)
    .where(
      and(
        isNull(killSwitches.clearedAt),
        or(isNull(killSwitches.tenantId), eq(killSwitches.tenantId, tenantId)),
      ),
    )
    .orderBy(desc(killSwitches.createdAt));
}

export async function setSwitch(
  ctx: Ctx,
  input: {
    scope: "global" | "tenant" | "agent" | "tool" | "provider";
    tenantId?: string;
    agentId?: string;
    target?: string;
    reason: string;
  },
) {
  const reason = input.reason.trim();
  if (reason.length < 3) throw new DomainError("reason_required", "Give a short reason.");
  if (input.scope === "agent") {
    if (!input.tenantId || !input.agentId) throw new DomainError("bad_switch", "Choose an agent.");
    agentGate(ctx, "agents.configure", input.tenantId, input.agentId);
  } else if (input.scope === "tenant") {
    if (!input.tenantId) throw new DomainError("bad_switch", "Choose an organisation.");
    const d =
      ctx.actor?.kind === "platform"
        ? check(ctx.actor, "platform_agents.manage")
        : check(ctx.actor, "security.manage", { tenantId: input.tenantId });
    if (!d.allowed) throw new ForbiddenError("security.manage", d.reason);
  } else {
    const d = check(ctx.actor, "platform_agents.manage");
    if (!d.allowed || ctx.actor?.kind !== "platform")
      throw new ForbiddenError("platform_agents.manage", d.allowed ? "platform_only" : d.reason);
  }
  const [row] = await guarded(() =>
    ctx.db
      .insert(killSwitches)
      .values({
        scope: input.scope,
        tenantId: input.scope === "global" ? null : (input.tenantId ?? null),
        agentId: input.scope === "agent" ? (input.agentId ?? null) : null,
        target:
          input.scope === "tool" || input.scope === "provider" ? (input.target ?? null) : null,
        reason: reason.slice(0, 300),
        setBy:
          ctx.actor?.kind === "impersonating"
            ? ctx.actor.platform.userId
            : (ctx.actor?.userId ?? null),
      })
      .onConflictDoNothing()
      .returning(),
  );
  await audit(ctx, {
    action: "switch.on",
    tenantId: input.tenantId ?? null,
    targetType: "kill_switch",
    targetId: row?.id,
    after: { scope: input.scope, reason },
  });
  return row ?? null;
}

export async function clearSwitch(ctx: Ctx, switchId: string) {
  const [row] = await ctx.db.select().from(killSwitches).where(eq(killSwitches.id, switchId));
  if (!row || row.clearedAt) throw new DomainError("not_found", "Switch not found.");
  if (row.scope === "agent" && row.tenantId && row.agentId)
    agentGate(ctx, "agents.configure", row.tenantId, row.agentId);
  else if (row.scope === "tenant" && row.tenantId && ctx.actor?.kind !== "platform") {
    const d = check(ctx.actor, "security.manage", { tenantId: row.tenantId });
    if (!d.allowed) throw new ForbiddenError("security.manage", d.reason);
  } else {
    const d = check(ctx.actor, "platform_agents.manage");
    if (!d.allowed) throw new ForbiddenError("platform_agents.manage", d.reason);
  }
  await ctx.db
    .update(killSwitches)
    .set({
      clearedAt: new Date(),
      clearedBy:
        ctx.actor?.kind === "impersonating"
          ? ctx.actor.platform.userId
          : (ctx.actor?.userId ?? null),
    })
    .where(eq(killSwitches.id, row.id));
  await audit(ctx, {
    action: "switch.off",
    tenantId: row.tenantId,
    targetType: "kill_switch",
    targetId: row.id,
  });
}

// ---------------------------------------------------------------------------------------------
// Usage and budget

const dayString = (d: Date) => d.toISOString().slice(0, 10);

export async function usageSummary(ctx: Ctx, tenantId: string, now = new Date()) {
  const d =
    ctx.actor?.kind === "platform"
      ? check(ctx.actor, "tenants.view")
      : check(ctx.actor, "billing.view", { tenantId });
  if (!d.allowed) throw new ForbiddenError("billing.view", d.reason);
  const [tenant] = await ctx.db.select().from(tenants).where(eq(tenants.id, tenantId));
  if (!tenant) throw new DomainError("not_found", "Organisation not found.");
  const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const nextMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1));
  const [month] = await ctx.db
    .select({
      cost: sql<number>`coalesce(sum(${usageDaily.costMicros}), 0)::bigint`,
      conversations: sql<number>`coalesce(sum(${usageDaily.conversations}), 0)::bigint`,
      calls: sql<number>`coalesce(sum(${usageDaily.llmCalls}), 0)::bigint`,
    })
    .from(usageDaily)
    .where(and(eq(usageDaily.tenantId, tenantId), gte(usageDaily.day, dayString(monthStart))));
  const [today] = await ctx.db
    .select({ cost: sql<number>`coalesce(sum(${usageDaily.costMicros}), 0)::bigint` })
    .from(usageDaily)
    .where(and(eq(usageDaily.tenantId, tenantId), eq(usageDaily.day, dayString(now))));
  const spentMonth = Number(month?.cost ?? 0);
  const elapsedDays = Math.max(1, (now.getTime() - monthStart.getTime()) / 86_400_000);
  const monthDays = (nextMonth.getTime() - monthStart.getTime()) / 86_400_000;
  return {
    budgetMicros: tenant.aiMonthlyBudgetMicros,
    spentMonthMicros: spentMonth,
    spentTodayMicros: Number(today?.cost ?? 0),
    dailyCapMicros: Math.floor(tenant.aiMonthlyBudgetMicros / 20),
    projectedMonthMicros: Math.round((spentMonth / elapsedDays) * monthDays),
    conversations: Number(month?.conversations ?? 0),
    llmCalls: Number(month?.calls ?? 0),
  };
}

export async function setBudget(ctx: Ctx, tenantId: string, monthlyMicros: number) {
  const d =
    ctx.actor?.kind === "platform"
      ? check(ctx.actor, "tenants.plan")
      : check(ctx.actor, "billing.manage", { tenantId });
  if (!d.allowed) throw new ForbiddenError("billing.manage", d.reason);
  if (!Number.isInteger(monthlyMicros) || monthlyMicros < 0 || monthlyMicros > 1_000_000_000)
    throw new DomainError("bad_budget", "Budget must be between $0 and $1,000 a month.");
  const [before] = await ctx.db.select().from(tenants).where(eq(tenants.id, tenantId));
  await ctx.db
    .update(tenants)
    .set({ aiMonthlyBudgetMicros: monthlyMicros })
    .where(eq(tenants.id, tenantId));
  await audit(ctx, {
    action: "budget.changed",
    tenantId,
    targetType: "tenant",
    targetId: tenantId,
    before: { micros: before?.aiMonthlyBudgetMicros },
    after: { micros: monthlyMicros },
  });
}

// ---------------------------------------------------------------------------------------------
// Home numbers: this week vs the week before, for the agents this person can see.

export interface Metric {
  key: string;
  current: number;
  previous: number;
}

export async function homeMetrics(ctx: Ctx, tenantId: string, now = new Date()) {
  const ids = visibleAgentIds(ctx, tenantId);
  const weekAgo = new Date(now.getTime() - 7 * 86_400_000);
  const twoWeeksAgo = new Date(now.getTime() - 14 * 86_400_000);
  const scope = and(eq(conversations.tenantId, tenantId), agentScope(conversations.agentId, ids));
  const count = (filter?: SQL) => sql<number>`count(*) filter (where ${filter ?? sql`true`})::int`;
  const window = async (from: Date, to: Date) => {
    const [r] = await ctx.db
      .select({
        answered: count(),
        booked: count(eq(conversations.outcome, "booked")),
        confirmed: count(eq(conversations.outcome, "resolved_confirmed")),
        assumed: count(eq(conversations.outcome, "resolved_assumed")),
        leads: count(eq(conversations.outcome, "lead")),
        handedOff: count(eq(conversations.outcome, "handed_off")),
      })
      .from(conversations)
      .where(and(scope, gte(conversations.startedAt, from), lt(conversations.startedAt, to)));
    return r ?? { answered: 0, booked: 0, confirmed: 0, assumed: 0, leads: 0, handedOff: 0 };
  };
  const [cur, prev] = await Promise.all([window(weekAgo, now), window(twoWeeksAgo, weekAgo)]);
  const [attention] = await ctx.db
    .select({ n: sql<number>`count(*)::int` })
    .from(conversations)
    .where(and(scope, sql`'needs_attention' = any(${conversations.flags})`));
  const [pending] = await ctx.db
    .select({ n: sql<number>`count(*)::int` })
    .from(approvals)
    .where(
      and(
        eq(approvals.tenantId, tenantId),
        eq(approvals.status, "pending"),
        ids === null ? undefined : ids.length ? inArray(approvals.agentId, ids) : sql`false`,
      ),
    );
  const metrics: Metric[] = (
    ["answered", "booked", "confirmed", "assumed", "leads", "handedOff"] as const
  ).map((key) => ({
    key,
    current: Number(cur[key]),
    previous: Number(prev[key]),
  }));
  return {
    metrics,
    needsAttention: Number(attention?.n ?? 0) + Number(pending?.n ?? 0),
    pendingApprovals: Number(pending?.n ?? 0),
  };
}

export interface DayActivity {
  /** UTC day, YYYY-MM-DD. */
  day: string;
  total: number;
  /** Finished by the agent: resolved, booked or a lead taken. */
  handled: number;
  handedOff: number;
}

/** Conversations per UTC day for the last `days` days (oldest first, empty days included). */
export async function activityByDay(
  ctx: Ctx,
  tenantId: string,
  days = 14,
  now = new Date(),
): Promise<DayActivity[]> {
  const ids = visibleAgentIds(ctx, tenantId);
  const span = Math.min(Math.max(Math.trunc(days), 1), 90);
  const today = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  const from = new Date(today - (span - 1) * 86_400_000);
  const dayCol = sql<string>`to_char(${conversations.startedAt} at time zone 'UTC', 'YYYY-MM-DD')`;
  const count = (filter?: SQL) => sql<number>`count(*) filter (where ${filter ?? sql`true`})::int`;
  const rows = await ctx.db
    .select({
      day: dayCol,
      total: count(),
      handled: count(
        inArray(conversations.outcome, [
          "resolved_confirmed",
          "resolved_assumed",
          "booked",
          "lead",
        ]),
      ),
      handedOff: count(eq(conversations.outcome, "handed_off")),
    })
    .from(conversations)
    .where(
      and(
        eq(conversations.tenantId, tenantId),
        agentScope(conversations.agentId, ids),
        gte(conversations.startedAt, from),
      ),
    )
    .groupBy(dayCol);
  const byDay = new Map(rows.map((r) => [r.day, r]));
  return Array.from({ length: span }, (_, i) => {
    const day = dayString(new Date(from.getTime() + i * 86_400_000));
    const r = byDay.get(day);
    return {
      day,
      total: Number(r?.total ?? 0),
      handled: Number(r?.handled ?? 0),
      handedOff: Number(r?.handedOff ?? 0),
    };
  });
}

/** Week-over-week change worth pointing out: at least 5 events and a 50% move. */
export function notableChange(metric: Metric): "up" | "down" | null {
  const { current, previous } = metric;
  if (Math.max(current, previous) < 5) return null;
  if (previous === 0) return current >= 5 ? "up" : null;
  const ratio = current / previous;
  if (ratio >= 1.5) return "up";
  if (ratio <= 0.5) return "down";
  return null;
}

/**
 * Questions the agents couldn't answer this month, grouped by topic: the "add an answer?"
 * suggestions on Home and in Teach.
 */
export async function unansweredTopics(ctx: Ctx, tenantId: string, now = new Date()) {
  const ids = visibleAgentIds(ctx, tenantId);
  const since = new Date(now.getTime() - 30 * 86_400_000);
  const rows = await ctx.db
    .select({
      topic: sql<string>`t.topic`,
      n: sql<number>`count(*)::int`,
      latest: sql<string>`(array_agg(${conversations.id} order by ${conversations.startedAt} desc))[1]`,
      agentId: sql<
        string | null
      >`(array_agg(${conversations.agentId} order by ${conversations.startedAt} desc))[1]`,
    })
    .from(conversations)
    .innerJoin(sql`unnest(${conversations.topics}) as t(topic)`, sql`true`)
    .where(
      and(
        eq(conversations.tenantId, tenantId),
        agentScope(conversations.agentId, ids),
        gte(conversations.startedAt, since),
        sql`'unanswered' = any(${conversations.flags})`,
      ),
    )
    .groupBy(sql`t.topic`)
    .orderBy(sql`count(*) desc`)
    .limit(10);
  return rows.map((r) => ({ ...r, n: Number(r.n) }));
}
