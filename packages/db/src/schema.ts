import {
  bigint,
  index,
  jsonb,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";

/**
 * Typed view of migrations/0001_portal_foundations.sql. The SQL file is the source of truth
 * (it also holds the row-level security policies); keep both in sync. Tested in
 * `rls.test.ts`, which runs the SQL and queries through this schema.
 */

export const organizations = pgTable("organizations", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),
  plan: text("plan", { enum: ["pilot", "standard", "custom"] })
    .notNull()
    .default("pilot"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const memberships = pgTable(
  "memberships",
  {
    orgId: uuid("org_id").notNull(),
    userId: uuid("user_id").notNull(),
    role: text("role", { enum: ["owner", "staff"] }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.orgId, t.userId] }), index("memberships_user_idx").on(t.userId)],
);

export const agents = pgTable("agents", {
  id: uuid("id").primaryKey().defaultRandom(),
  orgId: uuid("org_id").notNull(),
  type: text("type", { enum: ["receptionist"] }).notNull(),
  status: text("status", { enum: ["draft", "live", "paused"] })
    .notNull()
    .default("draft"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const profileVersions = pgTable("profile_versions", {
  id: uuid("id").primaryKey().defaultRandom(),
  agentId: uuid("agent_id").notNull(),
  orgId: uuid("org_id").notNull(),
  profile: jsonb("profile").notNull(),
  createdBy: uuid("created_by"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  publishedAt: timestamp("published_at", { withTimezone: true }),
});

export const auditLog = pgTable("audit_log", {
  id: bigint("id", { mode: "number" }).primaryKey().generatedAlwaysAsIdentity(),
  orgId: uuid("org_id"),
  userId: uuid("user_id"),
  action: text("action").notNull(),
  target: text("target"),
  at: timestamp("at", { withTimezone: true }).notNull().defaultNow(),
});

export const wyrmAdmins = pgTable("wyrm_admins", {
  userId: uuid("user_id").primaryKey(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type Organization = typeof organizations.$inferSelect;
export type Membership = typeof memberships.$inferSelect;
export type Agent = typeof agents.$inferSelect;
export type ProfileVersion = typeof profileVersions.$inferSelect;
export type Role = Membership["role"];
