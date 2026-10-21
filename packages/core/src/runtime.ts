import {
  type AgentSpec,
  type BrainEvent,
  budgetLevel,
  type Classifier,
  type DecisionRecord,
  decide,
  type FaqEntry,
  type TenantState,
} from "@wyrm/brain";
import {
  agentDecisions,
  agents,
  conversationMessages,
  conversations,
  corrections,
  killSwitches,
  tenants,
  usageDaily,
} from "@wyrm/db";
import { and, asc, desc, eq, gte, isNull, or, sql } from "drizzle-orm";
import type { Db } from "./context";

/**
 * The runtime path for a customer message: no signed-in user, so these are system functions.
 * Only the chat endpoint calls them, after validating the input and rate limiting the caller.
 * Every turn is recorded: messages, the brain's decisions, usage and the conversation's result.
 */

/** What each catalogue agent type handles, for routing. */
export const INTENTS_BY_TYPE: Record<string, readonly string[]> = {
  receptionist: ["booking", "opening_hours", "services", "prices", "location", "general_question"],
  scheduling: ["booking", "reschedule"],
  quote: ["quote"],
  support: ["support", "complaint"],
  sales: ["sales_enquiry"],
  payment_reminder: ["payment_question"],
  reviews: ["review"],
  inbox: ["general_question"],
  knowledge: ["general_question"],
};

export interface AgentSettings {
  greeting?: string;
  businessFacts?: string;
  handoffContact?: string;
  tone?: string;
}

export interface Knowledge {
  businessName: string;
  agentName: string;
  greeting?: string;
  businessFacts?: string;
  tone?: string;
  taught: { topic: string | null; answer: string }[];
}

export interface Answer {
  reply: string;
  answered: boolean;
  topic: string | null;
  lead: boolean;
  provider: "anthropic" | "groq";
  model: string;
  inputTokens: number;
  outputTokens: number;
  costMicros: number;
  latencyMs: number;
}

export interface RuntimeDeps {
  classifiers: readonly Classifier[];
  answer: (
    knowledge: Knowledge,
    history: { role: "customer" | "agent"; text: string }[],
    options: { allowPaid: boolean },
  ) => Promise<Answer | null>;
}

const words = (topic: string) =>
  topic
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((w) => w.length >= 3)
    .slice(0, 3);

const dayString = (d: Date) => d.toISOString().slice(0, 10);

/** Loads everything the brain needs for one organisation, entered through one agent. */
export async function loadRuntime(db: Db, agentId: string, now = new Date(), testMode = false) {
  const [entry] = await db
    .select({ agent: agents, tenant: tenants })
    .from(agents)
    .innerJoin(tenants, eq(tenants.id, agents.tenantId))
    .where(eq(agents.id, agentId));
  if (entry?.tenant.status !== "active") return null;
  const tenantId = entry.tenant.id;
  const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const [all, taught, switches, month, today] = await Promise.all([
    db.select().from(agents).where(eq(agents.tenantId, tenantId)).orderBy(asc(agents.createdAt)),
    db
      .select()
      .from(corrections)
      .where(and(eq(corrections.tenantId, tenantId), eq(corrections.status, "active")))
      .orderBy(desc(corrections.createdAt))
      .limit(100),
    db
      .select()
      .from(killSwitches)
      .where(
        and(
          isNull(killSwitches.clearedAt),
          or(isNull(killSwitches.tenantId), eq(killSwitches.tenantId, tenantId)),
        ),
      ),
    db
      .select({ cost: sql<number>`coalesce(sum(${usageDaily.costMicros}), 0)::bigint` })
      .from(usageDaily)
      .where(and(eq(usageDaily.tenantId, tenantId), gte(usageDaily.day, dayString(monthStart)))),
    db
      .select({ cost: sql<number>`coalesce(sum(${usageDaily.costMicros}), 0)::bigint` })
      .from(usageDaily)
      .where(and(eq(usageDaily.tenantId, tenantId), eq(usageDaily.day, dayString(now)))),
  ]);
  const specs: AgentSpec[] = all.map((a) => ({
    id: a.id,
    name: a.name,
    type: a.type,
    // Staff testing a draft agent from the portal may talk to it before it goes live.
    status: testMode && a.id === agentId && a.status === "draft" ? "live" : a.status,
    intents: INTENTS_BY_TYPE[a.type] ?? ["general_question"],
    tools: [],
  }));
  const faq: FaqEntry[] = taught
    .filter((c) => c.topic && words(c.topic).length > 0)
    .map((c) => ({ id: c.id, keywords: words(c.topic as string), answer: c.correctAnswer }));
  const state: TenantState = {
    tenantId,
    businessName: entry.tenant.name,
    agents: specs,
    faq,
    budget: {
      monthlyMicros: entry.tenant.aiMonthlyBudgetMicros,
      spentMonthMicros: Number(month[0]?.cost ?? 0),
      spentTodayMicros: Number(today[0]?.cost ?? 0),
    },
    switches: switches.map((s) => ({ scope: s.scope, agentId: s.agentId, target: s.target })),
  };
  const knowledgeFor = (id: string): Knowledge => {
    const a = all.find((x) => x.id === id);
    const settings = (a?.config ?? {}) as AgentSettings;
    return {
      businessName: entry.tenant.name,
      agentName: a?.name ?? "Assistant",
      ...(settings.greeting ? { greeting: settings.greeting } : {}),
      ...(settings.businessFacts ? { businessFacts: settings.businessFacts } : {}),
      ...(settings.tone ? { tone: settings.tone } : {}),
      taught: taught
        .filter((c) => c.agentId === id)
        .map((c) => ({ topic: c.topic, answer: c.correctAnswer })),
    };
  };
  return { tenantId, entry: entry.agent, state, knowledgeFor };
}

