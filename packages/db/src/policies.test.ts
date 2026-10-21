import { readFileSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

/**
 * Migration 0005 (Agent Studio) on top of 0001–0004: tenant isolation, per-agent visibility,
 * the 15-rule cap, same-tenant references, an append-only change log that needs a note, and
 * read-only access for signed-in users. Fictional people and businesses only.
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
const OWNER_A = id(11);
const MEMBER_A = id(13);
const OWNER_B = id(21);
const TENANT_A = "10000000-0000-4000-8000-00000000000a";
const TENANT_B = "10000000-0000-4000-8000-00000000000b";
const FRONT = "20000000-0000-4000-8000-0000000000a1";
const QUOTES = "20000000-0000-4000-8000-0000000000a2";
const SALON = "20000000-0000-4000-8000-0000000000b1";

let db: PGlite;
const rows = async (sql: string, params: unknown[] = []) =>
  (await db.query<Record<string, unknown>>(sql, params)).rows;

async function as<T>(userId: string, run: () => Promise<T>): Promise<T> {
  await db.exec("set role authenticated");
  await db.query("select set_config('request.jwt.claim.sub', $1, false)", [userId]);
  try {
    return await run();
  } finally {
    await db.exec("reset role");
  }
}

beforeAll(async () => {
  db = new PGlite();
  await db.exec(STANDIN);
  for (const [uid, email] of [
    [OWNER_A, "owner@dental-a.example"],
    [MEMBER_A, "member@dental-a.example"],
    [OWNER_B, "owner@salon-b.example"],
  ]) {
    await db.query("insert into auth.users (id, email) values ($1, $2)", [uid, email]);
  }
  for (const m of [
    "0001_portal_foundations.sql",
    "0002_api_grants.sql",
    "0003_two_tier_users.sql",
    "0004_agent_operations.sql",
    "0005_agent_policies.sql",
    "0006_agent_test_gate.sql",
    "0007_onboarding.sql",
  ])
    await db.exec(migration(m));
  await db.query(
    "insert into tenants (id, name, slug, agent_limit) values ($1, 'Fictional Dental A', 'dental-a', 3), ($2, 'Fictional Salon B', 'salon-b', 3)",
    [TENANT_A, TENANT_B],
  );
  const role = async (key: string) =>
    (await rows("select id from roles where key = $1 and tenant_id is null", [key]))[0]?.id;
  for (const [tenant, user, email, r] of [
    [TENANT_A, OWNER_A, "owner@dental-a.example", "owner"],
    [TENANT_A, MEMBER_A, "member@dental-a.example", "member"],
    [TENANT_B, OWNER_B, "owner@salon-b.example", "owner"],
  ]) {
    await db.query(
      "insert into tenant_users (tenant_id, user_id, email, role_id) values ($1, $2, $3, $4)",
      [tenant, user, email, await role(r as string)],
    );
  }
  await db.query(
    "insert into agents (id, tenant_id, name, type) values ($1, $4, 'Front desk', 'receptionist'), ($2, $4, 'Quotes', 'quote'), ($3, $5, 'Salon phone', 'receptionist')",
    [FRONT, QUOTES, SALON, TENANT_A, TENANT_B],
  );
  const [member] = await rows("select id from tenant_users where user_id = $1", [MEMBER_A]);
  await db.query(
    "insert into agent_access (agent_id, tenant_id, subject_type, subject_id, level) values ($1, $2, 'user', $3, 'use')",
    [FRONT, TENANT_A, member?.id],
  );
  await db.query(
    `insert into business_profiles (tenant_id, profile) values ($1, '{"hours": "Mon-Fri 9-17"}')`,
    [TENANT_A],
  );
  await db.query(
    "insert into agent_rules (tenant_id, agent_id, text) values ($1, $2, 'Never discuss insurance claims.'), ($1, $3, 'Always mention the free consultation.')",
    [TENANT_A, FRONT, QUOTES],
  );
  await db.query(
    "insert into agent_procedures (tenant_id, agent_id, template, name, when_to_use) values ($1, $2, 'book', 'Book a visit', 'The customer wants an appointment.')",
    [TENANT_A, FRONT],
  );
  await db.query("insert into agent_limits (agent_id, tenant_id) values ($1, $2)", [
    FRONT,
    TENANT_A,
  ]);
});

afterAll(async () => {
  await db.close();
});

describe("policies", () => {
  it("are invisible to other organisations", async () => {
    expect(await as(OWNER_B, () => rows("select id from agent_rules"))).toEqual([]);
    expect(await as(OWNER_B, () => rows("select tenant_id from business_profiles"))).toEqual([]);
    expect(await as(OWNER_B, () => rows("select agent_id from agent_limits"))).toEqual([]);
  });

  it("follow per-agent visibility: a member sees only the agent shared with them", async () => {
    const member = await as(MEMBER_A, () => rows("select text from agent_rules"));
    expect(member).toEqual([{ text: "Never discuss insurance claims." }]);
    const owner = await as(OWNER_A, () => rows("select text from agent_rules order by text"));
    expect(owner.length).toBe(2);
    expect((await as(MEMBER_A, () => rows("select tenant_id from business_profiles"))).length).toBe(
      1,
    );
  });

  it("can't be written by signed-in users", async () => {
    await expect(
      as(OWNER_A, () =>
        rows("insert into agent_rules (tenant_id, agent_id, text) values ($1, $2, 'Hello there')", [
          TENANT_A,
          FRONT,
        ]),
      ),
    ).rejects.toThrow(/permission denied/);
  });

  it("refuse another organisation's agent", async () => {
    await expect(
      db.query(
        "insert into agent_rules (tenant_id, agent_id, text) values ($1, $2, 'Cross tenant')",
        [TENANT_A, SALON],
      ),
    ).rejects.toThrow(/tenant_mismatch/);
    await expect(
      db.query("insert into agent_limits (agent_id, tenant_id) values ($1, $2)", [SALON, TENANT_A]),
    ).rejects.toThrow(/tenant_mismatch/);
  });

  it("cap rules at 15 per agent and keep each short", async () => {
    for (let i = 0; i < 14; i++) {
      await db.query("insert into agent_rules (tenant_id, agent_id, text) values ($1, $2, $3)", [
        TENANT_A,
        FRONT,
        `Rule number ${i}`,
      ]);
    }
    await expect(
      db.query(
        "insert into agent_rules (tenant_id, agent_id, text) values ($1, $2, 'One too many')",
        [TENANT_A, FRONT],
      ),
    ).rejects.toThrow(/rule_limit/);
    await expect(
      db.query("insert into agent_rules (tenant_id, agent_id, text) values ($1, $2, $3)", [
        TENANT_A,
        QUOTES,
        "x".repeat(301),
      ]),
    ).rejects.toThrow(/check constraint/);
  });

  it("allow one procedure per template per agent, from the known templates only", async () => {
    await expect(
      db.query(
        "insert into agent_procedures (tenant_id, agent_id, template, name, when_to_use) values ($1, $2, 'book', 'Again', 'Duplicate booking')",
        [TENANT_A, FRONT],
      ),
    ).rejects.toThrow(/duplicate key/);
    await expect(
      db.query(
        "insert into agent_procedures (tenant_id, agent_id, template, name, when_to_use) values ($1, $2, 'refund', 'Refund', 'Give money back')",
        [TENANT_A, FRONT],
      ),
    ).rejects.toThrow(/check constraint/);
  });

  it("keep limits within safe ranges", async () => {
    await expect(
      db.query("update agent_limits set max_discount_percent = 150 where agent_id = $1", [FRONT]),
    ).rejects.toThrow(/check constraint/);
  });
});

describe("the change log", () => {
  it("needs a note and can't be edited or deleted", async () => {
    await expect(
      db.query(
        "insert into policy_changes (tenant_id, agent_id, object_type, action, note) values ($1, $2, 'rule', 'create', '  ')",
        [TENANT_A, FRONT],
      ),
    ).rejects.toThrow(/check constraint/);
    await db.query(
      "insert into policy_changes (tenant_id, agent_id, object_type, action, note) values ($1, $2, 'rule', 'create', 'Added insurance rule')",
      [TENANT_A, FRONT],
    );
    await expect(db.query("update policy_changes set note = 'changed'")).rejects.toThrow(
      /append_only/,
    );
    await expect(db.query("delete from policy_changes")).rejects.toThrow(/append_only/);
    expect(await as(OWNER_B, () => rows("select id from policy_changes"))).toEqual([]);
    expect((await as(OWNER_A, () => rows("select id from policy_changes"))).length).toBe(1);
  });
});

describe("test gate (0006)", () => {
  it("stores expected action and handoff, and batches stay within their organisation", async () => {
    await db.query(
      "insert into agent_tests (tenant_id, agent_id, name, turns, expectation, expected_action, expected_handoff, template) values ($1, $2, 'Books a check-up', array['Book me in'], 'Collects details and confirms', 'book.request', false, 'book')",
      [TENANT_A, FRONT],
    );
    await expect(
      db.query(
        "insert into agent_tests (tenant_id, agent_id, name, turns, expectation, expected_action) values ($1, $2, 'Bad', array['x'], 'Something', 'refund money')",
        [TENANT_A, FRONT],
      ),
    ).rejects.toThrow(/check constraint/);
    await db.query(
      "insert into agent_test_batches (tenant_id, agent_id, target, total) values ($1, $2, 'draft', 1)",
      [TENANT_A, FRONT],
    );
    await expect(
      db.query(
        "insert into agent_test_batches (tenant_id, agent_id, target) values ($1, $2, 'draft')",
        [TENANT_A, SALON],
      ),
    ).rejects.toThrow(/tenant_mismatch/);
    expect(await as(OWNER_B, () => rows("select id from agent_test_batches"))).toEqual([]);
    expect((await as(MEMBER_A, () => rows("select id from agent_test_batches"))).length).toBe(1);
  });
});

describe("onboarding (0007)", () => {
  it("never lets signed-in users read the encrypted calendar token", async () => {
    await db.query(
      "insert into calendar_connections (agent_id, tenant_id, account_email, refresh_token_enc) values ($1, $2, 'calendar@dental-a.example', 'ciphertext')",
      [FRONT, TENANT_A],
    );
    expect(
      await as(OWNER_A, () => rows("select account_email, status from calendar_connections")),
    ).toEqual([{ account_email: "calendar@dental-a.example", status: "ok" }]);
    await expect(
      as(OWNER_A, () => rows("select refresh_token_enc from calendar_connections")),
    ).rejects.toThrow(/permission denied/);
    await expect(as(OWNER_A, () => rows("select * from calendar_connections"))).rejects.toThrow(
      /permission denied/,
    );
    expect(await as(OWNER_B, () => rows("select account_email from calendar_connections"))).toEqual(
      [],
    );
  });

  it("keeps widget settings valid and within the organisation", async () => {
    await db.query(
      "insert into agent_channels (agent_id, tenant_id, widget_enabled, widget_origins) values ($1, $2, true, '{https://dental-a.example}')",
      [FRONT, TENANT_A],
    );
    await expect(
      db.query("update agent_channels set widget_color = 'red' where agent_id = $1", [FRONT]),
    ).rejects.toThrow(/check constraint/);
    await expect(
      db.query("insert into agent_channels (agent_id, tenant_id) values ($1, $2)", [
        SALON,
        TENANT_A,
      ]),
    ).rejects.toThrow(/tenant_mismatch/);
    expect(await as(OWNER_B, () => rows("select agent_id from agent_channels"))).toEqual([]);
  });

  it("shows website suggestions only to the organisation's members", async () => {
    await db.query(
      "insert into profile_suggestions (tenant_id, source_url, draft) values ($1, 'https://dental-a.example', '{}')",
      [TENANT_A],
    );
    expect((await as(MEMBER_A, () => rows("select id from profile_suggestions"))).length).toBe(1);
    expect(await as(OWNER_B, () => rows("select id from profile_suggestions"))).toEqual([]);
  });
});
