import { readFileSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";
import type { Classifier } from "@wyrm/brain";
import { procedureFromTemplate } from "@wyrm/brain";
import { drizzle } from "drizzle-orm/pglite";
import { beforeAll, describe, expect, it } from "vitest";
import { type Answer, handleCustomerMessage, type RuntimeDeps } from "./runtime";
import { policyFromConfig } from "./studio";

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
    "0005_agent_policies.sql",
    "0006_agent_test_gate.sql",
    "0007_onboarding.sql",
    "0008_knowledge.sql",
    "0009_connections.sql",
    "0010_sales.sql",
    "0011_history_cleanup.sql",
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

  it("never lets customers reach an internal documents agent", async () => {
    const DOCS = "20000000-0000-4000-8000-0000000000d0";
    await client.query(
      "insert into agents (id, tenant_id, name, type, status) values ($1, $2, 'Ask the handbook', 'knowledge', 'live')",
      [DOCS, TENANT_A],
    );
    for (const test of [false, true]) {
      const r = await handleCustomerMessage(db, deps("general_question"), {
        agentId: DOCS,
        text: "What are the salary bands?",
        channel: "web_chat",
        test,
      });
      expect(r.status).toBe("unavailable");
    }
    const routed = await handleCustomerMessage(db, deps("general_question"), {
      agentId: FRONT,
      text: "Do you have a staff handbook?",
      channel: "web_chat",
    });
    expect(routed.status === "ok" && routed.trace.some((d) => d.agentId === DOCS)).toBe(false);
    await client.query("delete from agents where id = $1", [DOCS]);
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

describe("Agent Studio policies at runtime", () => {
  const STUDIO = "20000000-0000-4000-8000-0000000000a9";
  const policy = {
    version: 2,
    profile: {
      timezone: "UTC",
      hours: { mon: { open: "08:00", close: "18:00" }, tue: { open: "08:00", close: "18:00" } },
    },
    rules: [],
    procedures: [
      {
        id: "p-book",
        template: "book",
        name: "Book a visit",
        whenToUse: "New appointment.",
        whenNotToUse: "",
        requiredInfo: [
          { key: "name", label: "Name", type: "text" },
          { key: "date", label: "Day", type: "date" },
          { key: "time", label: "Time", type: "time" },
        ],
        steps: ["Ask day and time.", "Confirm."],
        confirmBeforeActing: true,
        enabled: true,
      },
      {
        id: "p-cancel",
        template: "cancel",
        name: "Cancel a visit",
        whenToUse: "Cancel.",
        whenNotToUse: "",
        requiredInfo: [{ key: "name", label: "Name", type: "text" }],
        steps: [],
        confirmBeforeActing: false,
        enabled: true,
      },
      {
        id: "p-msg",
        template: "message",
        name: "Take a message",
        whenToUse: "Message.",
        whenNotToUse: "",
        requiredInfo: [{ key: "name", label: "Name", type: "text" }],
        steps: [],
        confirmBeforeActing: false,
        enabled: true,
      },
    ],
    limits: {
      minNoticeHours: 2,
      bookingWindowDays: 30,
      blockedTopics: ["insurance"],
      afterHours: "take_message",
      handoffContact: "Reception",
    },
  };
  const monday10 = new Date("2026-10-19T10:00:00Z");

  function studioDeps(intent: string, replies: Partial<Answer>[]) {
    let i = 0;
    const seen: { instructions?: string | undefined; collect?: string[] | undefined }[] = [];
    const d: RuntimeDeps & { seen: typeof seen } = {
      seen,
      classifiers: [
        {
          provider: "groq",
          paid: false,
          async classify() {
            return {
              intent,
              confidence: 0.95,
              provider: "groq",
              model: "fake",
              inputTokens: 1,
              outputTokens: 1,
              costMicros: 0,
              latencyMs: 1,
            };
          },
        },
      ],
      async answer(knowledge) {
        seen.push({ instructions: knowledge.instructions, collect: knowledge.collect });
        const r = replies[Math.min(i++, replies.length - 1)] ?? {};
        return {
          reply: "Okay.",
          answered: true,
          topic: null,
          lead: false,
          provider: "groq",
          model: "fake",
          inputTokens: 1,
          outputTokens: 1,
          costMicros: 0,
          latencyMs: 1,
          ...r,
        };
      },
    };
    return d;
  }

  // Its own fictional business, so no other agent competes for the same requests.
  const TENANT_C = "10000000-0000-4000-8000-00000000000c";
  beforeAll(async () => {
    await client.query(
      "insert into tenants (id, name, slug, agent_limit) values ($1, 'Fictional Clinic C', 'clinic-c', 2)",
      [TENANT_C],
    );
    await client.query(
      "insert into agents (id, tenant_id, name, type, status, config) values ($1, $2, 'Studio desk', 'receptionist', 'live', $3)",
      [STUDIO, TENANT_C, JSON.stringify(policy)],
    );
  });

  it("collects details across messages, confirms, then records a booking request", async () => {
    const d = studioDeps("booking", [
      { reply: "Which day and time?", fields: { name: "Ana Example" } },
      {
        reply: "Wednesday 21 October at 10:00, correct?",
        fields: { date: "2026-10-21", time: "10:00" },
      },
      { reply: "Great, the team will confirm.", confirmed: true },
    ]);
    const first = await handleCustomerMessage(db, d, {
      agentId: STUDIO,
      text: "I'm Ana, I'd like a check-up",
      channel: "web_chat",
      now: monday10,
    });
    if (first.status !== "ok") throw new Error("expected ok");
    expect(d.seen[0]?.instructions).toContain('PROCEDURE "Book a visit"');
    expect(d.seen[0]?.collect).toEqual(["name", "date", "time"]);
    await handleCustomerMessage(db, d, {
      agentId: STUDIO,
      conversationId: first.conversationId,
      text: "Wednesday at 10",
      channel: "web_chat",
      now: monday10,
    });
    const last = await handleCustomerMessage(db, d, {
      agentId: STUDIO,
      conversationId: first.conversationId,
      text: "Yes",
      channel: "web_chat",
      now: monday10,
    });
    expect(last.status === "ok" && last.reply).toContain("team will confirm");
    const [conv] = await rows<{
      outcome: string;
      flags: string[];
      state: { procedure?: string; done?: string[] };
    }>("select outcome, flags, state from conversations where id = $1", [first.conversationId]);
    expect(conv?.outcome).toBe("lead");
    expect(conv?.flags).toContain("needs_attention");
    expect(conv?.state.done).toEqual(["book"]);
    const [saved] = await rows<{ summary: string }>(
      "select summary from conversations where id = $1",
      [first.conversationId],
    );
    expect(saved?.summary).toBe("Book a visit: Name: Ana Example, Day: 2026-10-21, Time: 10:00");
    const tools = await rows<{ tool: string; outcome: string }>(
      "select tool, outcome from agent_decisions where conversation_id = $1 and decision = 'tool_authorize'",
      [first.conversationId],
    );
    expect(tools).toEqual([{ tool: "book.request", outcome: "ok" }]);
  });

  it("blocks a booking outside the limits in code, whatever the model says", async () => {
    const d = studioDeps("booking", [
      {
        reply: "Booked for today at 11!",
        fields: { name: "Ana", date: "2026-10-19", time: "11:00" },
        confirmed: true,
      },
    ]);
    const r = await handleCustomerMessage(db, d, {
      agentId: STUDIO,
      text: "Book me in for 11 today",
      channel: "web_chat",
      now: monday10,
    });
    expect(r.status === "ok" && r.reply).toContain("at least 2 hours");
    const tools = await rows<{ outcome: string; reason: string }>(
      "select outcome, reason from agent_decisions where conversation_id = $1 and decision = 'tool_authorize'",
      [r.status === "ok" ? r.conversationId : ""],
    );
    expect(tools).toEqual([{ outcome: "denied", reason: "too_soon" }]);
  });

  it("holds a cancellation for staff approval", async () => {
    const d = studioDeps("cancel", [
      { reply: "I'll pass that on.", fields: { name: "Ana Example" } },
    ]);
    const r = await handleCustomerMessage(db, d, {
      agentId: STUDIO,
      text: "Please cancel my visit, Ana Example",
      channel: "web_chat",
      now: monday10,
    });
    if (r.status !== "ok") throw new Error("expected ok");
    const held = await rows<{ action: string; risk_tier: number; status: string }>(
      "select action, risk_tier, status from approvals where conversation_id = $1",
      [r.conversationId],
    );
    expect(held).toEqual([{ action: "booking.cancel", risk_tier: 2, status: "pending" }]);
  });

  it("hands blocked topics to a person without asking the model", async () => {
    const d = studioDeps("general_question", []);
    const r = await handleCustomerMessage(db, d, {
      agentId: STUDIO,
      text: "Will my insurance pay for this?",
      channel: "web_chat",
      now: monday10,
    });
    expect(r.status === "ok" && r.reply).toContain("not able to help with insurance");
    expect(d.seen).toEqual([]);
  });

  it("takes a message after hours", async () => {
    const d = studioDeps("general_question", [
      { reply: "We're closed now; can I take your name?" },
    ]);
    const sunday = new Date("2026-10-18T10:00:00Z");
    await handleCustomerMessage(db, d, {
      agentId: STUDIO,
      text: "Hello, do you do crowns?",
      channel: "web_chat",
      now: sunday,
    });
    expect(d.seen[0]?.instructions).toContain('PROCEDURE "Take a message"');
    expect(d.seen[0]?.instructions).toContain("closed right now");
  });

  it("answers staff test chats from the draft, and customers only from the live version", async () => {
    const draft = policyFromConfig({
      ...policy,
      profile: {
        ...policy.profile,
        services: [{ name: "Whitening", price: "from 250 EUR", description: "Takes one hour." }],
      },
    });
    const monday = new Date("2026-10-19T10:00:00Z");
    const tester = studioDeps("prices", [{ reply: "Whitening is from 250 EUR." }]);
    await handleCustomerMessage(db, tester, {
      agentId: STUDIO,
      text: "How much is whitening?",
      channel: "web_chat",
      test: true,
      policy: draft,
      now: monday,
    });
    expect(tester.seen[0]?.instructions).toContain(
      "Service: Whitening, from 250 EUR. Takes one hour.",
    );

    const customer = studioDeps("prices", [{ reply: "Let me check." }]);
    await handleCustomerMessage(db, customer, {
      agentId: STUDIO,
      text: "How much is whitening?",
      channel: "web_chat",
      policy: draft,
      now: monday,
    });
    expect(customer.seen[0]?.instructions).not.toContain("Whitening");
  });

  describe("a sales agent", () => {
    // Its own fictional business: a web design studio.
    const TENANT_S = "10000000-0000-4000-8000-00000000000e";
    const SALES = "20000000-0000-4000-8000-0000000000e1";
    const salesPolicy = {
      version: 2,
      profile: { timezone: "UTC" },
      rules: [],
      procedures: [{ ...procedureFromTemplate("qualify"), id: "p-qualify" }],
      limits: { handoffContact: "Sam, sales" },
      sales: {
        offer: "Websites for small businesses.",
        idealCustomer: "Budget over 2,000 EUR.",
        questions: [
          {
            key: "budget",
            question: "What budget do you have?",
            options: [
              { label: "Under 500 EUR", rating: "no" },
              { label: "Over 2,000 EUR", rating: "great" },
            ],
          },
          {
            key: "timing",
            question: "When do you want to start?",
            options: [
              { label: "This month", rating: "great" },
              { label: "Later", rating: "ok" },
            ],
          },
        ],
      },
    };
    beforeAll(async () => {
      await client.query(
        "insert into tenants (id, name, slug, agent_limit) values ($1, 'Fictional Web Studio', 'web-studio-e', 2)",
        [TENANT_S],
      );
      await client.query(
        "insert into agents (id, tenant_id, name, type, status, config) values ($1, $2, 'Sales', 'sales', 'live', $3)",
        [SALES, TENANT_S, JSON.stringify(salesPolicy)],
      );
    });

    it("qualifies whoever it talks to, scores in code and saves the lead", async () => {
      const d = studioDeps("general_question", [
        { reply: "Happy to help. What budget do you have?", fields: { need: "A new website" } },
        {
          reply: "Thanks!",
          fields: {
            q_budget: "Over 2,000 EUR",
            q_timing: "This month",
            name: "Ana Example",
            contact: "ana@example.com",
          },
        },
      ]);
      const first = await handleCustomerMessage(db, d, {
        agentId: SALES,
        text: "Hi, do you build websites?",
        channel: "web_chat",
      });
      if (first.status !== "ok") throw new Error("unavailable");
      expect(d.seen[0]?.instructions).toContain("SALES:");
      expect(d.seen[0]?.instructions).toContain('q_budget = "Under 500 EUR" | "Over 2,000 EUR"');
      expect(d.seen[0]?.collect).toContain("q_budget");
      const last = await handleCustomerMessage(db, d, {
        agentId: SALES,
        conversationId: first.conversationId,
        text: "Over 2k. I'm Ana Example, ana@example.com",
        channel: "web_chat",
      });
      if (last.status !== "ok") throw new Error("unavailable");
      expect(last.reply).toContain("great fit");
      expect(last.reply).not.toMatch(/points|score/i);
      const [lead] = await rows<{ bucket: string; score: number; name: string; is_test: boolean }>(
        "select bucket, score, name, is_test from leads where conversation_id = $1",
        [last.conversationId],
      );
      expect(lead).toMatchObject({ bucket: "hot", score: 4, name: "Ana Example", is_test: false });
    });

    it("closes politely as soon as an answer says not a fit, without the other questions", async () => {
      const d = studioDeps("general_question", [
        {
          reply: "Thanks.",
          fields: {
            need: "A website",
            q_budget: "Under 500 EUR",
            name: "Ben Example",
            contact: "ben@example.com",
          },
        },
      ]);
      const r = await handleCustomerMessage(db, d, {
        agentId: SALES,
        text: "I need a cheap website, under 500",
        channel: "web_chat",
      });
      if (r.status !== "ok") throw new Error("unavailable");
      expect(r.reply).toContain("may not be the right fit");
      const [lead] = await rows<{ bucket: string }>(
        "select bucket from leads where conversation_id = $1",
        [r.conversationId],
      );
      expect(lead?.bucket).toBe("not_fit");
    });
  });
});

describe("calendar booking at runtime", () => {
  const TENANT_D = "10000000-0000-4000-8000-00000000000d";
  const CAL = "20000000-0000-4000-8000-0000000000d1";
  const SECRET = "test-secret-value-that-is-long-enough";
  const policy = {
    version: 2,
    profile: {
      timezone: "UTC",
      hours: { tue: { open: "08:00", close: "18:00" } },
      services: [{ name: "Check-up", duration: "45 min" }],
    },
    rules: [],
    procedures: [
      {
        id: "p-book",
        template: "book",
        name: "Book a visit",
        whenToUse: "New appointment.",
        whenNotToUse: "",
        requiredInfo: [
          { key: "name", label: "Name", type: "text" },
          { key: "service", label: "Service", type: "text" },
          { key: "date", label: "Day", type: "date" },
          { key: "time", label: "Time", type: "time" },
        ],
        steps: [],
        confirmBeforeActing: false,
        enabled: true,
      },
    ],
    limits: { minNoticeHours: 1, bookingWindowDays: 30, handoffContact: "Reception" },
  };
  const bookingDeps = (busy: boolean | "error", created: unknown[]): RuntimeDeps => ({
    classifiers: [
      {
        provider: "groq",
        paid: false,
        classify: async () => ({
          intent: "booking",
          confidence: 0.95,
          provider: "groq",
          model: "f",
          inputTokens: 1,
          outputTokens: 1,
          costMicros: 0,
          latencyMs: 1,
        }),
      },
    ],
    answer: async () => ({
      reply: "The team will confirm.",
      answered: true,
      topic: null,
      lead: false,
      provider: "groq",
      model: "f",
      inputTokens: 1,
      outputTokens: 1,
      costMicros: 0,
      latencyMs: 1,
      fields: { name: "Ana Example", service: "Check-up", date: "2026-10-20", time: "10:00" },
      confirmed: true,
    }),
    calendar: {
      secret: SECRET,
      api: {
        accessToken: async (rt) => {
          if (busy === "error") throw new Error("google_401");
          return `access-for-${rt}`;
        },
        isBusy: async () => busy === true,
        createEvent: async (_t, _c, event) => {
          created.push(event);
          return { id: "evt1" };
        },
      },
    },
  });

  beforeAll(async () => {
    await client.query(
      "insert into tenants (id, name, slug, agent_limit) values ($1, 'Fictional Clinic D', 'clinic-d', 2)",
      [TENANT_D],
    );
    await client.query(
      "insert into agents (id, tenant_id, name, type, status, config) values ($1, $2, 'Desk', 'receptionist', 'live', $3)",
      [CAL, TENANT_D, JSON.stringify(policy)],
    );
    const { encryptToken } = await import("./calendar");
    await client.query(
      "insert into calendar_connections (agent_id, tenant_id, refresh_token_enc) values ($1, $2, $3)",
      [CAL, TENANT_D, encryptToken("rt-1", SECRET)],
    );
  });

  it("books a free slot straight into the calendar", async () => {
    const created: { start: Date; end: Date; summary: string }[] = [];
    const r = await handleCustomerMessage(db, bookingDeps(false, created), {
      agentId: CAL,
      text: "Book a check-up Tuesday 10am, Ana Example",
      channel: "web_chat",
      now: new Date("2026-10-19T10:00:00Z"),
    });
    if (r.status !== "ok") throw new Error("expected ok");
    expect(r.reply).toContain("You're booked: Check-up on 2026-10-20 at 10:00");
    expect(created[0]?.start.toISOString()).toBe("2026-10-20T10:00:00.000Z");
    expect(created[0]?.end.toISOString()).toBe("2026-10-20T10:45:00.000Z"); // 45-minute service
    const [conv] = await rows<{ outcome: string }>(
      "select outcome from conversations where id = $1",
      [r.conversationId],
    );
    expect(conv?.outcome).toBe("booked");
  });

  it("asks for another time when the slot is taken", async () => {
    const created: unknown[] = [];
    const r = await handleCustomerMessage(db, bookingDeps(true, created), {
      agentId: CAL,
      text: "Book me in",
      channel: "web_chat",
      now: new Date("2026-10-19T10:00:00Z"),
    });
    if (r.status !== "ok") throw new Error("expected ok");
    expect(r.reply).toContain("already taken");
    expect(created).toEqual([]);
    const [conv] = await rows<{
      state: { procedure?: string; collected?: Record<string, string> };
    }>("select state from conversations where id = $1", [r.conversationId]);
    expect(conv?.state.procedure).toBe("book");
    expect(conv?.state.collected).toEqual({ name: "Ana Example", service: "Check-up" });
  });

  it("falls back to a request for the team when Google fails, and marks the link", async () => {
    const r = await handleCustomerMessage(db, bookingDeps("error", []), {
      agentId: CAL,
      text: "Book me in",
      channel: "web_chat",
      now: new Date("2026-10-19T10:00:00Z"),
    });
    expect(r.status === "ok" && r.reply).toContain("team will confirm");
    const [link] = await rows<{ status: string }>(
      "select status from calendar_connections where agent_id = $1",
      [CAL],
    );
    expect(link?.status).toBe("revoked");
  });
});
