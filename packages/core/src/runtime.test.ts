import { readFileSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";
import type { Classifier } from "@wyrm/brain";
import { drizzle } from "drizzle-orm/pglite";
import { beforeAll, describe, expect, it } from "vitest";
import { type Answer, handleCustomerMessage, type RuntimeDeps } from "./runtime";

/** A customer message end to end: brain, agent answer, and everything recorded. Fake models only. */

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

const TENANT_A = "10000000-0000-4000-8000-00000000000a";
const TENANT_B = "10000000-0000-4000-8000-00000000000b";
const FRONT = "20000000-0000-4000-8000-0000000000a1";
const QUOTES = "20000000-0000-4000-8000-0000000000a2";
const DRAFT = "20000000-0000-4000-8000-0000000000a3";
const SALON = "20000000-0000-4000-8000-0000000000b1";

let client: PGlite;
let db: ReturnType<typeof drizzle>;
const rows = async <T = Record<string, unknown>>(q: string, p: unknown[] = []) =>
  (await client.query<T>(q, p)).rows;

function deps(
  intent: string,
  answer: Partial<Answer> | null = {},
): RuntimeDeps & { calls: { classify: number; answer: number } } {
  const calls = { classify: 0, answer: 0 };
  const classifier: Classifier = {
    provider: "groq",
    paid: false,
    async classify() {
      calls.classify += 1;
      return {
        intent,
        confidence: 0.9,
        provider: "groq",
        model: "fake",
        inputTokens: 100,
        outputTokens: 10,
        costMicros: 0,
        latencyMs: 5,
      };
    },
  };
  return {
    calls,
    classifiers: [classifier],
    async answer() {
      calls.answer += 1;
      if (answer === null) return null;
      return {
        reply: "We're open 9 to 5.",
        answered: true,
        topic: "hours",
        lead: false,
        provider: "anthropic",
        model: "fake-haiku",
        inputTokens: 300,
        outputTokens: 30,
        costMicros: 45,
        latencyMs: 20,
        ...answer,
      };
    },
  };
}

beforeAll(async () => {
  client = new PGlite();
  db = drizzle(client);
  await client.exec(STANDIN);
  for (const m of [
    "0001_portal_foundations.sql",
    "0002_api_grants.sql",
    "0003_two_tier_users.sql",
    "0004_agent_operations.sql",
  ])
    await client.exec(migration(m));
  await client.query(
    "insert into tenants (id, name, slug, agent_limit) values ($1, 'Bright Smile Dental', 'bright-smile', 5), ($2, 'Fictional Salon', 'salon-b', 2)",
    [TENANT_A, TENANT_B],
  );
  await client.query(
    `insert into agents (id, tenant_id, name, type, status, config) values
     ($1, $5, 'Front desk', 'receptionist', 'live', '{"businessFacts": "Open 9-5"}'),
     ($2, $5, 'Quotes', 'quote', 'live', '{}'),
     ($3, $5, 'New helper', 'support', 'draft', '{}'),
     ($4, $6, 'Salon phone', 'receptionist', 'live', '{}')`,
    [FRONT, QUOTES, DRAFT, SALON, TENANT_A, TENANT_B],
  );
  await client.query(
    "insert into corrections (tenant_id, agent_id, topic, correct_answer) values ($1, $2, 'parking', 'Free parking behind the building.')",
    [TENANT_A, FRONT],
  );
});

describe("a customer message", () => {
  it("is routed, answered, disclosed as AI and fully recorded", async () => {
    const d = deps("opening_hours");
    const r = await handleCustomerMessage(db, d, {
      agentId: FRONT,
      text: "When are you open?",
      channel: "web_chat",
    });
    expect(r.status).toBe("ok");
    if (r.status !== "ok") return;
    expect(r.reply).toContain("I'm an AI");
    expect(r.reply).toContain("We're open 9 to 5.");
    const [conv] = await rows<{
      outcome: string;
      ai_disclosed: boolean;
      agent_id: string;
      topics: string[];
    }>("select outcome, ai_disclosed, agent_id, topics from conversations where id = $1", [
      r.conversationId,
    ]);
    expect(conv).toMatchObject({
      outcome: "resolved_assumed",
      ai_disclosed: true,
      agent_id: FRONT,
      topics: ["hours"],
    });
    const msgs = await rows(
      "select role from conversation_messages where conversation_id = $1 order by id",
      [r.conversationId],
    );
    expect(msgs.map((m) => m.role)).toEqual(["customer", "agent"]);
    const decisions = await rows<{ decision: string; reason: string }>(
      "select decision, reason from agent_decisions where conversation_id = $1 order by id",
      [r.conversationId],
    );
    expect(decisions.map((x) => x.reason)).toEqual(["confident_match", "agent_answered"]);
    const [usage] = await rows<{ cost_micros: string; conversations: number; llm_calls: number }>(
      "select cost_micros, conversations, llm_calls from usage_daily where tenant_id = $1 and agent_id = $2",
      [TENANT_A, FRONT],
    );
    expect(usage).toMatchObject({ conversations: 1, llm_calls: 2 });
    expect(Number(usage?.cost_micros)).toBe(45);

    // The next message continues the same conversation with the same agent, without disclosure.
    const next = await handleCustomerMessage(db, d, {
      agentId: FRONT,
      conversationId: r.conversationId,
      text: "And Saturday?",
      channel: "web_chat",
    });
    expect(next.status === "ok" && next.conversationId).toBe(r.conversationId);
    expect(next.status === "ok" && next.reply).not.toContain("I'm an AI");
    expect(d.calls.classify).toBe(1); // active flow: no second classification
  });

  it("answers a taught question in code, without any model", async () => {
    const d = deps("booking");
    const r = await handleCustomerMessage(db, d, {
      agentId: FRONT,
      text: "Where is the parking?",
      channel: "web_chat",
    });
    expect(r.status === "ok" && r.reply).toContain("Free parking behind the building.");
    expect(d.calls).toEqual({ classify: 0, answer: 0 });
  });

  it("hands requests for a person to the to-do list", async () => {
    const r = await handleCustomerMessage(db, deps("booking"), {
      agentId: FRONT,
      text: "Can I talk to a real person?",
      channel: "sms",
    });
    if (r.status !== "ok") throw new Error("expected ok");
    const [conv] = await rows<{ outcome: string; flags: string[] }>(
      "select outcome, flags from conversations where id = $1",
      [r.conversationId],
    );
    expect(conv).toMatchObject({ outcome: "handed_off", flags: ["needs_attention"] });
  });

  it("flags questions the agent couldn't answer, for the Teach suggestions", async () => {
    const r = await handleCustomerMessage(
      db,
      deps("services", { answered: false, topic: "whitening", reply: "I'll pass that on." }),
      {
        agentId: FRONT,
        text: "Do you do teeth whitening?",
        channel: "web_chat",
      },
    );
    if (r.status !== "ok") throw new Error("expected ok");
    const [conv] = await rows<{ flags: string[]; topics: string[] }>(
      "select flags, topics from conversations where id = $1",
      [r.conversationId],
    );
    expect(conv?.flags).toEqual(expect.arrayContaining(["unanswered", "needs_attention"]));
    expect(conv?.topics).toEqual(["whitening"]);
  });

  it("takes a message when no model answers", async () => {
    const r = await handleCustomerMessage(db, deps("quote", null), {
      agentId: FRONT,
      text: "How much is a crown?",
      channel: "web_chat",
    });
    expect(r.status === "ok" && r.reply).toContain("pass it to the team");
  });

  it("keeps draft agents private, except for staff testing them", async () => {
    expect(
      (
        await handleCustomerMessage(db, deps("support"), {
          agentId: DRAFT,
          text: "hi",
          channel: "web_chat",
        })
      ).status,
    ).toBe("unavailable");
    const t = await handleCustomerMessage(db, deps("support"), {
      agentId: DRAFT,
      text: "My filling hurts",
      channel: "web_chat",
      test: true,
    });
    if (t.status !== "ok") throw new Error("expected ok");
    const [conv] = await rows<{ customer_label: string; flags: string[] }>(
      "select customer_label, flags from conversations where id = $1",
      [t.conversationId],
    );
    expect(conv).toMatchObject({ customer_label: "Test chat" });
    expect(conv?.flags).toContain("test");
  });

  it("never continues another organisation's conversation", async () => {
    const a = await handleCustomerMessage(db, deps("opening_hours"), {
      agentId: FRONT,
      text: "hello",
      channel: "web_chat",
    });
    if (a.status !== "ok") throw new Error("expected ok");
    const b = await handleCustomerMessage(db, deps("booking"), {
      agentId: SALON,
      conversationId: a.conversationId,
      text: "hi",
      channel: "web_chat",
    });
    expect(b.status === "ok" && b.conversationId).not.toBe(a.conversationId);
  });

  it("tells customers the assistant is paused when the owner pauses everything", async () => {
    await client.query(
      "insert into kill_switches (scope, tenant_id, reason) values ('tenant', $1, 'Closed today')",
      [TENANT_B],
    );
    const r = await handleCustomerMessage(db, deps("booking"), {
      agentId: SALON,
      text: "Can I book?",
      channel: "web_chat",
    });
    expect(r.status === "ok" && r.reply).toContain("paused");
  });
});
