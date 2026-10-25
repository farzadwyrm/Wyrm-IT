import { readFileSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";
import { ForbiddenError } from "@wyrm/auth";
import { drizzle } from "drizzle-orm/pglite";
import { beforeAll, describe, expect, it } from "vitest";
import {
  acceptInvitation,
  addKnowledgeSource,
  askKnowledge,
  type Ctx,
  chunkText,
  createTenant,
  DomainError,
  deleteKnowledgeSource,
  grantAgentAccess,
  inviteStaff,
  type KnowledgeDeps,
  keywords,
  knowledgeStats,
  listKnowledgeQuestions,
  listKnowledgeSources,
  loadActor,
  provisionAgent,
  rateKnowledgeAnswer,
  searchKnowledge,
  setSwitch,
  setupStatus,
} from "./index";

/**
 * Ask your documents (migration 0008) in an in-memory Postgres: passages, keyword search,
 * answers with citations, access per agent and isolation between organisations.
 * Fictional company and handbook only; no real model is called.
 */

const migration = (name: string) =>
  readFileSync(new URL(`../../db/migrations/${name}`, import.meta.url), "utf8");

const STANDIN = `
create schema auth;
create table auth.users (id uuid primary key, email text);
create function auth.uid() returns uuid language sql stable as $$
  select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
$$;
create role anon; create role authenticated; create role service_role;
grant usage on schema public, auth to anon, authenticated, service_role;
`;

const uid = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const people = {
  super: { id: uid(1), email: "super@wyrm.example" },
  owner: { id: uid(11), email: "owner@acme-tools.example" },
  member: { id: uid(12), email: "member@acme-tools.example" },
  outsider: { id: uid(21), email: "owner@other-co.example" },
};

const HANDBOOK = `# Acme Tools staff handbook

## Holidays
Full-time staff get 25 days of paid holiday a year. Ask your manager at least two weeks before.

## Expenses
Submit receipts in the expenses app within 30 days. Meals on trips are covered up to 40 euros a day.

## Returns policy
Customers can return unused tools within 60 days with the receipt for a full refund.`;

let client: PGlite;
let db: ReturnType<typeof drizzle>;
let tenant = "";
let other = "";
let docsAgent = "";
let hrAgent = "";
let otherAgent = "";

const ctxFor = async (person: { id: string }): Promise<Ctx> => ({
  db,
  actor: await loadActor(db, { userId: person.id, mfa: true }),
});

/** A stand-in model: answers from passage 1 when it mentions the question's subject. */
function fakeDeps(over: Partial<KnowledgeDeps> = {}): KnowledgeDeps & { seen: string[][] } {
  const seen: string[][] = [];
  return {
    seen,
    expand: async (q) => ({
      words: q.toLowerCase().includes("vacation") ? ["holiday", "leave"] : [],
      costMicros: 0,
    }),
    answer: async ({ passages }) => {
      seen.push(passages.map((p) => p.text));
      const first = passages[0];
      if (!first) return null;
      return {
        reply: `${first.text.split("\n").slice(-1)[0]} [1]`,
        cited: [1, 9],
        answered: true,
        provider: "groq",
        model: "fake",
        inputTokens: 200,
        outputTokens: 20,
        costMicros: 0,
      };
    },
    ...over,
  };
}

beforeAll(async () => {
  client = new PGlite();
  db = drizzle(client);
  await client.exec(STANDIN);
  for (const p of Object.values(people))
    await client.query("insert into auth.users (id, email) values ($1, $2)", [p.id, p.email]);
  for (const m of [
    "0001_portal_foundations.sql",
    "0002_api_grants.sql",
    "0003_two_tier_users.sql",
    "0004_agent_operations.sql",
    "0005_agent_policies.sql",
    "0006_agent_test_gate.sql",
    "0007_onboarding.sql",
    "0008_knowledge.sql",
    "0009_connections.sql",
    "0010_sales.sql",
    "0011_history_cleanup.sql",
    "0012_mcp_oauth.sql",
  ])
    await client.exec(migration(m));
  await client.query(
    "insert into platform_users (id, email, platform_role) values ($1, $2, 'super_admin')",
    [people.super.id, people.super.email],
  );
  const sup = await ctxFor(people.super);
  const a = await createTenant(sup, {
    name: "Acme Tools (fictional)",
    slug: "acme-tools",
    ownerEmail: people.owner.email,
    agentLimit: 3,
  });
  const b = await createTenant(sup, {
    name: "Other Co (fictional)",
    slug: "other-co",
    ownerEmail: people.outsider.email,
  });
  tenant = a.tenant.id;
  other = b.tenant.id;
  const join = (token: string, p: { id: string; email: string }) =>
    acceptInvitation({ db, actor: null }, { token, userId: p.id, email: p.email });
  await join(a.token, people.owner);
  await join(b.token, people.outsider);
  const owner = await ctxFor(people.owner);
  const memberRole = (
    await client.query<{ id: string }>(
      "select id from roles where key = 'member' and tenant_id is null",
    )
  ).rows[0]?.id as string;
  const invite = await inviteStaff(owner, {
    tenantId: tenant,
    email: people.member.email,
    roleId: memberRole,
  });
  const memberRow = (await join(invite.token, people.member)) as { id: string } | undefined;
  docsAgent =
    (await provisionAgent(sup, { tenantId: tenant, name: "Ask the handbook", type: "knowledge" }))
      ?.id ?? "";
  hrAgent =
    (await provisionAgent(sup, { tenantId: tenant, name: "HR private", type: "knowledge" }))?.id ??
    "";
  otherAgent =
    (await provisionAgent(sup, { tenantId: other, name: "Other docs", type: "knowledge" }))?.id ??
    "";
  const memberId =
    memberRow?.id ??
    (
      await client.query<{ id: string }>("select id from tenant_users where user_id = $1", [
        people.member.id,
      ])
    ).rows[0]?.id ??
    "";
  await grantAgentAccess(owner, {
    tenantId: tenant,
    agentId: docsAgent,
    subjectType: "user",
    subjectId: memberId,
    level: "use",
  });
});

describe("chunkText and keywords", () => {
  it("cuts on paragraphs, keeps headings and stays under the size limit", () => {
    const chunks = chunkText(HANDBOOK);
    expect(chunks.length).toBeGreaterThanOrEqual(1);
    expect(chunks.every((c) => c.content.length <= 4000)).toBe(true);
    const long = chunkText(`# Big\n\n${"word ".repeat(2000)}`);
    expect(long.length).toBeGreaterThan(3);
    expect(long.every((c) => c.content.length <= 1600)).toBe(true);
    expect(long[1]?.heading).toBe("Big");
    expect(chunkText("   ")).toEqual([]);
  });

  it("keeps meaningful words only", () => {
    expect(keywords("How many holiday days do I get?")).toEqual(["many", "holiday", "days"]);
    expect(keywords("Qual é a política de devoluções?")).toEqual(["política", "devoluções"]);
  });
});

describe("documents", () => {
  it("only people who configure the agent add documents", async () => {
    await expect(
      addKnowledgeSource(await ctxFor(people.member), {
        tenantId: tenant,
        agentId: docsAgent,
        kind: "text",
        name: "Handbook",
        text: HANDBOOK,
      }),
    ).rejects.toThrow(ForbiddenError);
    const added = await addKnowledgeSource(await ctxFor(people.owner), {
      tenantId: tenant,
      agentId: docsAgent,
      kind: "website",
      name: "Handbook",
      location: "https://acme-tools.example/handbook",
      text: HANDBOOK,
    });
    expect(added.replaced).toBe(false);
    const again = await addKnowledgeSource(await ctxFor(people.owner), {
      tenantId: tenant,
      agentId: docsAgent,
      kind: "website",
      name: "Handbook v2",
      location: "https://acme-tools.example/handbook",
      text: `${HANDBOOK}\n\n## Parking\nStaff park in the rear car park.`,
    });
    expect(again).toMatchObject({ sourceId: added.sourceId, replaced: true });
    const list = await listKnowledgeSources(await ctxFor(people.member), tenant, docsAgent);
    expect(list.map((s) => s.name)).toEqual(["Handbook v2"]);
  });

  it("rejects empty documents and other organisations", async () => {
    await expect(
      addKnowledgeSource(await ctxFor(people.owner), {
        tenantId: tenant,
        agentId: docsAgent,
        kind: "text",
        name: "Empty",
        text: "  \n ",
      }),
    ).rejects.toThrow(DomainError);
    await expect(
      addKnowledgeSource(await ctxFor(people.owner), {
        tenantId: other,
        agentId: otherAgent,
        kind: "text",
        name: "Sneaky",
        text: HANDBOOK,
      }),
    ).rejects.toThrow(ForbiddenError);
    await expect(
      listKnowledgeSources(await ctxFor(people.outsider), tenant, docsAgent),
    ).rejects.toThrow(ForbiddenError);
  });

  it("searches only the agent's own passages", async () => {
    await addKnowledgeSource(await ctxFor(people.owner), {
      tenantId: tenant,
      agentId: hrAgent,
      kind: "text",
      name: "Salaries",
      text: "Salary bands for 2026: engineers band C. Private to HR.",
    });
    const hits = await searchKnowledge(db, tenant, docsAgent, ["salary", "holiday"]);
    expect(hits.length).toBeGreaterThan(0);
    expect(hits.every((h) => h.sourceName === "Handbook v2")).toBe(true);
    expect(await searchKnowledge(db, tenant, docsAgent, ["   "])).toEqual([]);
  });
});

describe("asking", () => {
  it("answers with citations to the passages it used, and logs the question", async () => {
    const deps = fakeDeps();
    const r = await askKnowledge(
      await ctxFor(people.member),
      { tenantId: tenant, agentId: docsAgent, question: "How much vacation do we get?" },
      deps,
    );
    expect(r.answered).toBe(true);
    expect(r.citations).toHaveLength(1); // passage 9 doesn't exist and is dropped
    expect(r.citations[0]).toMatchObject({ n: 1, name: "Handbook v2" });
    expect(deps.seen[0]?.join(" ")).toContain("25 days");
    const log = await listKnowledgeQuestions(await ctxFor(people.owner), tenant, docsAgent);
    expect(log[0]).toMatchObject({ question: "How much vacation do we get?", answered: true });
    expect(log[0]?.askedBy).toBe(people.member.id);
  });

  it("says it couldn't find it, without calling the model, when nothing matches", async () => {
    const deps = fakeDeps();
    const r = await askKnowledge(
      await ctxFor(people.member),
      { tenantId: tenant, agentId: docsAgent, question: "Zebra quantum spaceship?" },
      deps,
    );
    expect(r).toMatchObject({ answered: false, citations: [] });
    expect(deps.seen).toHaveLength(0);
    const gaps = await listKnowledgeQuestions(await ctxFor(people.owner), tenant, docsAgent, {
      unanswered: true,
    });
    expect(gaps.map((g) => g.question)).toContain("Zebra quantum spaceship?");
  });

  it("is not an answer when the model cites nothing", async () => {
    const r = await askKnowledge(
      await ctxFor(people.member),
      { tenantId: tenant, agentId: docsAgent, question: "What about expenses receipts?" },
      fakeDeps({
        answer: async () => ({
          reply: "Not in the documents.",
          cited: [],
          answered: true,
          provider: "groq",
          model: "fake",
          inputTokens: 1,
          outputTokens: 1,
          costMicros: 0,
        }),
      }),
    );
    expect(r.answered).toBe(false);
  });

  it("follows per-agent access, off switches and pauses", async () => {
    await expect(
      askKnowledge(
        await ctxFor(people.member),
        { tenantId: tenant, agentId: hrAgent, question: "What are the salary bands?" },
        fakeDeps(),
      ),
    ).rejects.toThrow(ForbiddenError);
    await expect(
      askKnowledge(
        await ctxFor(people.outsider),
        { tenantId: tenant, agentId: docsAgent, question: "Holidays?" },
        fakeDeps(),
      ),
    ).rejects.toThrow(ForbiddenError);
    await setSwitch(await ctxFor(people.owner), {
      scope: "agent",
      tenantId: tenant,
      agentId: docsAgent,
      reason: "Fictional pause for a test",
    });
    await expect(
      askKnowledge(
        await ctxFor(people.member),
        { tenantId: tenant, agentId: docsAgent, question: "Holidays?" },
        fakeDeps(),
      ),
    ).rejects.toThrow(DomainError);
    await client.query("update kill_switches set cleared_at = now() where agent_id = $1", [
      docsAgent,
    ]);
  });

  it("takes feedback from the asker and counts the week", async () => {
    const r = await askKnowledge(
      await ctxFor(people.member),
      { tenantId: tenant, agentId: docsAgent, question: "Can customers return tools?" },
      fakeDeps(),
    );
    await rateKnowledgeAnswer(await ctxFor(people.member), {
      tenantId: tenant,
      questionId: r.questionId as string,
      feedback: "down",
    });
    await expect(
      rateKnowledgeAnswer(await ctxFor(people.outsider), {
        tenantId: tenant,
        questionId: r.questionId as string,
        feedback: "up",
      }),
    ).rejects.toThrow();
    const stats = await knowledgeStats(await ctxFor(people.owner), tenant, docsAgent);
    expect(stats).toMatchObject({ sources: 1, askedWeek: 4, answeredWeek: 2, thumbsDownWeek: 1 });
  });

  it("has its own setup checklist: documents and answered questions", async () => {
    const setup = await setupStatus(await ctxFor(people.owner), tenant, docsAgent);
    expect(setup.required.map((i) => i.key)).toEqual(["documents", "practice", "signoff"]);
    expect(setup.required[0]?.done).toBe(true);
    expect(setup.recommended.map((i) => i.key)).not.toContain("signoff");
  });

  it("removes a document and its passages", async () => {
    const [source] = await listKnowledgeSources(await ctxFor(people.owner), tenant, docsAgent);
    await deleteKnowledgeSource(await ctxFor(people.owner), {
      tenantId: tenant,
      agentId: docsAgent,
      sourceId: source?.id as string,
    });
    expect(await searchKnowledge(db, tenant, docsAgent, ["holiday"])).toEqual([]);
  });
});
