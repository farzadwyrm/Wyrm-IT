import {
  bigint,
  boolean,
  date,
  integer,
  jsonb,
  numeric,
  pgTable,
  primaryKey,
  smallint,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";

/**
 * Typed view of the live schema after migrations 0001–0006. The SQL files are the source of
 * truth (they also hold row-level security, constraints and triggers); keep both in sync.
 * Tested in `rls.test.ts`.
 */

const ts = (name: string) => timestamp(name, { withTimezone: true });

export const PLATFORM_ROLES = ["super_admin", "platform_admin", "support", "billing"] as const;
export type PlatformRole = (typeof PLATFORM_ROLES)[number];

export const platformUsers = pgTable("platform_users", {
  id: uuid("id").primaryKey(),
  email: text("email").notNull().unique(),
  name: text("name"),
  platformRole: text("platform_role", { enum: PLATFORM_ROLES }).notNull(),
  status: text("status", { enum: ["active", "disabled"] })
    .notNull()
    .default("active"),
  createdAt: ts("created_at").notNull().defaultNow(),
  lastLoginAt: ts("last_login_at"),
});

export const tenants = pgTable("tenants", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),
  plan: text("plan", { enum: ["pilot", "starter", "growth", "enterprise"] })
    .notNull()
    .default("pilot"),
  seatLimit: integer("seat_limit").notNull().default(5),
  agentLimit: integer("agent_limit").notNull().default(1),
  status: text("status", { enum: ["active", "suspended"] })
    .notNull()
    .default("active"),
  features: jsonb("features").notNull().default({}),
  security: jsonb("security").notNull().default({}),
  /** Monthly AI budget in USD millionths (2_000_000 = $2.00). */
  aiMonthlyBudgetMicros: bigint("ai_monthly_budget_micros", { mode: "number" })
    .notNull()
    .default(2_000_000),
  retentionDays: integer("retention_days").notNull().default(180),
  createdAt: ts("created_at").notNull().defaultNow(),
});

export const roles = pgTable("roles", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: uuid("tenant_id"),
  key: text("key").notNull(),
  name: text("name").notNull(),
  rank: integer("rank").notNull(),
  permissions: text("permissions").array().notNull(),
  builtIn: boolean("built_in").notNull().default(false),
  createdAt: ts("created_at").notNull().defaultNow(),
});

export const tenantUsers = pgTable("tenant_users", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: uuid("tenant_id").notNull(),
  userId: uuid("user_id").notNull(),
  email: text("email").notNull(),
  name: text("name"),
  roleId: uuid("role_id").notNull(),
  isOwner: boolean("is_owner").notNull().default(false),
  status: text("status", { enum: ["active", "deactivated"] })
    .notNull()
    .default("active"),
  createdAt: ts("created_at").notNull().defaultNow(),
  lastLoginAt: ts("last_login_at"),
});

export const teams = pgTable("teams", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: uuid("tenant_id").notNull(),
  name: text("name").notNull(),
  createdAt: ts("created_at").notNull().defaultNow(),
});

export const teamMembers = pgTable(
  "team_members",
  {
    teamId: uuid("team_id").notNull(),
    tenantUserId: uuid("tenant_user_id").notNull(),
    tenantId: uuid("tenant_id").notNull(),
    isManager: boolean("is_manager").notNull().default(false),
  },
  (t) => [primaryKey({ columns: [t.teamId, t.tenantUserId] })],
);

export const agents = pgTable("agents", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: uuid("tenant_id").notNull(),
  name: text("name").notNull(),
  type: text("type").notNull(),
  status: text("status", { enum: ["draft", "live", "paused"] })
    .notNull()
    .default("draft"),
  config: jsonb("config").notNull().default({}),
  createdAt: ts("created_at").notNull().defaultNow(),
});

export const agentAccess = pgTable(
  "agent_access",
  {
    agentId: uuid("agent_id").notNull(),
    tenantId: uuid("tenant_id").notNull(),
    subjectType: text("subject_type", { enum: ["user", "team"] }).notNull(),
    subjectId: uuid("subject_id").notNull(),
    level: text("level", { enum: ["use", "configure", "view_logs"] }).notNull(),
    createdAt: ts("created_at").notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.agentId, t.subjectType, t.subjectId] })],
);

