import { check, ForbiddenError } from "@wyrm/auth";
import {
  agentChannels,
  agentLaunches,
  agentRules,
  agentSettingsVersions,
  agents,
  agentTestBatches,
  calendarConnections,
  conversations,
  knowledgeQuestions,
  knowledgeSources,
  profileSuggestions,
  tenantUsers,
} from "@wyrm/db";
import { and, count, desc, eq, isNotNull, sql } from "drizzle-orm";
import { audit } from "./audit";
import { type Ctx, type Db, DomainError, guarded } from "./context";
import { agentGate } from "./operations";
import { cleanProfile, getStudio, saveProfile } from "./studio";

/**
 * Onboarding and delivery (roadmap phase 3): the setup tracker, the go-live gate, Wyrm's sign-off,
 * website chat widget settings, and facts suggested from the business's website.
 */

export interface SetupItem {
  key: string;
  label: string;
  done: boolean;
  hint: string;
  /** Studio tab or launch section that fixes it. */
  where: string;
}

export const PRACTICE_CONVERSATIONS = 3;

/** What's done and what's missing for one agent. Required items gate going live. */
export async function setupStatus(ctx: Ctx, tenantId: string, agentId: string) {
  agentGate(ctx, "agents.logs", tenantId, agentId);
  const [
    { policy },
    versions,
    batches,
    practice,
    live,
    channel,
    calendar,
    rules,
    team,
    launch,
    agent,
    docs,
    asked,
  ] = await Promise.all([
    getStudio(ctx, tenantId, agentId),
    ctx.db
      .select({ n: count() })
      .from(agentSettingsVersions)
      .where(
        and(
          eq(agentSettingsVersions.agentId, agentId),
          eq(agentSettingsVersions.tenantId, tenantId),
          isNotNull(agentSettingsVersions.publishedAt),
        ),
      ),
    ctx.db
      .select()
      .from(agentTestBatches)
      .where(and(eq(agentTestBatches.agentId, agentId), eq(agentTestBatches.tenantId, tenantId)))
      .orderBy(desc(agentTestBatches.createdAt))
      .limit(1),
    ctx.db
      .select({ n: count() })
      .from(conversations)
      .where(
        and(
          eq(conversations.agentId, agentId),
          eq(conversations.tenantId, tenantId),
          sql`'test' = any(${conversations.flags})`,
        ),
      ),
    ctx.db
      .select({ n: count() })
      .from(conversations)
      .where(
        and(
          eq(conversations.agentId, agentId),
          eq(conversations.tenantId, tenantId),
          sql`not ('test' = any(${conversations.flags}))`,
        ),
      ),
    ctx.db
      .select()
      .from(agentChannels)
      .where(and(eq(agentChannels.agentId, agentId), eq(agentChannels.tenantId, tenantId))),
    ctx.db
      .select({ status: calendarConnections.status })
      .from(calendarConnections)
      .where(
        and(eq(calendarConnections.agentId, agentId), eq(calendarConnections.tenantId, tenantId)),
      ),
    ctx.db
      .select({ n: count() })
      .from(agentRules)
      .where(and(eq(agentRules.agentId, agentId), eq(agentRules.enabled, true))),
    ctx.db
      .select({ n: count() })
      .from(tenantUsers)
      .where(and(eq(tenantUsers.tenantId, tenantId), eq(tenantUsers.status, "active"))),
    ctx.db
      .select()
      .from(agentLaunches)
      .where(and(eq(agentLaunches.agentId, agentId), eq(agentLaunches.tenantId, tenantId))),
    ctx.db
      .select({ status: agents.status, type: agents.type })
      .from(agents)
      .where(and(eq(agents.id, agentId), eq(agents.tenantId, tenantId))),
    ctx.db
      .select({ n: count() })
      .from(knowledgeSources)
      .where(and(eq(knowledgeSources.agentId, agentId), eq(knowledgeSources.tenantId, tenantId))),
    ctx.db
      .select({ n: count() })
      .from(knowledgeQuestions)
      .where(
        and(
          eq(knowledgeQuestions.agentId, agentId),
          eq(knowledgeQuestions.tenantId, tenantId),
          eq(knowledgeQuestions.answered, true),
        ),
      ),
  ]);
  const p = policy.profile;
  const openDays = Object.values(p.hours ?? {}).filter(Boolean).length;
  const lastBatch = batches[0];
  const practiced = Number(practice[0]?.n ?? 0);

  const isKnowledge = agent[0]?.type === "knowledge";
  const documents = Number(docs[0]?.n ?? 0);
  const answeredQuestions = Number(asked[0]?.n ?? 0);
  const required: SetupItem[] = isKnowledge
    ? [
        {
          key: "documents",
          label: "At least one document",
          done: documents > 0,
          hint: "Upload files, add web pages or import from Google Drive.",
          where: "documents",
        },
        {
          key: "practice",
          label: `${PRACTICE_CONVERSATIONS} questions answered from your documents`,
          done: answeredQuestions >= PRACTICE_CONVERSATIONS,
          hint: `Ask a few real questions (${answeredQuestions} answered so far) and check the sources.`,
          where: "ask",
        },
      ]
    : [
        {
          key: "facts",
          label: "Opening hours and at least one service",
          done: openDays > 0 && (p.services?.length ?? 0) > 0,
          hint: "Add them in Facts, or import them from your website.",
          where: "facts",
        },
        {
          key: "handoff",
          label: "Who to pass customers to",
          done: policy.limits.handoffContact.trim().length > 0,
          hint: "Set a person or team in Limits & handoff.",
          where: "limits",
        },
        {
          key: "procedure",
          label: "At least one procedure",
          done: policy.procedures.some((x) => x.enabled),
          hint: "Add Book, Take a message or another procedure.",
          where: "procedures",
        },
        {
          key: "tests",
          label: "Tests pass",
          done: Boolean(lastBatch && lastBatch.total > 0 && lastBatch.requiredFailed === 0),
          hint: "Run the tests on the Tests tab.",
          where: "tests",
        },
        {
          key: "published",
          label: "A published version",
          done: Number(versions[0]?.n ?? 0) > 0,
          hint: "Use Test & publish.",
          where: "tests",
        },
        {
          key: "practice",
          label: `${PRACTICE_CONVERSATIONS} practice chats`,
          done: practiced >= PRACTICE_CONVERSATIONS,
          hint: `Try your agent ${PRACTICE_CONVERSATIONS} times (${practiced} so far) from the agent page.`,
          where: "try",
        },
      ];
  const recommended: SetupItem[] = isKnowledge
    ? [
        {
          key: "signoff",
          label: "Wyrm sign-off",
          done: Boolean(launch[0]?.signedOffAt),
          hint: "Your Wyrm contact reviews the documents and answers before launch.",
          where: "launch",
        },
        {
          key: "handoff",
          label: "Who to ask when the documents don't say",
          done: policy.limits.handoffContact.trim().length > 0,
          hint: "Set a person or team in Limits & handoff.",
          where: "limits",
        },
        {
          key: "rules",
          label: "At least one rule",
          done: Number(rules[0]?.n ?? 0) > 0,
          hint: 'For example "Never share salary details."',
          where: "rules",
        },
        {
          key: "team",
          label: "A teammate invited",
          done: Number(team[0]?.n ?? 0) > 1,
          hint: "Invite your team in Settings so they can ask questions.",
          where: "settings",
        },
      ]
    : [
        {
          key: "signoff",
          label: "Wyrm sign-off",
          done: Boolean(launch[0]?.signedOffAt),
          hint: "Your Wyrm contact reviews the setup before launch.",
          where: "launch",
        },
        {
          key: "channel",
          label: "Website chat installed",
          done: Boolean(channel[0]?.widgetEnabled) || Number(live[0]?.n ?? 0) > 0,
          hint: "Turn on the website widget and paste the snippet.",
          where: "launch",
        },
        {
          key: "calendar",
          label: "Calendar connected",
          done: calendar[0]?.status === "ok",
          hint: "Connect Google Calendar so bookings use real availability.",
          where: "launch",
        },
        {
          key: "faqs",
          label: "At least 3 frequent questions",
          done: (p.faqs?.length ?? 0) >= 3,
          hint: "Add common questions in Facts.",
          where: "facts",
        },
        {
          key: "rules",
          label: "At least one rule",
          done: Number(rules[0]?.n ?? 0) > 0,
          hint: "Add a short rule in Rules.",
          where: "rules",
        },
        {
          key: "team",
          label: "A teammate invited",
          done: Number(team[0]?.n ?? 0) > 1,
          hint: "Invite someone in Settings.",
          where: "settings",
        },
      ];
  const missing = required.filter((i) => !i.done);
  const signedOff = Boolean(launch[0]?.signedOffAt);
  return {
    required,
    recommended,
    done: required.filter((i) => i.done).length + recommended.filter((i) => i.done).length,
    total: required.length + recommended.length,
    readyToLaunch: missing.length === 0 && signedOff,
    missing,
    signedOff,
    launch: launch[0] ?? null,
    status: agent[0]?.status ?? "draft",
  };
}

