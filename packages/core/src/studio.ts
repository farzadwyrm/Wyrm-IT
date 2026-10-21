import {
  type BusinessProfile,
  DAYS,
  DEFAULT_LIMITS,
  findConflicts,
  type InfoField,
  type Limits,
  type Policy,
  type Procedure,
  procedureFromTemplate,
  type Rule,
  type RuleScope,
  TEMPLATES,
  type Template,
} from "@wyrm/brain";
import {
  agentLimits,
  agentProcedures,
  agentRules,
  businessProfiles,
  type PROCEDURE_TEMPLATES,
  policyChanges,
} from "@wyrm/db";
import { and, asc, desc, eq } from "drizzle-orm";
import { audit } from "./audit";
import { type Ctx, DomainError, guarded } from "./context";
import { agentGate, publishVersion, saveDraft } from "./operations";

/**
 * Agent Studio: what a business controls about its agents (facts, rules, procedures, limits).
 * Edits are the draft; `publishPolicy` snapshots them into a new live settings version.
 * Every change needs a short "what changed" note and lands in the change log and audit log.
 */

const CHANNELS = ["voice", "web_chat", "sms", "email", "whatsapp", "form"] as const;
const HHMM = /^([01]\d|2[0-3]):[0-5]\d$/;
const clip = (v: unknown, max: number) => (typeof v === "string" ? v.trim().slice(0, max) : "");

function editor(ctx: Ctx) {
  return ctx.actor?.kind === "impersonating" ? null : (ctx.actor?.userId ?? null);
}

function requireNote(note: string) {
  const n = note.trim();
  if (n.length < 3)
    throw new DomainError("note_required", "Say briefly what changed (a few words).");
  return n.slice(0, 500);
}

async function logChange(
  ctx: Ctx,
  entry: {
    tenantId: string;
    agentId: string | null;
    objectType: "profile" | "rule" | "procedure" | "limits" | "publish" | "restore";
    objectId?: string | null | undefined;
    action: "create" | "update" | "delete" | "enable" | "disable" | "publish" | "restore";
    note: string;
    before?: unknown;
    after?: unknown;
  },
) {
  await ctx.db.insert(policyChanges).values({
    tenantId: entry.tenantId,
    agentId: entry.agentId,
    objectType: entry.objectType,
    objectId: entry.objectId ?? null,
    action: entry.action,
    note: entry.note,
    before: entry.before ?? null,
    after: entry.after ?? null,
    changedBy: editor(ctx),
  });
  await audit(ctx, {
    action: `policy.${entry.objectType}.${entry.action}`,
    tenantId: entry.tenantId,
    targetType: entry.objectType,
    targetId: entry.objectId ?? entry.agentId ?? entry.tenantId,
    before: entry.before,
    after: entry.after,
    extra: { note: entry.note },
  });
}

// ---------------------------------------------------------------------------------------------
// Validation: everything coming from forms is cleaned here.

export function cleanProfile(input: unknown): BusinessProfile {
  const p = (input ?? {}) as Record<string, unknown>;
  const hours: BusinessProfile["hours"] = {};
  const rawHours = (p.hours ?? {}) as Record<string, { open?: string; close?: string } | null>;
  for (const day of DAYS) {
    const slot = rawHours[day];
    if (
      slot?.open &&
      slot.close &&
      HHMM.test(slot.open) &&
      HHMM.test(slot.close) &&
      slot.open < slot.close
    )
      hours[day] = { open: slot.open, close: slot.close };
    else hours[day] = null;
  }
  const list = <T>(v: unknown, max: number, map: (x: Record<string, unknown>) => T | null) =>
    (Array.isArray(v) ? v : [])
      .slice(0, max)
      .map((x) => map((x ?? {}) as Record<string, unknown>))
      .filter((x): x is T => x !== null);
  return {
    summary: clip(p.summary, 600),
    timezone: clip(p.timezone, 60) || "Europe/Lisbon",
    hours,
    services: list(p.services, 50, (s) => {
      const name = clip(s.name, 80);
      return name ? { name, price: clip(s.price, 40), duration: clip(s.duration, 40) } : null;
    }),
    locations: list(p.locations, 10, (l) => {
      const address = clip(l.address, 200);
      return address ? { name: clip(l.name, 80), address } : null;
    }),
    faqs: list(p.faqs, 40, (f) => {
      const question = clip(f.question, 200);
      const answer = clip(f.answer, 600);
      return question && answer ? { question, answer } : null;
    }),
    other: clip(p.other, 2000),
  };
}

