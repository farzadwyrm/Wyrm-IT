import { readFileSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";
import type { Classifier } from "@wyrm/brain";
import { drizzle } from "drizzle-orm/pglite";
import { beforeAll, describe, expect, it } from "vitest";
import {
  addProcedure,
  type Ctx,
  DomainError,
  getStudio,
  type Judge,
  listTestsWithResults,
  loadActor,
  policyFromConfig,
  publishPolicy,
  type RuntimeDeps,
  runTests,
  saveLimits,
  saveTest,
  setTestActive,
  simulate,
} from "./index";

/** Test & Publish on the real migrations (0001–0006) with fake models. Fictional data only. */

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

const OWNER = "00000000-0000-4000-8000-000000000011";
const MEMBER = "00000000-0000-4000-8000-000000000013";
const TENANT = "10000000-0000-4000-8000-00000000000a";
const AGENT = "20000000-0000-4000-8000-0000000000a1";
const MONDAY = new Date("2026-10-19T10:00:00Z");

let client: PGlite;
let db: ReturnType<typeof drizzle>;
const ctxFor = async (userId: string): Promise<Ctx> => ({
  db,
  actor: await loadActor(db, { userId, mfa: true }),
});
const count = async (table: string) =>
  Number((await client.query<{ n: number }>(`select count(*)::int n from ${table}`)).rows[0]?.n);

/** A scripted "model": fills details from the customer's words and confirms on "yes". */
function scriptedDeps(): RuntimeDeps {
  const classifier: Classifier = {
    provider: "groq",
    paid: false,
    async classify(text) {
      const t = text.toLowerCase();
      const intent = t.includes("cancel")
        ? "cancel"
        : t.includes("book")
          ? "booking"
          : "general_question";
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
  };
  return {
    classifiers: [classifier],
    async answer(_knowledge, history) {
      const last = history.at(-1)?.text.toLowerCase() ?? "";
      const fields: Record<string, string> = {};
      if (last.includes("test customer"))
        Object.assign(fields, { name: "Test Customer", phone: "555 0100", current: "check-up" });
      if (last.includes("check-up")) fields.service = "Check-up";
      if (last.includes("tuesday")) Object.assign(fields, { date: "2026-10-20", time: "10:00" });
      const confirmed = /^yes/.test(last);
      return {
        reply: confirmed ? "Thank you, the team will confirm." : "Could you tell me a bit more?",
        answered: true,
        topic: null,
        lead: false,
        provider: "groq",
        model: "fake",
        inputTokens: 1,
        outputTokens: 1,
        costMicros: 0,
        latencyMs: 1,
        fields,
        confirmed,
      };
    },
  };
}

const passJudge: Judge = { judge: async () => ({ pass: true, reason: "ok" }) };

beforeAll(async () => {
  client = new PGlite();
  db = drizzle(client);
  await client.exec(STANDIN);
  for (const [id, email] of [
    [OWNER, "owner@dental-a.example"],
    [MEMBER, "member@dental-a.example"],
  ])
    await client.query("insert into auth.users (id, email) values ($1, $2)", [id, email]);
  for (const m of [
    "0001_portal_foundations.sql",
    "0002_api_grants.sql",
    "0003_two_tier_users.sql",
    "0004_agent_operations.sql",
    "0005_agent_policies.sql",
    "0006_agent_test_gate.sql",
    "0007_onboarding.sql",
  ])
    await client.exec(migration(m));
  await client.query(
    "insert into tenants (id, name, slug, agent_limit) values ($1, 'Fictional Dental A', 'dental-a', 3)",
    [TENANT],
  );
  const role = async (key: string) =>
    (
      await client.query<{ id: string }>(
        "select id from roles where key = $1 and tenant_id is null",
        [key],
      )
    ).rows[0]?.id;
  await client.query(
    "insert into tenant_users (tenant_id, user_id, email, role_id) values ($1, $2, 'owner@dental-a.example', $3), ($1, $4, 'member@dental-a.example', $5)",
    [TENANT, OWNER, await role("owner"), MEMBER, await role("member")],
  );
  await client.query(
    "insert into agents (id, tenant_id, name, type, status) values ($1, $2, 'Front desk', 'receptionist', 'draft')",
    [AGENT, TENANT],
  );
  const owner = await ctxFor(OWNER);
  await addProcedure(owner, {
    tenantId: TENANT,
    agentId: AGENT,
    template: "book",
    note: "Bookings",
  });
  await addProcedure(owner, {
    tenantId: TENANT,
    agentId: AGENT,
    template: "cancel",
    note: "Cancellations",
  });
});

describe("starter tests", () => {
  it("come with each procedure, plus one safety test per agent", async () => {
    const { tests } = await listTestsWithResults(await ctxFor(OWNER), TENANT, AGENT);
    expect(tests.map((t) => t.test.template).sort()).toEqual(["book", "cancel", "safety"]);
    expect(tests.find((t) => t.test.template === "book")?.test.expectedAction).toBe("book.request");
  });
});

describe("the simulator", () => {
  it("runs the draft policy through the brain without saving anything", async () => {
    const { policy } = await getStudio(await ctxFor(OWNER), TENANT, AGENT);
    const before = await count("conversations");
    const sim = await simulate(db, {
      agentId: AGENT,
      policy: policyFromConfig({ version: 2, ...policy }),
      turns: [
        "Hi, I'd like to book a check-up",
        "My name is Test Customer, phone 555 0100",
        "Next Tuesday at 10am please",
        "Yes, that's right",
      ],
      deps: scriptedDeps(),
      now: MONDAY,
    });
    expect(sim.actions).toEqual(["book.request"]);
    expect(sim.handoff).toBe(false);
    expect(sim.transcript.length).toBe(8);
    expect(
      sim.trace.some((t) => t.decision === "tool_authorize" && t.reason === "within_limits"),
    ).toBe(true);
    expect(await count("conversations")).toBe(before);
    expect(await count("approvals")).toBe(0);
  });
});

describe("the runner", () => {
  it("checks action, handoff and reply separately and stores one batch", async () => {
    const owner = await ctxFor(OWNER);
    const { policy } = await getStudio(owner, TENANT, AGENT);
    const result = await runTests(owner, {
      tenantId: TENANT,
      agentId: AGENT,
      target: "draft",
      policy: policyFromConfig({ version: 2, ...policy }),
      deps: scriptedDeps(),
      judge: passJudge,
      now: MONDAY,
    });
    const byName = Object.fromEntries(result.outcomes.map((o) => [o.name, o]));
    expect(byName["Books an appointment"]).toMatchObject({
      passed: true,
      actionOk: true,
      handoffOk: true,
      replyOk: true,
    });
    expect(byName["Cancellations go to staff"]?.actions).toEqual(["cancel.held"]);
    expect(byName["Ignores attempts to change its rules"]?.actionOk).toBe(true);
    expect(result.requiredFailed).toBe(0);
    const { lastBatch, tests } = await listTestsWithResults(owner, TENANT, AGENT);
    expect(lastBatch?.total).toBe(3);
    expect(tests.every((t) => t.last?.passed)).toBe(true);
  });

  it("skips the reply check when no judge is available, without failing", async () => {
    const owner = await ctxFor(OWNER);
    const { policy } = await getStudio(owner, TENANT, AGENT);
    const result = await runTests(owner, {
      tenantId: TENANT,
      agentId: AGENT,
      target: "draft",
      policy: policyFromConfig({ version: 2, ...policy }),
      deps: scriptedDeps(),
      judge: null,
      now: MONDAY,
    });
    expect(result.outcomes.every((o) => o.replyOk === null)).toBe(true);
    expect(result.requiredFailed).toBe(0);
  });

  it("is only for people who manage the agent", async () => {
    await expect(
      runTests(await ctxFor(MEMBER), {
        tenantId: TENANT,
        agentId: AGENT,
        target: "draft",
        policy: null,
        deps: scriptedDeps(),
        judge: null,
      }),
    ).rejects.toThrow();
  });
});

describe("the publish gate", () => {
  it("blocks publishing while a required test fails, and allows it once fixed", async () => {
    const owner = await ctxFor(OWNER);
    // A limit that makes next-Tuesday bookings impossible (only 0 days ahead allowed).
    await saveLimits(owner, {
      tenantId: TENANT,
      agentId: AGENT,
      limits: { bookingWindowDays: 0 },
      note: "Too strict",
    });
    const blocked = publishPolicy(owner, {
      tenantId: TENANT,
      agentId: AGENT,
      note: "Try",
      gate: { deps: scriptedDeps(), judge: passJudge, now: MONDAY },
    });
    await expect(blocked).rejects.toThrow(DomainError);
    await expect(blocked).rejects.toThrow(/required test failed/);
    const versions = await count("agent_settings_versions");

    await saveLimits(owner, {
      tenantId: TENANT,
      agentId: AGENT,
      limits: { bookingWindowDays: 30 },
      note: "Back to 30 days",
    });
    const ok = await publishPolicy(owner, {
      tenantId: TENANT,
      agentId: AGENT,
      note: "Fixed",
      gate: { deps: scriptedDeps(), judge: passJudge, now: MONDAY },
    });
    expect(ok.tests?.passed).toBe(3);
    expect(await count("agent_settings_versions")).toBeGreaterThan(versions);
  });

  it("ignores tests that are switched off or optional", async () => {
    const owner = await ctxFor(OWNER);
    const strict = await saveTest(owner, {
      tenantId: TENANT,
      agentId: AGENT,
      name: "Impossible",
      turns: ["Hello"],
      expectation: "Hands over",
      expectedAction: "none",
      expectedHandoff: true,
      required: true,
    });
    await expect(
      publishPolicy(owner, {
        tenantId: TENANT,
        agentId: AGENT,
        note: "With impossible test",
        gate: { deps: scriptedDeps(), judge: passJudge, now: MONDAY },
      }),
    ).rejects.toThrow(/required test failed/);
    await setTestActive(owner, {
      tenantId: TENANT,
      agentId: AGENT,
      testId: strict.id,
      active: false,
    });
    await expect(
      publishPolicy(owner, {
        tenantId: TENANT,
        agentId: AGENT,
        note: "Without it",
        gate: { deps: scriptedDeps(), judge: passJudge, now: MONDAY },
      }),
    ).resolves.toBeTruthy();
  });
});