export const agentSettingsVersions = pgTable("agent_settings_versions", {
  id: uuid("id").primaryKey().defaultRandom(),
  agentId: uuid("agent_id").notNull(),
  tenantId: uuid("tenant_id").notNull(),
  settings: jsonb("settings").notNull(),
  createdBy: uuid("created_by"),
  createdAt: ts("created_at").notNull().defaultNow(),
  publishedAt: ts("published_at"),
});

export const invitations = pgTable("invitations", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: uuid("tenant_id").notNull(),
  email: text("email").notNull(),
  roleId: uuid("role_id").notNull(),
  tokenHash: text("token_hash").notNull().unique(),
  invitedBy: uuid("invited_by"),
  status: text("status", { enum: ["pending", "accepted", "revoked", "expired"] })
    .notNull()
    .default("pending"),
  expiresAt: ts("expires_at").notNull(),
  createdAt: ts("created_at").notNull().defaultNow(),
  acceptedAt: ts("accepted_at"),
});

export const auditLogs = pgTable("audit_logs", {
  id: bigint("id", { mode: "number" }).primaryKey().generatedAlwaysAsIdentity(),
  tenantId: uuid("tenant_id"),
  actorType: text("actor_type", { enum: ["platform", "tenant", "system"] }).notNull(),
  actorId: uuid("actor_id"),
  action: text("action").notNull(),
  targetType: text("target_type"),
  targetId: text("target_id"),
  metadata: jsonb("metadata").notNull().default({}),
  ip: text("ip"),
  createdAt: ts("created_at").notNull().defaultNow(),
});

export const impersonationSessions = pgTable("impersonation_sessions", {
  id: uuid("id").primaryKey().defaultRandom(),
  platformUserId: uuid("platform_user_id").notNull(),
  tenantId: uuid("tenant_id").notNull(),
  tenantUserId: uuid("tenant_user_id").notNull(),
  reason: text("reason").notNull(),
  readOnly: boolean("read_only").notNull(),
  startedAt: ts("started_at").notNull().defaultNow(),
  expiresAt: ts("expires_at").notNull(),
  endedAt: ts("ended_at"),
});

// Agent operations (0004): conversations, brain decisions, approvals, teaching, usage, switches.

export const CHANNELS = ["voice", "web_chat", "sms", "email", "whatsapp", "form"] as const;
export type Channel = (typeof CHANNELS)[number];
export const OUTCOMES = [
  "resolved_confirmed",
  "resolved_assumed",
  "booked",
  "lead",
  "handed_off",
  "abandoned",
  "failed",
] as const;
export type Outcome = (typeof OUTCOMES)[number];
export const DECISION_TYPES = [
  "route",
  "answer_mode",
  "model_select",
  "tool_authorize",
  "escalate",
  "budget_gate",
  "compact",
  "schedule",
] as const;
export const DECISION_OUTCOMES = ["ok", "asked", "held", "denied", "escalated", "failed"] as const;
export const PROVIDERS = ["code", "anthropic", "groq", "fallback"] as const;
export const APPROVAL_STATUSES = [
  "pending",
  "approved",
  "rejected",
  "expired",
  "executed",
] as const;
export const SWITCH_SCOPES = ["global", "tenant", "agent", "tool", "provider"] as const;

export const conversations = pgTable("conversations", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: uuid("tenant_id").notNull(),
  agentId: uuid("agent_id"),
  configVersionId: uuid("config_version_id"),
  channel: text("channel", { enum: CHANNELS }).notNull(),
  customerRef: text("customer_ref"),
  customerLabel: text("customer_label"),
  status: text("status", { enum: ["active", "ended"] })
    .notNull()
    .default("active"),
  outcome: text("outcome", { enum: OUTCOMES }),
  summary: text("summary"),
  topics: text("topics").array().notNull().default([]),
  flags: text("flags").array().notNull().default([]),
  qualityScore: smallint("quality_score"),
  aiDisclosed: boolean("ai_disclosed").notNull().default(false),
  startedAt: ts("started_at").notNull().defaultNow(),
  endedAt: ts("ended_at"),
  purgeAfter: ts("purge_after").notNull().defaultNow(),
  /** Running procedure and the details collected so far (0005). */
  state: jsonb("state").notNull().default({}),
});