export function cleanScope(input: unknown): RuleScope {
  const s = (input ?? {}) as Record<string, unknown>;
  const channels = (Array.isArray(s.channels) ? s.channels : []).filter(
    (c): c is (typeof CHANNELS)[number] => CHANNELS.includes(c as (typeof CHANNELS)[number]),
  );
  const when = ["open", "closed"].includes(s.when as string)
    ? (s.when as "open" | "closed")
    : "any";
  const callers = ["new", "returning"].includes(s.callers as string)
    ? (s.callers as "new" | "returning")
    : "any";
  return { channels, when, callers };
}

export function cleanLimits(input: unknown): Limits {
  const l = (input ?? {}) as Record<string, unknown>;
  const int = (v: unknown, min: number, max: number, fallback: number) => {
    const n = Math.round(Number(v));
    return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : fallback;
  };
  const pick = <T extends string>(v: unknown, options: readonly T[], fallback: T) =>
    options.includes(v as T) ? (v as T) : fallback;
  const topics = (
    Array.isArray(l.blockedTopics) ? l.blockedTopics : String(l.blockedTopics ?? "").split(",")
  )
    .map((t) => clip(t, 60).toLowerCase())
    .filter(Boolean)
    .slice(0, 20);
  const when = (Array.isArray(l.handoffWhen) ? l.handoffWhen : DEFAULT_LIMITS.handoffWhen).filter(
    (w) => ["asked", "frustrated", "loop", "complaint", "vip"].includes(w as string),
  ) as string[];
  return {
    maxDiscountPercent: int(l.maxDiscountPercent, 0, 100, 0),
    bookingWindowDays: int(l.bookingWindowDays, 0, 365, 30),
    minNoticeHours: int(l.minNoticeHours, 0, 168, 2),
    cancellationNoticeHours: int(l.cancellationNoticeHours, 0, 336, 24),
    afterHours: pick(l.afterHours, ["answer", "take_message", "handoff"] as const, "take_message"),
    blockedTopics: topics,
    handoffContact: clip(l.handoffContact, 200),
    handoffWhen: when,
    tone: pick(l.tone, ["friendly", "formal", "brief"] as const, "friendly"),
    replyLength: pick(l.replyLength, ["short", "medium"] as const, "short"),
  };
}

const toRule = (r: typeof agentRules.$inferSelect): Rule => ({
  id: r.id,
  text: r.text,
  scope: r.scope as RuleScope,
  priority: r.priority,
  enabled: r.enabled,
  updatedAt: r.updatedAt.toISOString(),
});

const toProcedure = (p: typeof agentProcedures.$inferSelect): Procedure => ({
  id: p.id,
  template: p.template,
  name: p.name,
  whenToUse: p.whenToUse,
  whenNotToUse: p.whenNotToUse,
  requiredInfo: p.requiredInfo as InfoField[],
  steps: p.steps,
  confirmBeforeActing: p.confirmBeforeActing,
  enabled: p.enabled,
});

const toLimits = (l: typeof agentLimits.$inferSelect | undefined): Limits =>
  l
    ? {
        maxDiscountPercent: l.maxDiscountPercent,
        bookingWindowDays: l.bookingWindowDays,
        minNoticeHours: l.minNoticeHours,
        cancellationNoticeHours: l.cancellationNoticeHours,
        afterHours: l.afterHours,
        blockedTopics: l.blockedTopics,
        handoffContact: l.handoffContact,
        handoffWhen: l.handoffWhen,
        tone: l.tone,
        replyLength: l.replyLength,
      }
    : { ...DEFAULT_LIMITS };

// ---------------------------------------------------------------------------------------------
// Read

