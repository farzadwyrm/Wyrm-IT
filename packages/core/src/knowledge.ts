import { createHash } from "node:crypto";
import { blockedTopic } from "@wyrm/brain";
import {
  type AgentConnection,
  agents,
  type ConnectionLookup,
  type KnowledgeCitation,
  type KnowledgeKind,
  killSwitches,
  knowledgeChunks,
  knowledgeQuestions,
  knowledgeSources,
  type LookupParam,
} from "@wyrm/db";
import { and, desc, eq, isNull, or, sql } from "drizzle-orm";
import { audit } from "./audit";
import { coerceParam, liveSources, logConnectionCall, rowsToText } from "./connections";
import { type Ctx, DomainError, guarded } from "./context";
import { agentGate } from "./operations";
import { policyFromConfig } from "./studio";

/**
 * "Ask your documents": an agent that answers staff questions from the organisation's own
 * documents, with the passages it used. Sources are cut into passages and searched by keyword
 * (Postgres full-text search); a model widens the search words and writes the answer only from
 * the passages found. Access follows the agent: `agents.use` to ask, `agents.configure` to manage
 * documents, `agents.logs` to read the question log.
 */

export const KNOWLEDGE_LIMITS = {
  /** Characters kept from one source (about 150 pages of text). */
  sourceChars: 400_000,
  /** Characters across all of one agent's sources. */
  agentChars: 4_000_000,
  sources: 300,
  /** Passages given to the model per question. */
  passages: 6,
} as const;

/** The signed-in person behind an action (Wyrm staff when viewing as a client). */
function userOf(ctx: Ctx): string | null {
  const a = ctx.actor;
  if (!a) return null;
  if (a.kind === "impersonating") return a.platform.userId;
  return a.userId;
}

const CHUNK = 1600;
const OVERLAP = 200;
/** Long paragraphs are cut a little shorter so a heading still fits in front. */
const PIECE = CHUNK - 160;

export interface Chunk {
  heading: string | null;
  content: string;
}

