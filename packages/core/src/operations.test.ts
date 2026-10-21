import { readFileSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";
import { ForbiddenError } from "@wyrm/auth";
import { drizzle } from "drizzle-orm/pglite";
import { beforeAll, describe, expect, it } from "vitest";
import {
  acceptInvitation,
  activityByDay,
  addCorrection,
  type Ctx,
  createTenant,
  customerHealth,
  DomainError,
  decideApproval,
  getConversation,
  grantAgentAccess,
  hashPayload,
  homeMetrics,
  inviteStaff,
  listApprovals,
  listConversations,
  listCorrections,
  loadActor,
  notableChange,
  provisionAgent,
  publishVersion,
  resolveAttention,
  saveDraft,
  setSwitch,
  testFromConversation,
  unansweredTopics,
  usageSummary,
} from "./index";

/**
 * Agent operations through the core API (migrations 0001–0004 in an in-memory Postgres):
 * isolation, per-agent access, approvals, teaching, versions, off switches and metrics.
 * Fictional people and businesses only.
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
  ownerA: { id: uid(11), email: "owner@dental-a.example" },
  memberA: { id: uid(13), email: "member@dental-a.example" },
  viewerA: { id: uid(14), email: "viewer@dental-a.example" },
  ownerB: { id: uid(21), email: "owner@salon-b.example" },
};

let client: PGlite;
let db: ReturnType<typeof drizzle>;
let tenantA = "";
let tenantB = "";
let frontDesk = "";
let quotes = "";
let convBooked = "";
let convQuote = "";
let memberTenantUserId = "";

const ctxFor = async (person: { id: string }): Promise<Ctx> => ({
  db,
  actor: await loadActor(db, { userId: person.id, mfa: true }),
  ip: "203.0.113.9",
});

const roleId = async (key: string) =>
  (
    await client.query<{ id: string }>(
      "select id from roles where key = $1 and tenant_id is null",
      [key],
    )
  ).rows[0]?.id ?? "";

async function addConversation(
  tenant: string,
  agent: string,
  fields: {
    outcome?: string;
    flags?: string[];
    topics?: string[];
    daysAgo?: number;
    label: string;
  },
) {
  const res = await client.query<{ id: string }>(
    `insert into conversations (tenant_id, agent_id, channel, customer_label, outcome, flags, topics, started_at)
     values ($1, $2, 'web_chat', $3, $4, $5, $6, now() - make_interval(days => $7)) returning id`,
    [
      tenant,
      agent,
      fields.label,
      fields.outcome ?? null,
      fields.flags ?? [],
      fields.topics ?? [],
      fields.daysAgo ?? 0,
    ],
  );
  const id = res.rows[0]?.id ?? "";
  await client.query(
    "insert into conversation_messages (conversation_id, tenant_id, role, body) values ($1, $2, 'customer', $3), ($1, $2, 'agent', 'Happy to help.')",
    [id, tenant, `Question from ${fields.label}`],
  );
  return id;
}

async function approvalFor(tenant: string, agent: string, minutes: number, payload: unknown) {
  const res = await client.query<{ id: string }>(
    `insert into approvals (tenant_id, agent_id, action, risk_tier, summary, payload, payload_hash, expires_at)
     values ($1, $2, 'quote.send', 2, 'Send a fictional quote', $3, $4, now() + make_interval(mins => $5)) returning id`,
    [tenant, agent, JSON.stringify(payload), hashPayload(payload), minutes],
  );
  return res.rows[0]?.id ?? "";
}

beforeAll(async () => {
  client = new PGlite();
  db = drizzle(client);
  await client.exec(STANDIN);
  for (const p of Object.values(people)) {
    await client.query("insert into auth.users (id, email) values ($1, $2)", [p.id, p.email]);
  }
  for (const m of ["0001_portal_foundations.sql", "0002_api_grants.sql"])
    await client.exec(migration(m));
  await client.query("insert into wyrm_admins (user_id) values ($1)", [people.super.id]);
  for (const m of [
    "0003_two_tier_users.sql",
    "0004_agent_operations.sql",
    "0005_agent_policies.sql",
    "0006_agent_test_gate.sql",
    "0007_onboarding.sql",
  ])
    await client.exec(migration(m));

  const sup = await ctxFor(people.super);
  const a = await createTenant(sup, {
    name: "Fictional Dental A",
    slug: "dental-a",
    ownerEmail: people.ownerA.email,
    agentLimit: 3,
  });
  const b = await createTenant(sup, {
    name: "Fictional Salon B",
    slug: "salon-b",
    ownerEmail: people.ownerB.email,
  });
  tenantA = a.tenant.id;
  tenantB = b.tenant.id;
  const join = (token: string, p: { id: string; email: string }) =>
    acceptInvitation({ db, actor: null }, { token, userId: p.id, email: p.email });
  await join(a.token, people.ownerA);
  await join(b.token, people.ownerB);
  const ownerA = await ctxFor(people.ownerA);
  const m = await inviteStaff(ownerA, {
    tenantId: tenantA,
    email: people.memberA.email,
    roleId: await roleId("member"),
  });
  const memberRow = await join(m.token, people.memberA);
  memberTenantUserId = (memberRow as { id: string } | undefined)?.id ?? "";
  const v = await inviteStaff(ownerA, {
    tenantId: tenantA,
    email: people.viewerA.email,
    roleId: await roleId("viewer"),
  });
  await join(v.token, people.viewerA);

  frontDesk =
    (await provisionAgent(sup, { tenantId: tenantA, name: "Front desk", type: "receptionist" }))
      ?.id ?? "";
  quotes =
    (await provisionAgent(sup, { tenantId: tenantA, name: "Quotes", type: "quote" }))?.id ?? "";
  const salon =
    (await provisionAgent(sup, { tenantId: tenantB, name: "Salon phone", type: "receptionist" }))
      ?.id ?? "";
  if (!memberTenantUserId) {
    memberTenantUserId =
      (
        await client.query<{ id: string }>("select id from tenant_users where user_id = $1", [
          people.memberA.id,
        ])
      ).rows[0]?.id ?? "";
  }
  await grantAgentAccess(ownerA, {
    tenantId: tenantA,
    agentId: frontDesk,
    subjectType: "user",
    subjectId: memberTenantUserId,
    level: "use",
  });

  convBooked = await addConversation(tenantA, frontDesk, {
    label: "Booked caller",
    outcome: "booked",
  });
  await addConversation(tenantA, frontDesk, {
    label: "Booked last week",
    outcome: "booked",
    daysAgo: 9,
  });
  await addConversation(tenantA, frontDesk, {
    label: "Parking 1",
    outcome: "handed_off",
    flags: ["needs_attention", "unanswered"],
    topics: ["parking"],
  });
  await addConversation(tenantA, frontDesk, {
    label: "Parking 2",
    outcome: "resolved_assumed",
    flags: ["unanswered"],
    topics: ["parking"],
  });
  convQuote = await addConversation(tenantA, quotes, { label: "Quote caller", outcome: "lead" });
  await addConversation(tenantB, salon, { label: "Salon caller", outcome: "booked" });
});

describe("tenant isolation", () => {
  it("refuses another tenant's conversations, even with a real id", async () => {
    const ownerB = await ctxFor(people.ownerB);
    await expect(listConversations(ownerB, tenantA)).rejects.toThrow(ForbiddenError);
    await expect(getConversation(ownerB, tenantB, convBooked)).rejects.toThrow(/not found/i);
    await expect(homeMetrics(ownerB, tenantA)).rejects.toThrow(ForbiddenError);
    await expect(
      setSwitch(ownerB, {
        scope: "agent",
        tenantId: tenantA,
        agentId: frontDesk,
        reason: "not mine",
      }),
    ).rejects.toThrow(ForbiddenError);
  });
});

describe("per-agent access", () => {
  it("shows a member only the agent shared with them; a viewer without access sees none", async () => {
    const member = await listConversations(await ctxFor(people.memberA), tenantA);
    expect(member.map((r) => r.agentName)).not.toContain("Quotes");
    expect(member.length).toBe(4);
    await expect(getConversation(await ctxFor(people.memberA), tenantA, convQuote)).rejects.toThrow(
      ForbiddenError,
    );
    expect(await listConversations(await ctxFor(people.viewerA), tenantA)).toEqual([]);
    const owner = await listConversations(await ctxFor(people.ownerA), tenantA);
    expect(owner.length).toBe(5);
  });

  it("returns messages and the brain's decisions for a conversation", async () => {
    await client.query(
      "insert into agent_decisions (tenant_id, conversation_id, agent_id, decision, outcome, reason, provider) values ($1, $2, $3, 'route', 'ok', 'confident_match', 'anthropic')",
      [tenantA, convBooked, frontDesk],
    );
    const detail = await getConversation(await ctxFor(people.memberA), tenantA, convBooked);
    expect(detail.messages.map((m) => m.role)).toEqual(["customer", "agent"]);
    expect(detail.decisions[0]?.reason).toBe("confident_match");
  });

  it("filters by outcome and by needs-attention, and resolves to-do items", async () => {
    const owner = await ctxFor(people.ownerA);
    expect((await listConversations(owner, tenantA, { outcome: "lead" })).length).toBe(1);
    const todo = await listConversations(owner, tenantA, { needsAttention: true });
    expect(todo.length).toBe(1);
    await resolveAttention(await ctxFor(people.memberA), tenantA, todo[0]?.conversation.id ?? "");
    expect(await listConversations(owner, tenantA, { needsAttention: true })).toEqual([]);
  });
});

describe("approvals", () => {
  it("need configure access, are decided once, and rejecting needs a reason", async () => {
    const id = await approvalFor(tenantA, frontDesk, 60, { quote: 120 });
    const member = await ctxFor(people.memberA);
    await expect(
      decideApproval(member, { tenantId: tenantA, approvalId: id, approve: true }),
    ).rejects.toThrow(ForbiddenError);
    const owner = await ctxFor(people.ownerA);
    await expect(
      decideApproval(owner, { tenantId: tenantA, approvalId: id, approve: false }),
    ).rejects.toThrow(/why/);
    const done = await decideApproval(owner, { tenantId: tenantA, approvalId: id, approve: true });
    expect(done?.status).toBe("approved");
    await expect(
      decideApproval(owner, { tenantId: tenantA, approvalId: id, approve: true }),
    ).rejects.toThrow(DomainError);
    expect((await listApprovals(owner, tenantA)).map((a) => a.approval.id)).not.toContain(id);
  });

  it("can't be approved after they expire, and stay invisible to other tenants", async () => {
    const id = await approvalFor(tenantA, frontDesk, 1, { quote: 1 });
    await client.query("alter table approvals disable trigger approvals_flow");
    await client.query(
      "update approvals set requested_at = now() - interval '2 hours', expires_at = now() - interval '1 hour' where id = $1",
      [id],
    );
    await client.query("alter table approvals enable trigger approvals_flow");
    await expect(
      decideApproval(await ctxFor(people.ownerA), {
        tenantId: tenantA,
        approvalId: id,
        approve: true,
      }),
    ).rejects.toThrow(/expired/);
    await expect(
      decideApproval(await ctxFor(people.ownerB), {
        tenantId: tenantB,
        approvalId: id,
        approve: true,
      }),
    ).rejects.toThrow(/not found/i);
  });
});

describe("teaching", () => {
  it("saves a correction with a test; members can't teach", async () => {
    const owner = await ctxFor(people.ownerA);
    const row = await addCorrection(owner, {
      tenantId: tenantA,
      agentId: frontDesk,
      topic: "parking",
      question: "Is there parking?",
      correctAnswer: "Yes, free parking behind the building.",
      conversationId: convBooked,
    });
    expect(row?.testId).toBeTruthy();
    await expect(
      addCorrection(await ctxFor(people.memberA), {
        tenantId: tenantA,
        agentId: frontDesk,
        correctAnswer: "No.",
      }),
    ).rejects.toThrow(ForbiddenError);
    expect((await listCorrections(owner, tenantA)).length).toBe(1);
    const test = await testFromConversation(owner, {
      tenantId: tenantA,
      conversationId: convBooked,
      name: "Booking call",
      expectation: "Books the cleaning",
    });
    expect(test?.turns).toEqual(["Question from Booked caller"]);
  });

  it("finds unanswered topics this month", async () => {
    const topics = await unansweredTopics(await ctxFor(people.ownerA), tenantA);
    expect(topics[0]).toMatchObject({ topic: "parking", n: 2 });
  });
});

describe("versions and switches", () => {
  it("publishes a draft and restores an older version as a new one", async () => {
    const owner = await ctxFor(people.ownerA);
    const v1 = await saveDraft(owner, {
      tenantId: tenantA,
      agentId: frontDesk,
      settings: { greeting: "Hello" },
    });
    await publishVersion(owner, { tenantId: tenantA, agentId: frontDesk, versionId: v1?.id ?? "" });
    const v2 = await saveDraft(owner, {
      tenantId: tenantA,
      agentId: frontDesk,
      settings: { greeting: "Hi there" },
    });
    await publishVersion(owner, { tenantId: tenantA, agentId: frontDesk, versionId: v2?.id ?? "" });
    const restored = await publishVersion(owner, {
      tenantId: tenantA,
      agentId: frontDesk,
      versionId: v1?.id ?? "",
    });
    expect(restored?.id).not.toBe(v1?.id);
    const cfg = await client.query<{ config: { greeting: string } }>(
      "select config from agents where id = $1",
      [frontDesk],
    );
    expect(cfg.rows[0]?.config.greeting).toBe("Hello");
    await expect(
      saveDraft(await ctxFor(people.memberA), {
        tenantId: tenantA,
        agentId: frontDesk,
        settings: {},
      }),
    ).rejects.toThrow(ForbiddenError);
  });

  it("lets owners pause an agent or everything, and only Wyrm switch off everyone", async () => {
    const owner = await ctxFor(people.ownerA);
    expect(
      await setSwitch(owner, {
        scope: "agent",
        tenantId: tenantA,
        agentId: quotes,
        reason: "Holiday",
      }),
    ).toBeTruthy();
    expect(
      await setSwitch(owner, { scope: "tenant", tenantId: tenantA, reason: "Closed today" }),
    ).toBeTruthy();
    await expect(setSwitch(owner, { scope: "global", reason: "nope" })).rejects.toThrow(
      ForbiddenError,
    );
    await expect(
      setSwitch(await ctxFor(people.memberA), {
        scope: "tenant",
        tenantId: tenantA,
        reason: "member",
      }),
    ).rejects.toThrow(ForbiddenError);
    expect(
      await setSwitch(await ctxFor(people.super), {
        scope: "provider",
        target: "groq",
        reason: "Outage",
      }),
    ).toBeTruthy();
  });
});

describe("home numbers and usage", () => {
  it("counts this week against last week for visible agents", async () => {
    const home = await homeMetrics(await ctxFor(people.ownerA), tenantA);
    const get = (k: string) => home.metrics.find((m) => m.key === k);
    expect(get("booked")).toMatchObject({ current: 1, previous: 1 });
    expect(get("leads")?.current).toBe(1);
    expect(get("answered")?.current).toBe(4);
    const member = await homeMetrics(await ctxFor(people.memberA), tenantA);
    expect(member.metrics.find((m) => m.key === "leads")?.current).toBe(0); // quotes agent hidden
  });

  it("counts conversations per day, oldest first, with empty days", async () => {
    const days = await activityByDay(await ctxFor(people.ownerA), tenantA, 14);
    expect(days).toHaveLength(14);
    expect(days.at(-1)?.day).toBe(new Date().toISOString().slice(0, 10));
    expect(days.reduce((t, d) => t + d.total, 0)).toBe(5);
    expect(days.reduce((t, d) => t + d.handedOff, 0)).toBe(1);
    expect(days.reduce((t, d) => t + d.handled, 0)).toBe(4);
    const member = await activityByDay(await ctxFor(people.memberA), tenantA, 14);
    expect(member.reduce((t, d) => t + d.total, 0)).toBe(4); // quotes agent hidden
    await expect(activityByDay(await ctxFor(people.ownerB), tenantA)).rejects.toThrow(
      ForbiddenError,
    );
  });

  it("gives Wyrm staff one health row per client; customers can't read it", async () => {
    const rows = await customerHealth(await ctxFor(people.super));
    const a = rows.find((r) => r.tenantId === tenantA);
    expect(a).toMatchObject({ agents: 2, conversations7d: 4, waiting: 0, handedOff7d: 1 }); // resolved above
    expect(rows.find((r) => r.tenantId === tenantB)?.conversations7d).toBe(1);
    await expect(customerHealth(await ctxFor(people.ownerA))).rejects.toThrow(ForbiddenError);
  });

  it("flags only big week-over-week changes", () => {
    expect(notableChange({ key: "x", current: 12, previous: 6 })).toBe("up");
    expect(notableChange({ key: "x", current: 2, previous: 4 })).toBeNull();
    expect(notableChange({ key: "x", current: 3, previous: 10 })).toBe("down");
  });

  it("projects the month's AI spend; members can't see billing", async () => {
    const now = new Date();
    await client.query(
      "insert into usage_daily (tenant_id, agent_id, day, llm_calls, cost_micros, conversations) values ($1, $2, current_date, 10, 5000, 4)",
      [tenantA, frontDesk],
    );
    const usage = await usageSummary(await ctxFor(people.ownerA), tenantA, now);
    expect(usage.spentTodayMicros).toBe(5000);
    expect(usage.dailyCapMicros).toBe(100_000);
    expect(usage.projectedMonthMicros).toBeGreaterThanOrEqual(5000);
    await expect(usageSummary(await ctxFor(people.memberA), tenantA)).rejects.toThrow(
      ForbiddenError,
    );
  });
});
