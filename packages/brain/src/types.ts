/** Shapes the brain works with. Mirrors the `agent_decisions` table without importing it. */

export type Channel = "voice" | "web_chat" | "sms" | "email" | "whatsapp" | "form";
export type Provider = "code" | "anthropic" | "groq" | "fallback";
export type RiskTier = 0 | 1 | 2 | 3;

export interface ToolSpec {
  name: string;
  tier: RiskTier;
}

export interface AgentSpec {
  id: string;
  name: string;
  /** Catalogue type, e.g. "receptionist", "quote". */
  type: string;
  status: "draft" | "live" | "paused";
  /** Intents this agent handles, e.g. ["booking", "opening_hours"]. */
  intents: readonly string[];
  tools: readonly ToolSpec[];
}

export interface FaqEntry {
  id: string;
  /** Lower-case keywords; all must appear in the message. */
  keywords: readonly string[];
  answer: string;
}

export interface ActiveSwitch {
  scope: "global" | "tenant" | "agent" | "tool" | "provider";
  agentId?: string | null;
  target?: string | null;
}

export interface Budget {
  monthlyMicros: number;
  spentTodayMicros: number;
  spentMonthMicros: number;
}

export interface TenantState {
  tenantId: string;
  businessName: string;
  agents: readonly AgentSpec[];
  faq: readonly FaqEntry[];
  budget: Budget;
  switches: readonly ActiveSwitch[];
  configVersionId?: string | null;
}

/** A flow already running in this conversation (e.g. a booking waiting for "yes"). */
export interface ActiveFlow {
  agentId: string;
  /** True when a booking or similar action is mid-confirmation: never dropped. */
  midAction: boolean;
}

export interface BrainEvent {
  channel: Channel;
  text: string;
  conversationId?: string | null;
  /** First message of the conversation: the customer must be told it's an AI. */
  firstContact: boolean;
  activeFlow?: ActiveFlow | null;
  /** Clarifying questions already asked in this conversation. */
  clarifications: number;
}

export interface Classification {
  intent: string;
  confidence: number;
  provider: Exclude<Provider, "code">;
  model: string;
  inputTokens: number;
  outputTokens: number;
  costMicros: number;
  latencyMs: number;
}

/**
 * One classifier in the chain (Haiku, Groq...). Returns null on failure (timeout, bad JSON,
 * not configured); the brain then tries the next one.
 */
export interface Classifier {
  provider: Exclude<Provider, "code">;
  /** Paid providers are skipped when the budget is in saver mode. */
  paid: boolean;
  classify(text: string, intents: readonly string[]): Promise<Classification | null>;
}

export type DecisionType =
  | "route"
  | "answer_mode"
  | "model_select"
  | "tool_authorize"
  | "escalate"
  | "budget_gate"
  | "compact"
  | "schedule";

export type DecisionOutcome = "ok" | "asked" | "held" | "denied" | "escalated" | "failed";

/** One row for `agent_decisions`. */
export interface DecisionRecord {
  tenantId: string;
  conversationId: string | null;
  agentId: string | null;
  configVersionId: string | null;
  decision: DecisionType;
  intent: string | null;
  confidence: number | null;
  ruleId: string | null;
  outcome: DecisionOutcome;
  reason: string;
  tool: string | null;
  riskTier: RiskTier | null;
  approvalId: string | null;
  provider: Provider | null;
  model: string | null;
  fallbackDepth: number;
  inputTokens: number;
  outputTokens: number;
  costMicros: number;
  latencyMs: number | null;
  retries: number;
  errorCode: string | null;
  guardrailFlags: string[];
}

/** What the brain tells the channel to do next. */
export type Action =
  | { kind: "route"; agentId: string; intent: string }
  | { kind: "answer"; text: string }
  | { kind: "ask"; text: string }
  | { kind: "handoff"; text: string; reason: string }
  | { kind: "take_message"; text: string }
  | { kind: "stop"; text: string };

export interface BrainResult {
  action: Action;
  /** Say this first when it isn't null (AI disclosure at first contact). */
  disclosure: string | null;
  records: DecisionRecord[];
  flags: string[];
}