/** The draft policy of one agent, its change log and rule conflicts. */
export async function getStudio(ctx: Ctx, tenantId: string, agentId: string) {
  agentGate(ctx, "agents.logs", tenantId, agentId);
  const [profileRow, rules, procedures, limitsRow, changes] = await Promise.all([
    ctx.db.select().from(businessProfiles).where(eq(businessProfiles.tenantId, tenantId)),
    ctx.db
      .select()
      .from(agentRules)
      .where(and(eq(agentRules.tenantId, tenantId), eq(agentRules.agentId, agentId)))
      .orderBy(desc(agentRules.priority), asc(agentRules.createdAt)),
    ctx.db
      .select()
      .from(agentProcedures)
      .where(and(eq(agentProcedures.tenantId, tenantId), eq(agentProcedures.agentId, agentId)))
      .orderBy(asc(agentProcedures.createdAt)),
    ctx.db
      .select()
      .from(agentLimits)
      .where(and(eq(agentLimits.tenantId, tenantId), eq(agentLimits.agentId, agentId))),
    ctx.db
      .select()
      .from(policyChanges)
      .where(and(eq(policyChanges.tenantId, tenantId), eq(policyChanges.agentId, agentId)))
      .orderBy(desc(policyChanges.id))
      .limit(50),
  ]);
  const policy: Policy = {
    profile: cleanProfile(profileRow[0]?.profile ?? {}),
    rules: rules.map(toRule),
    procedures: procedures.map(toProcedure),
    limits: toLimits(limitsRow[0]),
  };
  return { policy, conflicts: findConflicts(policy.rules), changes };
}

// ---------------------------------------------------------------------------------------------
// Write: facts are shared by the organisation's agents; the rest is per agent.

export async function saveProfile(
  ctx: Ctx,
  tenantId: string,
  input: unknown,
  note: string,
  agentId?: string,
) {
  agentGate(ctx, "agents.configure", tenantId, agentId ?? null);
  const n = requireNote(note);
  const profile = cleanProfile(input);
  const [before] = await ctx.db
    .select()
    .from(businessProfiles)
    .where(eq(businessProfiles.tenantId, tenantId));
  await guarded(() =>
    ctx.db
      .insert(businessProfiles)
      .values({ tenantId, profile, updatedBy: editor(ctx) })
      .onConflictDoUpdate({
        target: businessProfiles.tenantId,
        set: { profile, updatedBy: editor(ctx), updatedAt: new Date() },
      }),
  );
  await logChange(ctx, {
    tenantId,
    agentId: agentId ?? null,
    objectType: "profile",
    action: before ? "update" : "create",
    note: n,
    before: before?.profile,
    after: profile,
  });
  return profile;
}

export async function saveRule(
  ctx: Ctx,
  input: {
    tenantId: string;
    agentId: string;
    ruleId?: string;
    text: string;
    scope: unknown;
    priority?: number;
    note: string;
  },
) {
  agentGate(ctx, "agents.configure", input.tenantId, input.agentId);
  const n = requireNote(input.note);
  const text = input.text.trim();
  if (text.length < 5 || text.length > 300)
    throw new DomainError("bad_rule", "A rule is 5 to 300 characters.");
  const values = {
    text,
    scope: cleanScope(input.scope),
    priority: Math.max(-10, Math.min(10, Math.round(input.priority ?? 0))),
  };
  if (input.ruleId) {
    const [before] = await ctx.db
      .select()
      .from(agentRules)
      .where(
        and(
          eq(agentRules.id, input.ruleId),
          eq(agentRules.agentId, input.agentId),
          eq(agentRules.tenantId, input.tenantId),
        ),
      );
    if (!before) throw new DomainError("not_found", "Rule not found.");
    const [after] = await guarded(() =>
      ctx.db.update(agentRules).set(values).where(eq(agentRules.id, before.id)).returning(),
    );
    await logChange(ctx, {
      tenantId: input.tenantId,
      agentId: input.agentId,
      objectType: "rule",
      objectId: before.id,
      action: "update",
      note: n,
      before: toRule(before),
      after: after && toRule(after),
    });
    return after;
  }
  const [row] = await guarded(() =>
    ctx.db
      .insert(agentRules)
      .values({
        ...values,
        tenantId: input.tenantId,
        agentId: input.agentId,
        createdBy: editor(ctx),
      })
      .returning(),
  );
  await logChange(ctx, {
    tenantId: input.tenantId,
    agentId: input.agentId,
    objectType: "rule",
    objectId: row?.id,
    action: "create",
    note: n,
    after: row && toRule(row),
  });
  return row;
}

