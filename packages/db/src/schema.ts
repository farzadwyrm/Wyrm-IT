import {
  bigint,
  boolean,
  integer,
  jsonb,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";

/**
 * Typed view of the live schema after migrations 0001–0003. The SQL files are the source of
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