export const conversationMessages = pgTable("conversation_messages", {
  id: bigint("id", { mode: "number" }).primaryKey().generatedAlwaysAsIdentity(),
  conversationId: uuid("conversation_id").notNull(),
  tenantId: uuid("tenant_id").notNull(),
  role: text("role", { enum: ["customer", "agent", "staff", "system"] }).notNull(),
  body: text("body").notNull(),
  createdAt: ts("created_at").notNull().defaultNow(),
});

export const agentDecisions = pgTable("agent_decisions", {
  id: bigint("id", { mode: "number" }).primaryKey().generatedAlwaysAsIdentity(),
  tenantId: uuid("tenant_id").notNull(),
  conversationId: uuid("conversation_id"),
  agentId: uuid("agent_id"),
  configVersionId: uuid("config_version_id"),
  decision: text("decision", { enum: DECISION_TYPES }).notNull(),
  intent: text("intent"),
  confidence: numeric("confidence", { precision: 4, scale: 3, mode: "number" }),
  ruleId: text("rule_id"),
  outcome: text("outcome", { enum: DECISION_OUTCOMES }).notNull(),
  reason: text("reason"),
  tool: text("tool"),
  riskTier: smallint("risk_tier"),
  approvalId: uuid("approval_id"),
  provider: text("provider", { enum: PROVIDERS }),
  model: text("model"),
  fallbackDepth: smallint("fallback_depth").notNull().default(0),
  inputTokens: integer("input_tokens").notNull().default(0),
  outputTokens: integer("output_tokens").notNull().default(0),
  costMicros: bigint("cost_micros", { mode: "number" }).notNull().default(0),
  latencyMs: integer("latency_ms"),
  retries: smallint("retries").notNull().default(0),
  errorCode: text("error_code"),
  guardrailFlags: text("guardrail_flags").array().notNull().default([]),
  createdAt: ts("created_at").notNull().defaultNow(),
});

export const approvals = pgTable("approvals", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: uuid("tenant_id").notNull(),
  agentId: uuid("agent_id"),
  conversationId: uuid("conversation_id"),
  action: text("action").notNull(),
  riskTier: smallint("risk_tier").notNull(),
  summary: text("summary").notNull(),
  payload: jsonb("payload").notNull().default({}),
  payloadHash: text("payload_hash").notNull(),
  status: text("status", { enum: APPROVAL_STATUSES }).notNull().default("pending"),
  requestedAt: ts("requested_at").notNull().defaultNow(),
  expiresAt: ts("expires_at").notNull(),
  decidedBy: uuid("decided_by"),
  decidedAt: ts("decided_at"),
  decisionReason: text("decision_reason"),
  executedAt: ts("executed_at"),
});

export const agentTests = pgTable("agent_tests", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: uuid("tenant_id").notNull(),
  agentId: uuid("agent_id").notNull(),
  name: text("name").notNull(),
  turns: text("turns").array().notNull(),
  expectation: text("expectation").notNull(),
  expectedOutcome: text("expected_outcome", {
    enum: ["resolved_confirmed", "booked", "lead", "handed_off"],
  }),
  source: text("source", { enum: ["manual", "conversation", "correction"] })
    .notNull()
    .default("manual"),
  sourceConversationId: uuid("source_conversation_id"),
  active: boolean("active").notNull().default(true),
  /** What the agent must do: "none", "book.request", "cancel.held"... (0006). */
  expectedAction: text("expected_action"),
  expectedHandoff: boolean("expected_handoff"),
  required: boolean("required").notNull().default(true),
  template: text("template"),
  createdBy: uuid("created_by"),
  createdAt: ts("created_at").notNull().defaultNow(),
});