export async function setRuleEnabled(
  ctx: Ctx,
  input: { tenantId: string; agentId: string; ruleId: string; enabled: boolean; note: string },
) {
  agentGate(ctx, "agents.configure", input.tenantId, input.agentId);
  const n = requireNote(input.note);
  const [row] = await ctx.db
    .update(agentRules)
    .set({ enabled: input.enabled })
    .where(
      and(
        eq(agentRules.id, input.ruleId),
        eq(agentRules.agentId, input.agentId),
        eq(agentRules.tenantId, input.tenantId),
      ),
    )
    .returning();
  if (!row) throw new DomainError("not_found", "Rule not found.");
  await logChange(ctx, {
    tenantId: input.tenantId,
    agentId: input.agentId,
    objectType: "rule",
    objectId: row.id,
    action: input.enabled ? "enable" : "disable",
    note: n,
  });
}

export async function deleteRule(
  ctx: Ctx,
  input: { tenantId: string; agentId: string; ruleId: string; note: string },
) {
  agentGate(ctx, "agents.configure", input.tenantId, input.agentId);
  const n = requireNote(input.note);
  const [row] = await ctx.db
    .delete(agentRules)
    .where(
      and(
        eq(agentRules.id, input.ruleId),
        eq(agentRules.agentId, input.agentId),
        eq(agentRules.tenantId, input.tenantId),
      ),
    )
    .returning();
  if (!row) throw new DomainError("not_found", "Rule not found.");
  await logChange(ctx, {
    tenantId: input.tenantId,
    agentId: input.agentId,
    objectType: "rule",
    objectId: row.id,
    action: "delete",
    note: n,
    before: toRule(row),
  });
}

/** Adds a procedure from its template (with sensible wording the owner can then edit). */
export async function addProcedure(
  ctx: Ctx,
  input: { tenantId: string; agentId: string; template: Template; note: string },
) {
  agentGate(ctx, "agents.configure", input.tenantId, input.agentId);
  const n = requireNote(input.note);
  if (!(input.template in TEMPLATES)) throw new DomainError("bad_template", "Unknown procedure.");
  const t = procedureFromTemplate(input.template);
  const [row] = await guarded(() =>
    ctx.db
      .insert(agentProcedures)
      .values({
        tenantId: input.tenantId,
        agentId: input.agentId,
        template: input.template as (typeof PROCEDURE_TEMPLATES)[number],
        name: t.name,
        whenToUse: t.whenToUse,
        whenNotToUse: t.whenNotToUse,
        requiredInfo: t.requiredInfo,
        steps: t.steps,
        createdBy: editor(ctx),
      })
      .returning(),
  );
  await logChange(ctx, {
    tenantId: input.tenantId,
    agentId: input.agentId,
    objectType: "procedure",
    objectId: row?.id,
    action: "create",
    note: n,
    after: row && toProcedure(row),
  });
  return row;
}

export async function updateProcedure(
  ctx: Ctx,
  input: {
    tenantId: string;
    agentId: string;
    procedureId: string;
    name: string;
    whenToUse: string;
    whenNotToUse: string;
    steps: string[];
    confirmBeforeActing: boolean;
    enabled: boolean;
    note: string;
  },
) {
  agentGate(ctx, "agents.configure", input.tenantId, input.agentId);
  const n = requireNote(input.note);
  const [before] = await ctx.db
    .select()
    .from(agentProcedures)
    .where(
      and(
        eq(agentProcedures.id, input.procedureId),
        eq(agentProcedures.agentId, input.agentId),
        eq(agentProcedures.tenantId, input.tenantId),
      ),
    );
  if (!before) throw new DomainError("not_found", "Procedure not found.");
  const whenToUse = input.whenToUse.trim();
  if (whenToUse.length < 5)
    throw new DomainError("bad_procedure", "Describe when to use it (a sentence).");
  // Cancellations and quotes always go to a person: that can't be switched off here.
  const mustConfirm = before.template === "book" || before.template === "reschedule";
  const [after] = await guarded(() =>
    ctx.db
      .update(agentProcedures)
      .set({
        name: input.name.trim().slice(0, 80) || before.name,
        whenToUse: whenToUse.slice(0, 512),
        whenNotToUse: input.whenNotToUse.trim().slice(0, 512),
        steps: input.steps
          .map((s) => s.trim().slice(0, 300))
          .filter(Boolean)
          .slice(0, 12),
        confirmBeforeActing: mustConfirm ? true : input.confirmBeforeActing,
        enabled: input.enabled,
      })
      .where(eq(agentProcedures.id, before.id))
      .returning(),
  );
  await logChange(ctx, {
    tenantId: input.tenantId,
    agentId: input.agentId,
    objectType: "procedure",
    objectId: before.id,
    action: "update",
    note: n,
    before: toProcedure(before),
    after: after && toProcedure(after),
  });
  return after;
}

