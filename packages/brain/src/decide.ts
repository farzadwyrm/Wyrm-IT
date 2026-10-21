import { ASK_AT, blockedBy, budgetLevel, disclosure, MAX_CLARIFICATIONS, ROUTE_AT } from "./policy";
import { guardrailFlags, isStopRequest, matchFaq, wantsHuman } from "./rules";
import type {
  Action,
  AgentSpec,
  BrainEvent,
  BrainResult,
  Classification,
  Classifier,
  DecisionRecord,
  TenantState,
} from "./types";

const OTHER = "other";

const humanize = (intent: string) => intent.replace(/_/g, " ");

export const messages = {
  handoff: (business: string) =>
    `I'll pass this to a person at ${business}. They'll get back to you as soon as they can.`,
  takeMessage: (business: string) =>
    `I can't help with that right now. Please leave your name, number and a short message, and someone from ${business} will get back to you.`,
  paused: (business: string) =>
    `Our assistant is paused at the moment. Please leave your name, number and a short message, and someone from ${business} will get back to you.`,
  stop: () => "You won't receive any more messages from us. Reply START if you change your mind.",
  ask: (intents: readonly string[]) =>
    `Could you tell me a little more? I can help with ${listOf(intents.map(humanize))}.`,
};

function listOf(items: readonly string[]) {
  const unique = [...new Set(items)].slice(0, 4);
  if (unique.length <= 1) return unique[0] ?? "questions about our services";
  return `${unique.slice(0, -1).join(", ")} or ${unique.at(-1)}`;
}

/**
 * The main brain's routing decision for one incoming message. Pure apart from the classifier
 * calls passed in. Returns what to do next plus the log rows for `agent_decisions`.
 */