const HEADING = /^(#{1,6}\s+.+|[A-Z0-9][^.!?\n]{2,80}:?)$/;

/**
 * Cuts text into passages of about 1,600 characters (≈400 tokens) on paragraph boundaries, with
 * a short overlap, remembering the nearest heading so an answer can say where it came from.
 */
export function chunkText(text: string): Chunk[] {
  const clean = text
    .replace(/\r\n?/g, "\n")
    .replace(/[\t\f\v ]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
  if (!clean) return [];
  const paragraphs = clean.split(/\n\s*\n/).flatMap((p) => {
    const t = p.trim();
    if (t.length <= CHUNK) return [t];
    // A very long paragraph: split on sentences, then hard-split what is still too long.
    const parts: string[] = [];
    let buf = "";
    for (const sentence of t.split(/(?<=[.!?])\s+/)) {
      if ((buf + sentence).length > PIECE && buf) {
        parts.push(buf.trim());
        buf = "";
      }
      buf += `${sentence} `;
      while (buf.length > PIECE) {
        parts.push(buf.slice(0, PIECE));
        buf = buf.slice(PIECE - OVERLAP);
      }
    }
    if (buf.trim()) parts.push(buf.trim());
    return parts;
  });
  const chunks: Chunk[] = [];
  let heading: string | null = null;
  let buf = "";
  let bufHeading: string | null = null;
  // A heading on its own is never a passage: it joins the paragraph after it.
  let lastHeadingLine = "";
  const flush = () => {
    if (buf.trim()) chunks.push({ heading: bufHeading, content: buf.trim() });
  };
  for (const p of paragraphs) {
    const firstLine = p.split("\n")[0] ?? "";
    if (p.length <= 120 && HEADING.test(firstLine.trim()) && !p.includes("\n")) {
      heading = p
        .replace(/^#+\s*/, "")
        .replace(/:$/, "")
        .slice(0, 300);
      lastHeadingLine = p.trim();
      if (buf.length > CHUNK / 2) {
        flush();
        buf = "";
      }
      if (!buf) bufHeading = heading;
      buf += `${p}\n\n`;
      continue;
    }
    if (buf && buf.length + p.length > CHUNK && buf.trim() !== lastHeadingLine) {
      flush();
      // Carry the end of the previous passage so a fact split across the boundary survives.
      const tail = buf.trim().slice(-OVERLAP);
      const cut = tail.indexOf(" ");
      const carry = cut > 0 ? `${tail.slice(cut + 1)}\n\n` : "";
      buf = carry.length + p.length <= CHUNK ? carry : "";
      bufHeading = heading;
    }
    if (!buf) bufHeading = heading;
    buf += `${p}\n\n`;
  }
  flush();
  return chunks.map((c) => ({ heading: c.heading, content: c.content.slice(0, 4000) }));
}

const STOP = new Set(
  (
    "a an and are as at be by can could do does for from had has have how i if in is it its me my of on or our " +
    "please should so tell than that the their them then there these they this to us was we what when where " +
    "which who why will with would you your about any get got need want know find " +
    "o a os as um uma de do da dos das e em no na nos nas para por com que qual quais como onde quando é " +
    "ser são há se sobre meu minha nosso nossa"
  ).split(" "),
);

/** Search words from a question: lower case, no stop words, at most 12, letters and digits only. */
export function keywords(text: string): string[] {
  const words = text
    .toLowerCase()
    .normalize("NFKC")
    .split(/[^\p{L}\p{N}]+/u)
    .filter((w) => w.length >= 2 && w.length <= 40 && !STOP.has(w));
  return [...new Set(words)].slice(0, 12);
}

export interface Passage {
  chunkId: number;
  sourceId: string;
  sourceName: string;
  location: string | null;
  heading: string | null;
  content: string;
  rank: number;
}

/** Passages of one agent's documents matching any of the words, best first. */
export async function searchKnowledge(
  db: Ctx["db"],
  tenantId: string,
  agentId: string,
  words: string[],
  limit: number = KNOWLEDGE_LIMITS.passages,
): Promise<Passage[]> {
  const terms = [...new Set(words.flatMap((w) => keywords(w)))].slice(0, 24);
  if (!terms.length) return [];
  // Prefix match ("refund:*" also finds "refunds") and any word may match; rank sorts it out.
  const query = terms.map((t) => `${t}:*`).join(" | ");
  const rank = sql<number>`ts_rank_cd(knowledge_chunks.search, to_tsquery('simple', ${query}), 32)`;
  const rows = await db
    .select({
      chunkId: knowledgeChunks.id,
      sourceId: knowledgeChunks.sourceId,
      sourceName: knowledgeSources.name,
      location: knowledgeSources.location,
      heading: knowledgeChunks.heading,
      content: knowledgeChunks.content,
      rank,
    })
    .from(knowledgeChunks)
    .innerJoin(knowledgeSources, eq(knowledgeSources.id, knowledgeChunks.sourceId))
    .where(
      and(
        eq(knowledgeChunks.tenantId, tenantId),
        eq(knowledgeChunks.agentId, agentId),
        eq(knowledgeSources.status, "ready"),
        sql`knowledge_chunks.search @@ to_tsquery('simple', ${query})`,
      ),
    )
    .orderBy(desc(rank), knowledgeChunks.id)
    .limit(Math.min(Math.max(limit, 1), 20));
  return rows.map((r) => ({ ...r, rank: Number(r.rank) }));
}

// ---------------------------------------------------------------------------------------------
// Sources

export async function listKnowledgeSources(ctx: Ctx, tenantId: string, agentId: string) {
  agentGate(ctx, "agents.use", tenantId, agentId);
  return ctx.db
    .select()
    .from(knowledgeSources)
    .where(and(eq(knowledgeSources.tenantId, tenantId), eq(knowledgeSources.agentId, agentId)))
    .orderBy(desc(knowledgeSources.updatedAt));
}

export interface NewSource {
  tenantId: string;
  agentId: string;
  kind: KnowledgeKind;
  name: string;
  /** Web address or Drive file id; a source with the same location is replaced (re-sync). */
  location?: string | null;
  mime?: string | null;
  text: string;
}

/** Adds (or replaces) a document: cuts it into passages and stores them. */
export async function addKnowledgeSource(ctx: Ctx, input: NewSource) {
  agentGate(ctx, "agents.configure", input.tenantId, input.agentId);
  const name = input.name.replace(/\s+/g, " ").trim().slice(0, 200);
  if (!name) throw new DomainError("bad_name", "Give the document a name.");
  const text = input.text.slice(0, KNOWLEDGE_LIMITS.sourceChars);
  const chunks = chunkText(text);
  if (!chunks.length || text.replace(/\s/g, "").length < 20)
    throw new DomainError("empty_document", "We couldn't find readable text in that document.");
  const location = input.location?.trim().slice(0, 500) || null;
  const hash = createHash("sha256").update(text).digest("hex");
  const [agent] = await ctx.db
    .select({ id: agents.id })
    .from(agents)
    .where(and(eq(agents.id, input.agentId), eq(agents.tenantId, input.tenantId)));
  if (!agent) throw new DomainError("not_found", "Agent not found.");

  return guarded(() =>
    ctx.db.transaction(async (tx) => {
      const existing = location
        ? (
            await tx
              .select()
              .from(knowledgeSources)
              .where(
                and(
                  eq(knowledgeSources.agentId, input.agentId),
                  eq(knowledgeSources.kind, input.kind),
                  eq(knowledgeSources.location, location),
                ),
              )
          )[0]
        : undefined;
      const [totals] = await tx
        .select({
          n: sql<number>`count(*)::int`,
          chars: sql<number>`coalesce(sum(${knowledgeSources.chars}), 0)::bigint`,
        })
        .from(knowledgeSources)
        .where(eq(knowledgeSources.agentId, input.agentId));
      const count = Number(totals?.n ?? 0) - (existing ? 1 : 0);
      const chars = Number(totals?.chars ?? 0) - (existing?.chars ?? 0);
      if (count >= KNOWLEDGE_LIMITS.sources)
        throw new DomainError("too_many_sources", "This agent has the most documents it can hold.");
      if (chars + text.length > KNOWLEDGE_LIMITS.agentChars)
        throw new DomainError("knowledge_full", "This agent's document space is full.");

      const values = {
        name,
        mime: input.mime?.slice(0, 120) ?? null,
        status: "ready" as const,
        error: null,
        chars: text.length,
        chunkCount: chunks.length,
        contentHash: hash,
        updatedAt: new Date(),
      };
      let sourceId: string;
      if (existing) {
        sourceId = existing.id;
        await tx.update(knowledgeSources).set(values).where(eq(knowledgeSources.id, sourceId));
        await tx.delete(knowledgeChunks).where(eq(knowledgeChunks.sourceId, sourceId));
      } else {
        const [row] = await tx
          .insert(knowledgeSources)
          .values({
            ...values,
            tenantId: input.tenantId,
            agentId: input.agentId,
            kind: input.kind,
            location,
            createdBy: userOf(ctx),
          })
          .returning({ id: knowledgeSources.id });
        if (!row) throw new DomainError("unknown", "Couldn't save the document.");
        sourceId = row.id;
      }
      for (let i = 0; i < chunks.length; i += 200) {
        await tx.insert(knowledgeChunks).values(
          chunks.slice(i, i + 200).map((c, j) => ({
            tenantId: input.tenantId,
            agentId: input.agentId,
            sourceId,
            position: i + j,
            heading: c.heading,
            content: c.content,
          })),
        );
      }
      await audit(
        ctx,
        {
          tenantId: input.tenantId,
          action: existing ? "knowledge.source_updated" : "knowledge.source_added",
          targetType: "knowledge_source",
          targetId: sourceId,
          extra: { agentId: input.agentId, kind: input.kind, passages: chunks.length },
        },
        tx,
      );
      return { sourceId, passages: chunks.length, replaced: Boolean(existing) };
    }),
  );
}

export async function deleteKnowledgeSource(
  ctx: Ctx,
  input: { tenantId: string; agentId: string; sourceId: string },
) {
  agentGate(ctx, "agents.configure", input.tenantId, input.agentId);
  const deleted = await ctx.db
    .delete(knowledgeSources)
    .where(
      and(
        eq(knowledgeSources.id, input.sourceId),
        eq(knowledgeSources.agentId, input.agentId),
        eq(knowledgeSources.tenantId, input.tenantId),
      ),
    )
    .returning({ id: knowledgeSources.id });
  if (!deleted.length) throw new DomainError("not_found", "That document no longer exists.");
  await audit(ctx, {
    tenantId: input.tenantId,
    action: "knowledge.source_removed",
    targetType: "knowledge_source",
    targetId: input.sourceId,
    extra: { agentId: input.agentId },
  });
}

/** The passages of one source in order (to preview what the agent reads). */
export async function sourcePreview(
  ctx: Ctx,
  input: { tenantId: string; agentId: string; sourceId: string },
) {
  agentGate(ctx, "agents.configure", input.tenantId, input.agentId);
  return ctx.db
    .select({
      position: knowledgeChunks.position,
      heading: knowledgeChunks.heading,
      content: knowledgeChunks.content,
    })
    .from(knowledgeChunks)
    .where(
      and(
        eq(knowledgeChunks.sourceId, input.sourceId),
        eq(knowledgeChunks.agentId, input.agentId),
        eq(knowledgeChunks.tenantId, input.tenantId),
      ),
    )
    .orderBy(knowledgeChunks.position)
    .limit(3);
}

// ---------------------------------------------------------------------------------------------
// Asking

export interface ModelAnswer {
  reply: string;
  /** 1-based passage numbers the reply relies on. */
  cited: number[];
  answered: boolean;
  provider: string;
  model: string;
  inputTokens: number;
  outputTokens: number;
  costMicros: number;
}

export interface LookupOption {
  n: number;
  name: string;
  description: string;
  params: LookupParam[];
}

export interface KnowledgeDeps {
  /** More search words for a question (synonyms, other phrasings); null when no model is free. */
  expand?: (question: string) => Promise<{ words: string[]; costMicros: number } | null>;
  /**
   * Search words plus, when one fits, the approved lookup to run and its values (replaces
   * `expand` when the agent has lookups).
   */
  plan?: (
    question: string,
    lookups: LookupOption[],
  ) => Promise<{
    words: string[];
    lookup: { n: number; params: Record<string, string> } | null;
    costMicros: number;
  } | null>;
  /** Runs an approved lookup read-only on the client's system (driver code lives in the portal). */
  runLookup?: (input: {
    connection: AgentConnection;
    lookup: ConnectionLookup;
    values: Record<string, string | number>;
  }) => Promise<Record<string, unknown>[]>;
  /** Asks the client's own search API; returns passages with a title and optional link. */
  searchApi?: (
    connection: AgentConnection,
    question: string,
  ) => Promise<{ title: string; text: string; url?: string | null }[]>;
  answer: (input: {
    question: string;
    history: { role: "user" | "agent"; text: string }[];
    passages: { n: number; source: string; heading: string | null; text: string }[];
    rules: string[];
    tone: string;
  }) => Promise<ModelAnswer | null>;
}

export interface KnowledgeAnswer {
  questionId: string | null;
  reply: string;
  answered: boolean;
  citations: (KnowledgeCitation & { n: number; location: string | null; excerpt: string })[];
}

const NOT_FOUND =
  "I couldn't find that in your documents. Try other words, or add a document that covers it.";

/** One staff question answered from the agent's documents, with the passages it used. */
export async function askKnowledge(
  ctx: Ctx,
  input: {
    tenantId: string;
    agentId: string;
    question: string;
    history?: { role: "user" | "agent"; text: string }[];
  },
  deps: KnowledgeDeps,
  now = new Date(),
): Promise<KnowledgeAnswer> {
  agentGate(ctx, "agents.use", input.tenantId, input.agentId);
  const question = input.question.replace(/\s+/g, " ").trim().slice(0, 1000);
  if (question.length < 2) throw new DomainError("too_short", "Ask a question.");
  const [agent] = await ctx.db
    .select()
    .from(agents)
    .where(and(eq(agents.id, input.agentId), eq(agents.tenantId, input.tenantId)));
  if (!agent) throw new DomainError("not_found", "Agent not found.");
  const [stop] = await ctx.db
    .select({ id: killSwitches.id })
    .from(killSwitches)
    .where(
      and(
        isNull(killSwitches.clearedAt),
        or(
          eq(killSwitches.scope, "global"),
          and(eq(killSwitches.scope, "tenant"), eq(killSwitches.tenantId, input.tenantId)),
          and(eq(killSwitches.scope, "agent"), eq(killSwitches.agentId, input.agentId)),
        ),
      ),
    )
    .limit(1);
  if (stop || agent.status === "paused")
    throw new DomainError("agent_paused", "This agent is paused.");

  const policy = policyFromConfig(agent.config);
  const save = async (answer: KnowledgeAnswer, meta?: ModelAnswer, extraCost = 0) => {
    const cost = (meta?.costMicros ?? 0) + extraCost;
    const [row] = await ctx.db
      .insert(knowledgeQuestions)
      .values({
        tenantId: input.tenantId,
        agentId: input.agentId,
        askedBy: userOf(ctx),
        question,
        answer: answer.reply.slice(0, 4000),
        answered: answer.answered,
        citations: answer.citations.map(({ sourceId, name, chunkId }) => ({
          sourceId,
          name,
          chunkId,
        })),
        provider: meta?.provider ?? null,
        costMicros: cost,
      })
      .returning({ id: knowledgeQuestions.id });
    await ctx.db.execute(sql`
      insert into usage_daily (tenant_id, agent_id, day, conversations, llm_calls, input_tokens, output_tokens, cost_micros)
      values (${input.tenantId}, ${input.agentId}, ${now.toISOString().slice(0, 10)}, 0, ${meta ? 1 : 0},
              ${meta?.inputTokens ?? 0}, ${meta?.outputTokens ?? 0}, ${cost})
      on conflict (tenant_id, coalesce(agent_id, '00000000-0000-0000-0000-000000000000'::uuid), day) do update set
        llm_calls = usage_daily.llm_calls + excluded.llm_calls,
        input_tokens = usage_daily.input_tokens + excluded.input_tokens,
        output_tokens = usage_daily.output_tokens + excluded.output_tokens,
        cost_micros = usage_daily.cost_micros + excluded.cost_micros`);
    return { ...answer, questionId: row?.id ?? null };
  };

  const blocked = blockedTopic(question, policy.limits);
  if (blocked)
    return save({
      questionId: null,
      reply: `I can't help with ${blocked} here.${policy.limits.handoffContact ? ` Please ask ${policy.limits.handoffContact}.` : ""}`,
      answered: false,
      citations: [],
    });

  const recent = (input.history ?? []).slice(-4);
  const context = recent
    .filter((m) => m.role === "user")
    .map((m) => m.text)
    .join(" ");

  // Live data from the client's systems: approved lookups and their own search APIs.
  const live =
    deps.runLookup || deps.searchApi
      ? await liveSources(ctx.db, input.tenantId, input.agentId)
      : { lookups: [], searchApis: [] };
  const calls: Omit<Parameters<typeof logConnectionCall>[1], "questionId">[] = [];
  let widened: { words: string[]; costMicros: number } | null = null;
  let chosen: { n: number; params: Record<string, string> } | null = null;
  if (live.lookups.length && deps.plan && deps.runLookup) {
    const plan = await deps
      .plan(
        question,
        live.lookups.map(({ lookup }, i) => ({
          n: i + 1,
          name: lookup.name,
          description: lookup.description,
          params: lookup.params,
        })),
      )
      .catch(() => null);
    widened = plan ? { words: plan.words, costMicros: plan.costMicros } : null;
    chosen = plan?.lookup ?? null;
  } else if (deps.expand) widened = await deps.expand(question).catch(() => null);

  const livePassages: Passage[] = [];
  const entry = chosen ? live.lookups[chosen.n - 1] : undefined;
  if (chosen && entry && deps.runLookup) {
    const started = Date.now();
    const shown: Record<string, string> = {};
    try {
      const values: Record<string, string | number> = {};
      for (const p of entry.lookup.params) {
        values[p.name] = coerceParam(p, chosen.params[p.name]);
        shown[p.name] = String(values[p.name]).slice(0, 100);
      }
      const rows = await deps.runLookup({
        connection: entry.connection,
        lookup: entry.lookup,
        values,
      });
      livePassages.push({
        chunkId: 0,
        sourceId: entry.connection.id,
        sourceName: `${entry.connection.name} · ${entry.lookup.name}`,
        location: null,
        heading:
          Object.entries(shown)
            .map(([k, v]) => `${k} = ${v}`)
            .join(", ") || null,
        content: rowsToText(rows),
        rank: 100,
      });
      calls.push({
        tenantId: input.tenantId,
        agentId: input.agentId,
        connectionId: entry.connection.id,
        lookupId: entry.lookup.id,
        params: shown,
        rows: rows.length,
        ms: Date.now() - started,
        ok: true,
      });
    } catch (e) {
      calls.push({
        tenantId: input.tenantId,
        agentId: input.agentId,
        connectionId: entry.connection.id,
        lookupId: entry.lookup.id,
        params: shown,
        rows: 0,
        ms: Date.now() - started,
        ok: false,
        error: e instanceof DomainError ? e.message : "The lookup failed.",
      });
    }
  }
  if (deps.searchApi) {
    for (const connection of live.searchApis.slice(0, 2)) {
      const started = Date.now();
      try {
        const hits = (await deps.searchApi(connection, question)).slice(0, 4);
        for (const h of hits)
          livePassages.push({
            chunkId: 0,
            sourceId: connection.id,
            sourceName: `${connection.name} · ${h.title}`.slice(0, 200),
            location: h.url ?? null,
            heading: null,
            content: h.text.slice(0, 1800),
            rank: 50,
          });
        calls.push({
          tenantId: input.tenantId,
          agentId: input.agentId,
          connectionId: connection.id,
          rows: hits.length,
          ms: Date.now() - started,
          ok: true,
        });
      } catch {
        calls.push({
          tenantId: input.tenantId,
          agentId: input.agentId,
          connectionId: connection.id,
          rows: 0,
          ms: Date.now() - started,
          ok: false,
          error: "The search API didn't answer.",
        });
      }
    }
  }

  const finish = async (answer: KnowledgeAnswer, meta?: ModelAnswer) => {
    const saved = await save(answer, meta, widened?.costMicros ?? 0);
    for (const call of calls)
      await logConnectionCall(ctx, { ...call, questionId: saved.questionId });
    return saved;
  };

  const words = [...keywords(question), ...(widened?.words ?? []), ...keywords(context)];
  const documents = await searchKnowledge(ctx.db, input.tenantId, input.agentId, words);
  const passages = [...livePassages, ...documents].slice(0, KNOWLEDGE_LIMITS.passages + 2);
  if (!passages.length)
    return finish({ questionId: null, reply: NOT_FOUND, answered: false, citations: [] });

  const result = await deps.answer({
    question,
    history: recent,
    passages: passages.map((p, i) => ({
      n: i + 1,
      source: p.sourceName,
      heading: p.heading,
      text: p.content,
    })),
    rules: policy.rules.filter((r) => r.enabled).map((r) => r.text),
    tone: policy.limits.tone,
  });
  if (!result) throw new DomainError("no_model", "The AI service is busy. Try again in a minute.");
  const cited = [...new Set(result.cited)].filter((n) => n >= 1 && n <= passages.length);
  const citations = cited.map((n) => {
    const p = passages[n - 1] as Passage;
    return {
      n,
      sourceId: p.sourceId,
      name: p.sourceName,
      chunkId: p.chunkId,
      location: p.location,
      excerpt: p.content.slice(0, 400),
    };
  });
  const answered = result.answered && citations.length > 0;
  return finish(
    {
      questionId: null,
      reply: answered ? result.reply : result.reply || NOT_FOUND,
      answered,
      citations,
    },
    result,
  );
}

export async function listKnowledgeQuestions(
  ctx: Ctx,
  tenantId: string,
  agentId: string,
  filter: { unanswered?: boolean; limit?: number } = {},
) {
  agentGate(ctx, "agents.logs", tenantId, agentId);
  return ctx.db
    .select()
    .from(knowledgeQuestions)
    .where(
      and(
        eq(knowledgeQuestions.tenantId, tenantId),
        eq(knowledgeQuestions.agentId, agentId),
        filter.unanswered
          ? or(eq(knowledgeQuestions.answered, false), eq(knowledgeQuestions.feedback, "down"))
          : undefined,
      ),
    )
    .orderBy(desc(knowledgeQuestions.createdAt))
    .limit(Math.min(filter.limit ?? 50, 200));
}

/** Thumbs up or down on an answer: by the person who asked, or someone who manages the agent. */
export async function rateKnowledgeAnswer(
  ctx: Ctx,
  input: { tenantId: string; questionId: string; feedback: "up" | "down" },
) {
  const [q] = await ctx.db
    .select()
    .from(knowledgeQuestions)
    .where(
      and(
        eq(knowledgeQuestions.id, input.questionId),
        eq(knowledgeQuestions.tenantId, input.tenantId),
      ),
    );
  if (!q) throw new DomainError("not_found", "That answer no longer exists.");
  if (q.askedBy !== userOf(ctx)) agentGate(ctx, "agents.configure", input.tenantId, q.agentId);
  else agentGate(ctx, "agents.use", input.tenantId, q.agentId);
  await ctx.db
    .update(knowledgeQuestions)
    .set({ feedback: input.feedback })
    .where(eq(knowledgeQuestions.id, q.id));
}

/** Numbers for the agent's page: documents, passages, questions this week and how many found an answer. */
export async function knowledgeStats(
  ctx: Ctx,
  tenantId: string,
  agentId: string,
  now = new Date(),
) {
  agentGate(ctx, "agents.use", tenantId, agentId);
  const weekAgo = new Date(now.getTime() - 7 * 86_400_000);
  const [docs] = await ctx.db
    .select({
      sources: sql<number>`count(*)::int`,
      passages: sql<number>`coalesce(sum(${knowledgeSources.chunkCount}), 0)::int`,
    })
    .from(knowledgeSources)
    .where(and(eq(knowledgeSources.tenantId, tenantId), eq(knowledgeSources.agentId, agentId)));
  const [qs] = await ctx.db
    .select({
      asked: sql<number>`count(*)::int`,
      answered: sql<number>`count(*) filter (where ${knowledgeQuestions.answered})::int`,
      down: sql<number>`count(*) filter (where ${knowledgeQuestions.feedback} = 'down')::int`,
    })
    .from(knowledgeQuestions)
    .where(
      and(
        eq(knowledgeQuestions.tenantId, tenantId),
        eq(knowledgeQuestions.agentId, agentId),
        sql`${knowledgeQuestions.createdAt} >= ${weekAgo}`,
      ),
    );
  return {
    sources: Number(docs?.sources ?? 0),
    passages: Number(docs?.passages ?? 0),
    askedWeek: Number(qs?.asked ?? 0),
    answeredWeek: Number(qs?.answered ?? 0),
    thumbsDownWeek: Number(qs?.down ?? 0),
  };
}