export async function saveLimits(
  ctx: Ctx,
  input: { tenantId: string; agentId: string; limits: unknown; note: string },
) {
  agentGate(ctx, "agents.configure", input.tenantId, input.agentId);
  const n = requireNote(input.note);
  const limits = cleanLimits(input.limits);
  const [before] = await ctx.db
    .select()
    .from(agentLimits)
    .where(and(eq(agentLimits.agentId, input.agentId), eq(agentLimits.tenantId, input.tenantId)));
  await guarded(() =>
    ctx.db
      .insert(agentLimits)
      .values({
        ...limits,
        agentId: input.agentId,
        tenantId: input.tenantId,
        updatedBy: editor(ctx),
      })
      .onConflictDoUpdate({
        target: agentLimits.agentId,
        set: { ...limits, updatedBy: editor(ctx), updatedAt: new Date() },
      }),
  );
  await logChange(ctx, {
    tenantId: input.tenantId,
    agentId: input.agentId,
    objectType: "limits",
    action: before ? "update" : "create",
    note: n,
    before: before && toLimits(before),
    after: limits,
  });
  return limits;
}

/** Publishes the draft policy: the live agent uses it from the next message. */
export async function publishPolicy(
  ctx: Ctx,
  input: { tenantId: string; agentId: string; note: string },
) {
  agentGate(ctx, "agents.configure", input.tenantId, input.agentId);
  const n = requireNote(input.note);
  const { policy, conflicts } = await getStudio(ctx, input.tenantId, input.agentId);
  const snapshot = {
    version: 2,
    profile: policy.profile,
    rules: policy.rules.filter((r) => r.enabled),
    procedures: policy.procedures.filter((p) => p.enabled),
    limits: policy.limits,
  };
  const draft = await saveDraft(ctx, {
    tenantId: input.tenantId,
    agentId: input.agentId,
    settings: snapshot,
  });
  const published = await publishVersion(ctx, {
    tenantId: input.tenantId,
    agentId: input.agentId,
    versionId: draft?.id ?? "",
  });
  await logChange(ctx, {
    tenantId: input.tenantId,
    agentId: input.agentId,
    objectType: "publish",
    objectId: published?.id,
    action: "publish",
    note: n,
    after: {
      rules: snapshot.rules.length,
      procedures: snapshot.procedures.map((p) => p.template),
      conflicts: conflicts.length,
    },
  });
  return { versionId: published?.id ?? null, conflicts };
}

/** The published policy an agent runs with (the old free-text settings are mapped onto it). */
export function policyFromConfig(config: unknown): Policy {
  const c = (config ?? {}) as Record<string, unknown>;
  if (c.version === 2) {
    return {
      profile: cleanProfile(c.profile),
      rules: Array.isArray(c.rules) ? (c.rules as Rule[]) : [],
      procedures: Array.isArray(c.procedures) ? (c.procedures as Procedure[]) : [],
      limits: cleanLimits(c.limits),
    };
  }
  return {
    profile: { other: clip(c.businessFacts, 4000), summary: clip(c.greeting, 300) },
    rules: [],
    procedures: [],
    limits: {
      ...DEFAULT_LIMITS,
      tone: ["friendly", "formal", "brief"].includes(c.tone as string)
        ? (c.tone as Limits["tone"])
        : "friendly",
      handoffContact: clip(c.handoffContact, 200),
    },
  };
}