export async function decide(
  event: BrainEvent,
  state: TenantState,
  classifiers: readonly Classifier[],
): Promise<BrainResult> {
  const flags = guardrailFlags(event.text);
  const records: DecisionRecord[] = [];
  const record = (
    fields: Partial<DecisionRecord> & Pick<DecisionRecord, "decision" | "outcome" | "reason">,
  ) => {
    const row: DecisionRecord = {
      tenantId: state.tenantId,
      conversationId: event.conversationId ?? null,
      agentId: null,
      configVersionId: state.configVersionId ?? null,
      intent: null,
      confidence: null,
      ruleId: null,
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
      guardrailFlags: flags,
      ...fields,
    };
    records.push(row);
    return row;
  };
  const done = (action: Action): BrainResult => ({
    action,
    disclosure: event.firstContact ? disclosure(event.channel, state.businessName) : null,
    records,
    flags,
  });
  const business = state.businessName;

  // Off switch for everything or this organisation: nobody answers automatically.
  const wide = blockedBy(
    state.switches.filter((s) => s.scope === "global" || s.scope === "tenant"),
    {},
  );
  if (wide) {
    record({
      decision: "escalate",
      outcome: "escalated",
      reason: `kill_switch_${wide.scope}`,
      ruleId: "kill_switch",
    });
    return done({ kind: "take_message", text: messages.paused(business) });
  }

  if (isStopRequest(event.text)) {
    record({ decision: "route", outcome: "ok", reason: "customer_opted_out", ruleId: "stop" });
    return done({ kind: "stop", text: messages.stop() });
  }

  if (wantsHuman(event.text)) {
    record({
      decision: "escalate",
      outcome: "escalated",
      reason: "customer_asked_for_person",
      ruleId: "asked_for_person",
    });
    return done({ kind: "handoff", text: messages.handoff(business), reason: "asked_for_person" });
  }

  const usable = (agent: AgentSpec | undefined): agent is AgentSpec =>
    Boolean(agent && agent.status === "live" && !blockedBy(state.switches, { agentId: agent.id }));
  const level = budgetLevel(state.budget);

  // A conversation already in a flow stays with its agent; a booking mid-confirmation is
  // finished even when the budget is used up (the agent finishes it in code).
  if (event.activeFlow) {
    const agent = state.agents.find((a) => a.id === event.activeFlow?.agentId);
    if (usable(agent) && (level !== "stopped" || event.activeFlow.midAction)) {
      record({
        decision: "route",
        outcome: "ok",
        reason: "continue_active_flow",
        ruleId: "active_flow",
        agentId: agent.id,
      });
      return done({ kind: "route", agentId: agent.id, intent: "continue" });
    }
    if (!usable(agent)) {
      record({
        decision: "escalate",
        outcome: "escalated",
        reason: "flow_agent_unavailable",
        ruleId: "active_flow",
        agentId: event.activeFlow.agentId,
      });
      return done({
        kind: "handoff",
        text: messages.handoff(business),
        reason: "agent_unavailable",
      });
    }
  }

  const faq = matchFaq(event.text, state.faq);
  if (faq) {
    record({
      decision: "answer_mode",
      outcome: "ok",
      reason: "faq_match",
      ruleId: `faq:${faq.id}`,
    });
    return done({ kind: "answer", text: faq.answer });
  }

  if (level === "stopped") {
    record({
      decision: "budget_gate",
      outcome: "denied",
      reason: "budget_used_up",
      ruleId: "budget",
    });
    return done({ kind: "take_message", text: messages.takeMessage(business) });
  }

  const live = state.agents.filter(usable);
  if (live.length === 0) {
    record({
      decision: "escalate",
      outcome: "escalated",
      reason: "no_live_agents",
      ruleId: "no_agents",
    });
    return done({ kind: "take_message", text: messages.takeMessage(business) });
  }
  const intents = [...new Set(live.flatMap((a) => a.intents)), OTHER];

  // Classifier chain: paid models are skipped in saver mode; switched-off providers are skipped.
  if (level === "saver")
    record({
      decision: "budget_gate",
      outcome: "ok",
      reason: "saver_mode_free_models_only",
      ruleId: "budget",
    });
  const chain = classifiers.filter(
    (c) => !(level === "saver" && c.paid) && !blockedBy(state.switches, { provider: c.provider }),
  );
  let found: Classification | null = null;
  let depth = 0;
  for (const classifier of chain) {
    const result = await safeClassify(classifier, event.text, intents);
    if (result) {
      found = result;
      break;
    }
    record({
      decision: "model_select",
      outcome: "failed",
      reason: "classifier_failed",
      provider: classifier.provider,
      fallbackDepth: depth,
      errorCode: "classifier_failed",
    });
    depth += 1;
  }
  if (!found) {
    record({
      decision: "escalate",
      outcome: "escalated",
      reason: "no_classifier_available",
      provider: "fallback",
      fallbackDepth: depth,
    });
    return done({ kind: "take_message", text: messages.takeMessage(business) });
  }

  const intent = intents.includes(found.intent) ? found.intent : OTHER;
  const confidence = Math.min(
    1,
    Math.max(0, Number.isFinite(found.confidence) ? found.confidence : 0),
  );
  const agent = intent === OTHER ? undefined : live.find((a) => a.intents.includes(intent));
  const model = {
    intent,
    confidence,
    provider: found.provider,
    model: found.model,
    fallbackDepth: depth,
    inputTokens: found.inputTokens,
    outputTokens: found.outputTokens,
    costMicros: found.costMicros,
    latencyMs: found.latencyMs,
  };

  if (agent && confidence >= ROUTE_AT) {
    record({
      ...model,
      decision: "route",
      outcome: "ok",
      reason: "confident_match",
      agentId: agent.id,
    });
    return done({ kind: "route", agentId: agent.id, intent });
  }
  // Ask only when unsure; a confident "none of our agents does this" goes straight to a person.
  const unsure = confidence >= ASK_AT && confidence < ROUTE_AT;
  if (unsure && event.clarifications < MAX_CLARIFICATIONS) {
    record({
      ...model,
      decision: "route",
      outcome: "asked",
      reason: "unsure_ask_once",
      agentId: agent?.id ?? null,
    });
    return done({ kind: "ask", text: messages.ask(intents.filter((i) => i !== OTHER)) });
  }
  const reason =
    confidence >= ROUTE_AT && !agent
      ? "no_matching_agent"
      : unsure
        ? "still_unclear"
        : "low_confidence";
  record({
    ...model,
    decision: "escalate",
    outcome: "escalated",
    reason,
    agentId: agent?.id ?? null,
  });
  return done({ kind: "handoff", text: messages.handoff(business), reason });
}

async function safeClassify(classifier: Classifier, text: string, intents: readonly string[]) {
  try {
    return await classifier.classify(text, intents);
  } catch {
    return null;
  }
}