/** Customers can switch an agent on only when setup is complete and Wyrm has signed it off. */
export async function assertReadyToGoLive(ctx: Ctx, tenantId: string, agentId: string) {
  if (ctx.actor?.kind === "platform") return; // Wyrm staff may switch on directly (they sign off)
  const status = await setupStatus(ctx, tenantId, agentId);
  if (status.status === "paused" && status.signedOff) return; // resuming a launched agent
  if (!status.readyToLaunch) {
    const reasons = status.missing.map((i) => i.label.toLowerCase());
    if (!status.signedOff) reasons.push("Wyrm sign-off");
    throw new DomainError("not_ready", `Before going live: ${reasons.join(", ")}.`);
  }
}

/** Wyrm staff confirm the setup was reviewed and the agent may launch. */
export async function signOffLaunch(
  ctx: Ctx,
  input: { tenantId: string; agentId: string; note: string },
) {
  const d = check(ctx.actor, "platform_agents.manage");
  if (!d.allowed || ctx.actor?.kind !== "platform")
    throw new ForbiddenError("platform_agents.manage", d.allowed ? "platform_only" : d.reason);
  const note = input.note.trim().slice(0, 500);
  if (note.length < 3) throw new DomainError("note_required", "Add a short sign-off note.");
  const staffId = ctx.actor.userId;
  await guarded(() =>
    ctx.db
      .insert(agentLaunches)
      .values({
        agentId: input.agentId,
        tenantId: input.tenantId,
        signedOffBy: staffId,
        signedOffAt: new Date(),
        note,
      })
      .onConflictDoUpdate({
        target: agentLaunches.agentId,
        set: { signedOffBy: staffId, signedOffAt: new Date(), note },
      }),
  );
  await audit(ctx, {
    action: "launch.signed_off",
    tenantId: input.tenantId,
    targetType: "agent",
    targetId: input.agentId,
    after: { note },
  });
}

