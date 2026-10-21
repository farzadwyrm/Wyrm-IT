import { readFileSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

/**
 * Migration 0004 (agent operations) on top of 0001–0003, in an in-memory Postgres with a
 * stand-in for Supabase's `auth` schema. Proves: tenant isolation of conversations and
 * decisions, per-agent log access, approvals that are single-use and expire, an append-only
 * decision log, same-tenant references, off-switch shapes, and that signed-in users can't write.
 * Fictional people and businesses only.
 */

const migration = (name: string) =>
  readFileSync(new URL(`../migrations/${name}`, import.meta.url), "utf8");

const STANDIN = `
create schema auth;
create table auth.users (id uuid primary key, email text);
create function auth.uid() returns uuid language sql stable as $$
  select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
$$;
create role anon; create role authenticated; create role service_role;
grant usage on schema public, auth to anon, authenticated, service_role;
`;

const id = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const SUPER = id(1);
const OWNER_A = id(11);
const MEMBER_A = id(13);
const VIEWER_A = id(14);
const OWNER_B = id(21);
const TENANT_A = "10000000-0000-4000-8000-00000000000a";
const TENANT_B = "10000000-0000-4000-8000-00000000000b";
const AGENT_A1 = "20000000-0000-4000-8000-0000000000a1";
const AGENT_A2 = "20000000-0000-4000-8000-0000000000a2";
const AGENT_B1 = "20000000-0000-4000-8000-0000000000b1";
const HASH = "a".repeat(64);

let db: PGlite;
const rows = async (sql: string, params: unknown[] = []) =>
  (await db.query<Record<string, unknown>>(sql, params)).rows;

async function as<T>(userId: string | null, run: () => Promise<T>): Promise<T> {
  await db.exec(userId ? "set role authenticated" : "set role anon");
  await db.query("select set_config('request.jwt.claim.sub', $1, false)", [userId ?? ""]);
  try {
    return await run();
  } finally {
    await db.exec("reset role");
  }
}

const roleId = async (key: string) =>
  (await rows("select id from roles where key = $1 and tenant_id is null", [key]))[0]?.id;

async function conversation(tenant: string, agent: string | null, label: string) {
  const [row] = await rows(
    "insert into conversations (tenant_id, agent_id, channel, customer_label) values ($1, $2, 'web_chat', $3) returning id",
    [tenant, agent, label],
  );
  return row?.id as string;
}

async function approval(tenant: string, agent: string, minutes = 60) {
  const [row] = await rows(
    `insert into approvals (tenant_id, agent_id, action, risk_tier, summary, payload_hash, expires_at)
     values ($1, $2, 'booking.cancel', 2, 'Cancel a fictional booking', $3, now() + make_interval(mins => $4))
     returning id`,
    [tenant, agent, `${HASH.slice(0, 60)}${String(minutes).padStart(4, "0")}`, minutes],
  );
  return row?.id as string;
}

beforeAll(async () => {
  db = new PGlite();
  await db.exec(STANDIN);
  for (const [uid, email] of [
    [SUPER, "super@wyrm.example"],
    [OWNER_A, "owner@dental-a.example"],
    [MEMBER_A, "member@dental-a.example"],
    [VIEWER_A, "viewer@dental-a.example"],
    [OWNER_B, "owner@salon-b.example"],
  ]) {
    await db.query("insert into auth.users (id, email) values ($1, $2)", [uid, email]);
  }
  await db.exec(migration("0001_portal_foundations.sql"));
  await db.exec(migration("0002_api_grants.sql"));
  await db.query("insert into wyrm_admins (user_id) values ($1)", [SUPER]);
  await db.exec(migration("0003_two_tier_users.sql"));
  await db.exec(migration("0004_agent_operations.sql"));

  await db.query(
    "insert into tenants (id, name, slug, agent_limit, retention_days) values ($1, 'Fictional Dental A', 'dental-a', 3, 30), ($2, 'Fictional Salon B', 'salon-b', 3, 180)",
    [TENANT_A, TENANT_B],
  );
  const staff: [string, string, string, string][] = [
    [TENANT_A, OWNER_A, "owner@dental-a.example", "owner"],
    [TENANT_A, MEMBER_A, "member@dental-a.example", "member"],
    [TENANT_A, VIEWER_A, "viewer@dental-a.example", "viewer"],
    [TENANT_B, OWNER_B, "owner@salon-b.example", "owner"],
  ];
  for (const [tenant, user, email, role] of staff) {
    await db.query(
      "insert into tenant_users (tenant_id, user_id, email, role_id) values ($1, $2, $3, $4)",
      [tenant, user, email, await roleId(role)],
    );
  }
  await db.query(
    `insert into agents (id, tenant_id, name, type) values
     ($1, $4, 'Front desk', 'receptionist'), ($2, $4, 'Quotes', 'quote'), ($3, $5, 'Salon phone', 'receptionist')`,
    [AGENT_A1, AGENT_A2, AGENT_B1, TENANT_A, TENANT_B],
  );
  // The member may use only the front desk agent.
  const [member] = await rows("select id from tenant_users where user_id = $1", [MEMBER_A]);
  await db.query(
    "insert into agent_access (agent_id, tenant_id, subject_type, subject_id, level) values ($1, $2, 'user', $3, 'use')",
    [AGENT_A1, TENANT_A, member?.id],
  );
});

afterAll(async () => {
  await db.close();
});

describe("conversations and decisions", () => {
  it("are invisible to other tenants and to signed-out visitors", async () => {
    const convA = await conversation(TENANT_A, AGENT_A1, "Caller 1");
    await conversation(TENANT_B, AGENT_B1, "Caller 2");
    await db.query(
      "insert into conversation_messages (conversation_id, tenant_id, role, body) values ($1, $2, 'customer', 'Do you open on Saturday?')",
      [convA, TENANT_A],
    );
    await db.query(
      "insert into agent_decisions (tenant_id, conversation_id, agent_id, decision, outcome, intent, confidence, provider) values ($1, $2, $3, 'route', 'ok', 'opening_hours', 0.92, 'code')",
      [TENANT_A, convA, AGENT_A1],
    );

    const ownerB = await as(OWNER_B, () => rows("select customer_label from conversations"));
    expect(ownerB.map((r) => r.customer_label)).toEqual(["Caller 2"]);
    expect(await as(OWNER_B, () => rows("select id from conversation_messages"))).toEqual([]);
    expect(await as(OWNER_B, () => rows("select id from agent_decisions"))).toEqual([]);
    await expect(as(null, () => rows("select id from conversations"))).rejects.toThrow(
      /permission denied/,
    );
  });

  it("follow per-agent access: a member sees only the agent granted to them", async () => {
    await conversation(TENANT_A, AGENT_A2, "Quote request");
    const member = await as(MEMBER_A, () =>
      rows("select customer_label from conversations order by customer_label"),
    );
    expect(member.map((r) => r.customer_label)).toEqual(["Caller 1"]);
    const owner = await as(OWNER_A, () =>
      rows("select customer_label from conversations order by customer_label"),
    );
    expect(owner.map((r) => r.customer_label)).toEqual(["Caller 1", "Quote request"]);
    // A viewer has the logs permission but no view_all and no grant: nothing.
    expect(await as(VIEWER_A, () => rows("select id from conversations"))).toEqual([]);
    expect(await as(MEMBER_A, () => rows("select body from conversation_messages"))).toEqual([
      { body: "Do you open on Saturday?" },
    ]);
  });

  it("are visible to Wyrm support staff", async () => {
    const all = await as(SUPER, () => rows("select id from conversations"));
    expect(all.length).toBeGreaterThanOrEqual(3);
  });

  it("can't be written by signed-in users", async () => {
    await expect(
      as(OWNER_A, () =>
        rows("insert into conversations (tenant_id, agent_id, channel) values ($1, $2, 'sms')", [
          TENANT_A,
          AGENT_A1,
        ]),
      ),
    ).rejects.toThrow(/permission denied/);
    await expect(as(OWNER_A, () => rows("update conversations set summary = 'x'"))).rejects.toThrow(
      /permission denied/,
    );
  });

  it("refuse references to another tenant's agent or conversation", async () => {
    await expect(conversation(TENANT_A, AGENT_B1, "Wrong agent")).rejects.toThrow(
      /tenant_mismatch/,
    );
    const convB = await conversation(TENANT_B, AGENT_B1, "Salon caller");
    await expect(
      db.query(
        "insert into conversation_messages (conversation_id, tenant_id, role, body) values ($1, $2, 'agent', 'hi')",
        [convB, TENANT_A],
      ),
    ).rejects.toThrow(/tenant_mismatch/);
  });

  it("keep the organisation's retention period", async () => {
    const convA = await conversation(TENANT_A, AGENT_A1, "Retention check");
    const [row] = await rows(
      "select (purge_after - started_at) = interval '30 days' as ok from conversations where id = $1",
      [convA],
    );
    expect(row?.ok).toBe(true);
  });

  it("keep the decision log append-only", async () => {
    await expect(db.query("update agent_decisions set outcome = 'failed'")).rejects.toThrow(
      /append_only/,
    );
  });
});

describe("approvals", () => {
  it("can be decided once, by a named reviewer", async () => {
    const a = await approval(TENANT_A, AGENT_A1);
    await expect(
      db.query("update approvals set status = 'approved' where id = $1", [a]),
    ).rejects.toThrow(/approval_reviewer_required/);
    await db.query("update approvals set status = 'approved', decided_by = $2 where id = $1", [
      a,
      OWNER_A,
    ]);
    const [row] = await rows(
      "select decided_at is not null as stamped from approvals where id = $1",
      [a],
    );
    expect(row?.stamped).toBe(true);
    await expect(
      db.query(
        "update approvals set status = 'rejected', decided_by = $2, decision_reason = 'no' where id = $1",
        [a, OWNER_A],
      ),
    ).rejects.toThrow(/approval_used/);
    await db.query("update approvals set status = 'executed' where id = $1", [a]);
    await expect(
      db.query("update approvals set status = 'executed' where id = $1", [a]),
    ).resolves.toBeDefined();
    await expect(
      db.query("update approvals set status = 'approved', decided_by = $2 where id = $1", [
        a,
        OWNER_A,
      ]),
    ).rejects.toThrow(/approval_used/);
  });

  it("can't be approved after they expire, or changed after they're requested", async () => {
    const a = await approval(TENANT_A, AGENT_A1, 1);
    await db.exec("alter table approvals disable trigger approvals_flow");
    await db.query(
      "update approvals set requested_at = now() - interval '2 hours', expires_at = now() - interval '1 hour' where id = $1",
      [a],
    );
    await db.exec("alter table approvals enable trigger approvals_flow");
    await expect(
      db.query("update approvals set status = 'approved', decided_by = $2 where id = $1", [
        a,
        OWNER_A,
      ]),
    ).rejects.toThrow(/approval_expired/);
    const b = await approval(TENANT_A, AGENT_A1, 90);
    await expect(
      db.query(`update approvals set payload = '{"refund": 500}' where id = $1`, [b]),
    ).rejects.toThrow(/approval_immutable/);
  });

  it("need a reason to reject, and only tier 2 or 3 actions are held", async () => {
    const a = await approval(TENANT_A, AGENT_A1, 120);
    await expect(
      db.query("update approvals set status = 'rejected', decided_by = $2 where id = $1", [
        a,
        OWNER_A,
      ]),
    ).rejects.toThrow(/approval_reason_required/);
    await expect(
      db.query(
        `insert into approvals (tenant_id, action, risk_tier, summary, payload_hash, expires_at)
         values ($1, 'faq.answer', 0, 'Answer a question', $2, now() + interval '1 hour')`,
        [TENANT_A, HASH],
      ),
    ).rejects.toThrow(/check constraint/);
  });

  it("are hidden from other tenants", async () => {
    expect(await as(OWNER_B, () => rows("select id from approvals"))).toEqual([]);
    expect((await as(OWNER_A, () => rows("select id from approvals"))).length).toBeGreaterThan(0);
  });
});

describe("teaching, usage and off switches", () => {
  it("links corrections to a test of the same agent and tenant", async () => {
    const [test] = await rows(
      `insert into agent_tests (tenant_id, agent_id, name, turns, expectation, source)
       values ($1, $2, 'Saturday hours', array['Are you open Saturday?'], 'Says closed on Saturday', 'correction')
       returning id`,
      [TENANT_A, AGENT_A1],
    );
    await db.query(
      "insert into corrections (tenant_id, agent_id, correct_answer, test_id) values ($1, $2, 'We are closed on Saturdays.', $3)",
      [TENANT_A, AGENT_A1, test?.id],
    );
    await expect(
      db.query(
        "insert into corrections (tenant_id, agent_id, correct_answer, test_id) values ($1, $2, 'Wrong tenant', $3)",
        [TENANT_B, AGENT_B1, test?.id],
      ),
    ).rejects.toThrow(/tenant_mismatch/);
    expect(await as(OWNER_B, () => rows("select id from corrections"))).toEqual([]);
  });

  it("keeps one usage row per tenant, agent and day", async () => {
    await db.query(
      "insert into usage_daily (tenant_id, agent_id, day, llm_calls, cost_micros) values ($1, null, current_date, 3, 150)",
      [TENANT_A],
    );
    await expect(
      db.query(
        "insert into usage_daily (tenant_id, agent_id, day) values ($1, null, current_date)",
        [TENANT_A],
      ),
    ).rejects.toThrow(/duplicate key/);
    // Owners see usage (billing.view); a member doesn't see brain-level usage.
    expect((await as(OWNER_A, () => rows("select id from usage_daily"))).length).toBe(1);
    expect(await as(MEMBER_A, () => rows("select id from usage_daily"))).toEqual([]);
  });

  it("allows only well-formed off switches, one active per target", async () => {
    await db.query(
      "insert into kill_switches (scope, reason) values ('global', 'Maintenance test')",
    );
    await expect(
      db.query(
        "insert into kill_switches (scope, tenant_id, reason) values ('global', $1, 'bad shape')",
        [TENANT_A],
      ),
    ).rejects.toThrow(/check constraint/);
    await db.query(
      "insert into kill_switches (scope, tenant_id, agent_id, reason, automatic) values ('agent', $1, $2, 'Error spike', true)",
      [TENANT_A, AGENT_A1],
    );
    await expect(
      db.query(
        "insert into kill_switches (scope, tenant_id, agent_id, reason) values ('agent', $1, $2, 'again')",
        [TENANT_A, AGENT_A1],
      ),
    ).rejects.toThrow(/duplicate key/);
    await expect(
      db.query(
        "insert into kill_switches (scope, tenant_id, agent_id, reason) values ('agent', $1, $2, 'cross')",
        [TENANT_A, AGENT_B1],
      ),
    ).rejects.toThrow(/tenant_mismatch/);
    // Tenants see their own switches, never Wyrm's global ones.
    const owner = await as(OWNER_A, () => rows("select scope from kill_switches"));
    expect(owner).toEqual([{ scope: "agent" }]);
    expect(await as(OWNER_B, () => rows("select scope from kill_switches"))).toEqual([]);
  });

  it("gives every organisation an AI budget", async () => {
    const [row] = await rows("select ai_monthly_budget_micros from tenants where id = $1", [
      TENANT_B,
    ]);
    expect(Number(row?.ai_monthly_budget_micros)).toBe(2_000_000);
  });
});