export interface TurnInput {
  agentId: string;
  conversationId?: string | null;
  text: string;
  channel: "web_chat" | "sms" | "email" | "whatsapp" | "voice" | "form";
  /** Staff trying the agent from the portal. */
  test?: boolean;
  customerLabel?: string;
  now?: Date;
}

export type TurnResult =
  | { status: "ok"; conversationId: string; reply: string; kind: string }
  | { status: "unavailable" };

export async function handleCustomerMessage(
  db: Db,
  deps: RuntimeDeps,
  input: TurnInput,
): Promise<TurnResult> {
  const now = input.now ?? new Date();
  const runtime = await loadRuntime(db, input.agentId, now, input.test ?? false);
  if (!runtime) return { status: "unavailable" };
  if (runtime.entry.status !== "live" && !input.test) return { status: "unavailable" };
  const { tenantId, state } = runtime;
  const text = input.text.trim().slice(0, 1000);

  // Continue the conversation only if it belongs to this organisation and is recent.
  let conversation = input.conversationId
    ? (
        await db
          .select()
          .from(conversations)
          .where(
            and(
              eq(conversations.id, input.conversationId),
              eq(conversations.tenantId, tenantId),
              eq(conversations.status, "active"),
              gte(conversations.startedAt, new Date(now.getTime() - 6 * 3_600_000)),
            ),
          )
      )[0]
    : undefined;
  const firstContact = !conversation;
  if (!conversation) {
    [conversation] = await db
      .insert(conversations)
      .values({
        tenantId,
        agentId: input.agentId,
        channel: input.channel,
        customerLabel: input.test
          ? "Test chat"
          : (input.customerLabel?.slice(0, 80) ?? "Website visitor"),
        flags: input.test ? ["test"] : [],
        startedAt: now,
      })
      .returning();
  }
  if (!conversation) return { status: "unavailable" };

  const [history, previous] = await Promise.all([
    db
      .select()
      .from(conversationMessages)
      .where(eq(conversationMessages.conversationId, conversation.id))
      .orderBy(asc(conversationMessages.id))
      .limit(40),
    db
      .select()
      .from(agentDecisions)
      .where(eq(agentDecisions.conversationId, conversation.id))
      .orderBy(asc(agentDecisions.id)),
  ]);
  const lastRoute = [...previous]
    .reverse()
    .find((d) => d.decision === "route" && d.outcome === "ok" && d.agentId);
  const event: BrainEvent = {
    channel: input.channel,
    text,
    conversationId: conversation.id,
    firstContact,
    activeFlow: lastRoute?.agentId ? { agentId: lastRoute.agentId, midAction: false } : null,
    clarifications: previous.filter((d) => d.outcome === "asked").length,
  };

  const result = await decide(event, state, deps.classifiers);
  const records: DecisionRecord[] = [...result.records];
  let reply: string;
  let outcome = conversation.outcome;
  const flags = new Set(conversation.flags);
  const topics = new Set(conversation.topics);
  let routedAgent = conversation.agentId;

  switch (result.action.kind) {
    case "route": {
      routedAgent = result.action.agentId;
      const turns = [
        ...history.map((m) => ({
          role: m.role === "customer" ? ("customer" as const) : ("agent" as const),
          text: m.body,
        })),
        { role: "customer" as const, text },
      ];
      const answer = await deps.answer(runtime.knowledgeFor(result.action.agentId), turns, {
        allowPaid: budgetLevel(state.budget) === "normal",
      });
      if (answer) {
        reply = answer.reply;
        records.push({
          ...base(records[0], state, conversation.id),
          agentId: result.action.agentId,
          decision: "answer_mode",
          outcome: answer.answered ? "ok" : "escalated",
          reason: answer.answered ? "agent_answered" : "agent_lacked_facts",
          provider: answer.provider,
          model: answer.model,
          inputTokens: answer.inputTokens,
          outputTokens: answer.outputTokens,
          costMicros: answer.costMicros,
          latencyMs: answer.latencyMs,
        });
        if (answer.topic) topics.add(answer.topic);
        if (!answer.answered) {
          flags.add("unanswered");
          flags.add("needs_attention");
        }
        if (answer.lead) {
          outcome = "lead";
          flags.add("needs_attention");
        } else if (answer.answered && !outcome) outcome = "resolved_assumed";
      } else {
        reply = `Thanks. I can't answer that right now, so I'll pass it to the team at ${state.businessName}. Could you leave your name and a phone number or email?`;
        flags.add("needs_attention");
        outcome = "handed_off";
      }
      break;
    }
    case "answer":
      reply = result.action.text;
      outcome ??= "resolved_assumed";
      break;
    case "ask":
      reply = result.action.text;
      break;
    case "handoff":
    case "take_message":
      reply = result.action.text;
      flags.add("needs_attention");
      outcome = "handed_off";
      break;
    case "stop":
      reply = result.action.text;
      outcome = "abandoned";
      break;
  }
  if (result.disclosure) reply = `${result.disclosure}\n\n${reply}`;

  const cost = records.reduce((sum, r) => sum + r.costMicros, 0);
  const llmCalls = records.filter(
    (r) => r.provider === "anthropic" || r.provider === "groq",
  ).length;
  await db.transaction(async (tx) => {
    await tx.insert(conversationMessages).values([
      { conversationId: conversation.id, tenantId, role: "customer", body: text, createdAt: now },
      {
        conversationId: conversation.id,
        tenantId,
        role: "agent",
        body: reply.slice(0, 8000),
        createdAt: new Date(now.getTime() + 1),
      },
    ]);
    if (records.length) {
      await tx.insert(agentDecisions).values(
        records.map((r) => ({
          ...r,
          conversationId: conversation.id,
          confidence: r.confidence,
          riskTier: r.riskTier,
        })),
      );
    }
    await tx
      .update(conversations)
      .set({
        agentId: routedAgent,
        outcome,
        flags: [...flags],
        topics: [...topics].slice(0, 10),
        aiDisclosed: conversation.aiDisclosed || Boolean(result.disclosure),
        summary: conversation.summary ?? text.slice(0, 200),
        endedAt: result.action.kind === "stop" ? now : null,
        status: result.action.kind === "stop" ? "ended" : "active",
      })
      .where(eq(conversations.id, conversation.id));
    await tx.execute(sql`
      insert into usage_daily (tenant_id, agent_id, day, conversations, llm_calls, input_tokens, output_tokens, cost_micros)
      values (${tenantId}, ${routedAgent}, ${dayString(now)}, ${firstContact ? 1 : 0}, ${llmCalls},
              ${records.reduce((s, r) => s + r.inputTokens, 0)}, ${records.reduce((s, r) => s + r.outputTokens, 0)}, ${cost})
      on conflict (tenant_id, coalesce(agent_id, '00000000-0000-0000-0000-000000000000'::uuid), day) do update set
        conversations = usage_daily.conversations + excluded.conversations,
        llm_calls = usage_daily.llm_calls + excluded.llm_calls,
        input_tokens = usage_daily.input_tokens + excluded.input_tokens,
        output_tokens = usage_daily.output_tokens + excluded.output_tokens,
        cost_micros = usage_daily.cost_micros + excluded.cost_micros`);
  });
  return { status: "ok", conversationId: conversation.id, reply, kind: result.action.kind };
}

function base(
  first: DecisionRecord | undefined,
  state: TenantState,
  conversationId: string,
): DecisionRecord {
  return {
    tenantId: state.tenantId,
    conversationId,
    agentId: null,
    configVersionId: null,
    decision: "answer_mode",
    intent: null,
    confidence: null,
    ruleId: null,
    outcome: "ok",
    reason: "",
    tool: null,
    riskTier: null,
    approvalId: null,
    provider: "code",
    model: null,
    fallbackDepth: 0,
    inputTokens: 0,
    outputTokens: 0,
    costMicros: 0,
    latencyMs: null,
    retries: 0,
    errorCode: null,
    guardrailFlags: first?.guardrailFlags ?? [],
  };
}

/** Public facts for a chat page: only live agents of active organisations. */
export async function publicAgent(db: Db, agentId: string) {
  const [row] = await db
    .select({
      id: agents.id,
      tenantId: agents.tenantId,
      name: agents.name,
      status: agents.status,
      business: tenants.name,
      tenantStatus: tenants.status,
    })
    .from(agents)
    .innerJoin(tenants, eq(tenants.id, agents.tenantId))
    .where(eq(agents.id, agentId));
  return row ?? null;
}