export const agentTestRuns = pgTable("agent_test_runs", {
  id: bigint("id", { mode: "number" }).primaryKey().generatedAlwaysAsIdentity(),
  tenantId: uuid("tenant_id").notNull(),
  agentId: uuid("agent_id").notNull(),
  testId: uuid("test_id").notNull(),
  configVersionId: uuid("config_version_id"),
  passed: boolean("passed").notNull(),
  score: smallint("score"),
  notes: text("notes"),
  ranAt: ts("ran_at").notNull().defaultNow(),
  batchId: uuid("batch_id"),
  replyOk: boolean("reply_ok"),
  actionOk: boolean("action_ok"),
  handoffOk: boolean("handoff_ok"),
  transcript: jsonb("transcript").notNull().default([]),
  trace: jsonb("trace").notNull().default([]),
});

export const agentTestBatches = pgTable("agent_test_batches", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: uuid("tenant_id").notNull(),
  agentId: uuid("agent_id").notNull(),
  target: text("target", { enum: ["draft", "live"] }).notNull(),
  startedBy: uuid("started_by"),
  total: integer("total").notNull().default(0),
  passed: integer("passed").notNull().default(0),
  requiredFailed: integer("required_failed").notNull().default(0),
  createdAt: ts("created_at").notNull().defaultNow(),
});

export const corrections = pgTable("corrections", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: uuid("tenant_id").notNull(),
  agentId: uuid("agent_id").notNull(),
  conversationId: uuid("conversation_id"),
  messageId: bigint("message_id", { mode: "number" }),
  topic: text("topic"),
  wrongAnswer: text("wrong_answer"),
  correctAnswer: text("correct_answer").notNull(),
  status: text("status", { enum: ["draft", "active", "retired"] })
    .notNull()
    .default("active"),
  testId: uuid("test_id"),
  createdBy: uuid("created_by"),
  createdAt: ts("created_at").notNull().defaultNow(),
});

export const usageDaily = pgTable("usage_daily", {
  id: bigint("id", { mode: "number" }).primaryKey().generatedAlwaysAsIdentity(),
  tenantId: uuid("tenant_id").notNull(),
  agentId: uuid("agent_id"),
  day: date("day").notNull(),
  conversations: integer("conversations").notNull().default(0),
  llmCalls: integer("llm_calls").notNull().default(0),
  inputTokens: bigint("input_tokens", { mode: "number" }).notNull().default(0),
  outputTokens: bigint("output_tokens", { mode: "number" }).notNull().default(0),
  costMicros: bigint("cost_micros", { mode: "number" }).notNull().default(0),
});

export const killSwitches = pgTable("kill_switches", {
  id: uuid("id").primaryKey().defaultRandom(),
  scope: text("scope", { enum: SWITCH_SCOPES }).notNull(),
  tenantId: uuid("tenant_id"),
  agentId: uuid("agent_id"),
  target: text("target"),
  reason: text("reason").notNull(),
  setBy: uuid("set_by"),
  automatic: boolean("automatic").notNull().default(false),
  createdAt: ts("created_at").notNull().defaultNow(),
  clearedAt: ts("cleared_at"),
  clearedBy: uuid("cleared_by"),
});

// Agent Studio (0005): facts, rules, procedures, limits and the change log.

export const PROCEDURE_TEMPLATES = [
  "book",
  "reschedule",
  "cancel",
  "message",
  "transfer",
  "quote",
] as const;
export type ProcedureTemplate = (typeof PROCEDURE_TEMPLATES)[number];

export const businessProfiles = pgTable("business_profiles", {
  tenantId: uuid("tenant_id").primaryKey(),
  profile: jsonb("profile").notNull().default({}),
  updatedBy: uuid("updated_by"),
  updatedAt: ts("updated_at").notNull().defaultNow(),
});

export const agentRules = pgTable("agent_rules", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: uuid("tenant_id").notNull(),
  agentId: uuid("agent_id").notNull(),
  text: text("text").notNull(),
  scope: jsonb("scope").notNull().default({}),
  priority: smallint("priority").notNull().default(0),
  enabled: boolean("enabled").notNull().default(true),
  createdBy: uuid("created_by"),
  createdAt: ts("created_at").notNull().defaultNow(),
  updatedAt: ts("updated_at").notNull().defaultNow(),
});