// ---------------------------------------------------------------------------------------------
// Website chat widget

const ORIGIN = /^https:\/\/[a-z0-9.-]+(:\d{2,5})?$/;

export function cleanOrigins(input: string): string[] {
  return [
    ...new Set(
      input
        .split(/[\s,]+/)
        .map((o) => o.trim().toLowerCase().replace(/\/+$/, ""))
        .map((o) => (o && !o.startsWith("http") ? `https://${o}` : o))
        .filter((o) => ORIGIN.test(o)),
    ),
  ].slice(0, 10);
}

export async function getChannel(db: Db, agentId: string) {
  const [row] = await db.select().from(agentChannels).where(eq(agentChannels.agentId, agentId));
  return row ?? null;
}

export async function saveChannel(
  ctx: Ctx,
  input: {
    tenantId: string;
    agentId: string;
    enabled: boolean;
    origins: string;
    color: string;
    label: string;
  },
) {
  agentGate(ctx, "agents.configure", input.tenantId, input.agentId);
  const values = {
    widgetEnabled: input.enabled,
    widgetOrigins: cleanOrigins(input.origins),
    widgetColor: /^#[0-9a-fA-F]{6}$/.test(input.color) ? input.color : "#e8590c",
    widgetLabel: input.label.trim().slice(0, 40) || "Chat with us",
    updatedAt: new Date(),
  };
  if (values.widgetLabel.length < 2) values.widgetLabel = "Chat with us";
  await guarded(() =>
    ctx.db
      .insert(agentChannels)
      .values({ ...values, agentId: input.agentId, tenantId: input.tenantId })
      .onConflictDoUpdate({ target: agentChannels.agentId, set: values }),
  );
  await audit(ctx, {
    action: "channel.widget_saved",
    tenantId: input.tenantId,
    targetType: "agent",
    targetId: input.agentId,
    after: values,
  });
  return values;
}