export const agentProcedures = pgTable("agent_procedures", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: uuid("tenant_id").notNull(),
  agentId: uuid("agent_id").notNull(),
  template: text("template", { enum: PROCEDURE_TEMPLATES }).notNull(),
  name: text("name").notNull(),
  whenToUse: text("when_to_use").notNull(),
  whenNotToUse: text("when_not_to_use").notNull().default(""),
  requiredInfo: jsonb("required_info").notNull().default([]),
  steps: text("steps").array().notNull().default([]),
  confirmBeforeActing: boolean("confirm_before_acting").notNull().default(true),
  enabled: boolean("enabled").notNull().default(true),
  createdBy: uuid("created_by"),
  createdAt: ts("created_at").notNull().defaultNow(),
  updatedAt: ts("updated_at").notNull().defaultNow(),
});

export const agentLimits = pgTable("agent_limits", {
  agentId: uuid("agent_id").primaryKey(),
  tenantId: uuid("tenant_id").notNull(),
  maxDiscountPercent: smallint("max_discount_percent").notNull().default(0),
  bookingWindowDays: smallint("booking_window_days").notNull().default(30),
  minNoticeHours: smallint("min_notice_hours").notNull().default(2),
  cancellationNoticeHours: smallint("cancellation_notice_hours").notNull().default(24),
  afterHours: text("after_hours", { enum: ["answer", "take_message", "handoff"] })
    .notNull()
    .default("take_message"),
  blockedTopics: text("blocked_topics").array().notNull().default([]),
  handoffContact: text("handoff_contact").notNull().default(""),
  handoffWhen: text("handoff_when").array().notNull().default(["asked", "frustrated", "loop"]),
  tone: text("tone", { enum: ["friendly", "formal", "brief"] })
    .notNull()
    .default("friendly"),
  replyLength: text("reply_length", { enum: ["short", "medium"] })
    .notNull()
    .default("short"),
  updatedBy: uuid("updated_by"),
  updatedAt: ts("updated_at").notNull().defaultNow(),
});

export const policyChanges = pgTable("policy_changes", {
  id: bigint("id", { mode: "number" }).primaryKey().generatedAlwaysAsIdentity(),
  tenantId: uuid("tenant_id").notNull(),
  agentId: uuid("agent_id"),
  objectType: text("object_type", {
    enum: ["profile", "rule", "procedure", "limits", "publish", "restore"],
  }).notNull(),
  objectId: text("object_id"),
  action: text("action", {
    enum: ["create", "update", "delete", "enable", "disable", "publish", "restore"],
  }).notNull(),
  note: text("note").notNull(),
  before: jsonb("before"),
  after: jsonb("after"),
  changedBy: uuid("changed_by"),
  createdAt: ts("created_at").notNull().defaultNow(),
});

export type PlatformUser = typeof platformUsers.$inferSelect;
export type Tenant = typeof tenants.$inferSelect;
export type Role = typeof roles.$inferSelect;
export type TenantUser = typeof tenantUsers.$inferSelect;
export type Team = typeof teams.$inferSelect;
export type Agent = typeof agents.$inferSelect;
export type AgentAccess = typeof agentAccess.$inferSelect;
export type Invitation = typeof invitations.$inferSelect;
export type AuditLog = typeof auditLogs.$inferSelect;
export type ImpersonationSession = typeof impersonationSessions.$inferSelect;
export type Conversation = typeof conversations.$inferSelect;
export type ConversationMessage = typeof conversationMessages.$inferSelect;
export type AgentDecision = typeof agentDecisions.$inferSelect;
export type Approval = typeof approvals.$inferSelect;
export type AgentTest = typeof agentTests.$inferSelect;
export type AgentTestRun = typeof agentTestRuns.$inferSelect;
export type Correction = typeof corrections.$inferSelect;
export type UsageDaily = typeof usageDaily.$inferSelect;
export type KillSwitch = typeof killSwitches.$inferSelect;
export type BusinessProfileRow = typeof businessProfiles.$inferSelect;
export type AgentRule = typeof agentRules.$inferSelect;
export type AgentProcedure = typeof agentProcedures.$inferSelect;
export type AgentLimitsRow = typeof agentLimits.$inferSelect;
export type PolicyChange = typeof policyChanges.$inferSelect;
export type AgentTestBatch = typeof agentTestBatches.$inferSelect;