/** Whether a page on `origin` may show this agent's widget (empty list = any site). */
export function widgetAllowed(
  channel: { widgetEnabled: boolean; widgetOrigins: string[] } | null,
  origin: string | null,
) {
  if (!channel?.widgetEnabled) return false;
  if (channel.widgetOrigins.length === 0) return true;
  return Boolean(
    origin && channel.widgetOrigins.includes(origin.toLowerCase().replace(/\/+$/, "")),
  );
}

// ---------------------------------------------------------------------------------------------
// Facts suggested from the website (the owner confirms; nothing goes live on its own)

export async function createSuggestion(
  ctx: Ctx,
  input: {
    tenantId: string;
    agentId: string;
    sourceUrl: string;
    pagesRead: number;
    draft: unknown;
  },
) {
  agentGate(ctx, "agents.configure", input.tenantId, input.agentId);
  const [row] = await ctx.db
    .insert(profileSuggestions)
    .values({
      tenantId: input.tenantId,
      sourceUrl: input.sourceUrl.slice(0, 500),
      pagesRead: Math.min(50, Math.max(0, input.pagesRead)),
      draft: cleanProfile(input.draft),
      createdBy: ctx.actor?.kind === "impersonating" ? null : (ctx.actor?.userId ?? null),
    })
    .returning();
  await audit(ctx, {
    action: "facts.imported",
    tenantId: input.tenantId,
    targetType: "profile_suggestion",
    targetId: row?.id,
    after: { source: input.sourceUrl, pages: input.pagesRead },
  });
  return row;
}

export async function latestSuggestion(ctx: Ctx, tenantId: string) {
  const [row] = await ctx.db
    .select()
    .from(profileSuggestions)
    .where(and(eq(profileSuggestions.tenantId, tenantId), eq(profileSuggestions.status, "pending")))
    .orderBy(desc(profileSuggestions.createdAt))
    .limit(1);
  return row ?? null;
}

/**
 * Applies the parts of a suggestion the owner ticked, on top of the current facts (lists are
 * added, not replaced). Saved as a draft change with a note, like any Studio edit.
 */
export async function applySuggestion(
  ctx: Ctx,
  input: {
    tenantId: string;
    agentId: string;
    suggestionId: string;
    parts: ("summary" | "hours" | "services" | "faqs" | "locations")[];
  },
) {
  agentGate(ctx, "agents.configure", input.tenantId, input.agentId);
  const [row] = await ctx.db
    .select()
    .from(profileSuggestions)
    .where(
      and(
        eq(profileSuggestions.id, input.suggestionId),
        eq(profileSuggestions.tenantId, input.tenantId),
      ),
    );
  if (row?.status !== "pending") throw new DomainError("not_found", "Suggestion not found.");
  const { policy } = await getStudio(ctx, input.tenantId, input.agentId);
  const current = policy.profile;
  const draft = cleanProfile(row.draft);
  const next = { ...current };
  if (input.parts.includes("summary") && draft.summary) next.summary = draft.summary;
  if (input.parts.includes("hours") && draft.hours && Object.values(draft.hours).some(Boolean))
    next.hours = draft.hours;
  if (input.parts.includes("services"))
    next.services = [...(current.services ?? []), ...(draft.services ?? [])];
  if (input.parts.includes("faqs")) next.faqs = [...(current.faqs ?? []), ...(draft.faqs ?? [])];
  if (input.parts.includes("locations"))
    next.locations = [...(current.locations ?? []), ...(draft.locations ?? [])];
  await saveProfile(
    ctx,
    input.tenantId,
    next,
    `Imported from ${row.sourceUrl}: ${input.parts.join(", ") || "nothing"}`,
    input.agentId,
  );
  await ctx.db
    .update(profileSuggestions)
    .set({ status: "applied" })
    .where(eq(profileSuggestions.id, row.id));
}

export async function dismissSuggestion(
  ctx: Ctx,
  input: { tenantId: string; agentId: string; suggestionId: string },
) {
  agentGate(ctx, "agents.configure", input.tenantId, input.agentId);
  await ctx.db
    .update(profileSuggestions)
    .set({ status: "dismissed" })
    .where(
      and(
        eq(profileSuggestions.id, input.suggestionId),
        eq(profileSuggestions.tenantId, input.tenantId),
      ),
    );
}
