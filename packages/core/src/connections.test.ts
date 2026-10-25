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
  checkSelect,
  coerceParam,
  compileSelect,
  createTenant,
  DomainError,
  deleteConnection,
  grantAgentAccess,
  inviteStaff,
  type KnowledgeDeps,
  listConnectionCalls,
  listConnections,
  loadActor,
  openConnection,
  provisionAgent,
  recordConnectionCheck,
  rowsToText,
  saveConnection,
  saveLookup,
  setConnectionEnabled,
} from "./index";

/**
 * Read-only connections (migration 0009) in an in-memory Postgres: the SELECT checker, who may
 * manage connections, secrets never returned, approved lookups only, and lookups used while
 * answering. Fictional company and data; no real database or model is contacted.
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
};
const KEY = "fictional-test-encryption-key-not-a-real-secret";

let client: PGlite;
let db: ReturnType<typeof drizzle>;
let tenant = "";
let agent = "";

const ctxFor = async (person: { id: string }): Promise<Ctx> => ({
  db,
  actor: await loadActor(db, { userId: person.id, mfa: true }),
});

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
  });
  tenant = a.tenant.id;
  const join = (token: string, p: { id: string; email: string }) =>
    acceptInvitation({ db, actor: null }, { token, userId: p.id, email: p.email });
  await join(a.token, people.owner);
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
  await join(invite.token, people.member);
  agent =
    (await provisionAgent(sup, { tenantId: tenant, name: "Ask ops", type: "knowledge" }))?.id ?? "";
  const memberId = (
    await client.query<{ id: string }>("select id from tenant_users where user_id = $1", [
      people.member.id,
    ])
  ).rows[0]?.id as string;
  // Even with "configure" on the agent, a member can't manage connections (no security.manage).
  await grantAgentAccess(owner, {
    tenantId: tenant,
    agentId: agent,
    subjectType: "user",
    subjectId: memberId,
    level: "configure",
  });
});

describe("checkSelect", () => {
  it("accepts one SELECT (or WITH) and lists its parameters", () => {
    expect(
      checkSelect(
        "SELECT status, eta FROM orders_v WHERE order_no = :order_no AND note <> ':not_a_param'",
      ),
    ).toEqual({ ok: true, params: ["order_no"] });
    expect(
      checkSelect("with x as (select 1 as n) select n::text from x where n = :n;").params,
    ).toEqual(["n"]);
  });

  it("refuses anything that could write, run code or hide a second statement", () => {
    for (const sql of [
      "DELETE FROM orders",
      "SELECT 1; DROP TABLE orders",
      "SELECT * INTO backup FROM orders",
      "SELECT * FROM orders FOR UPDATE",
      "SELECT pg_sleep(10)",
      "SELECT 1 -- sneaky",
      "SELECT 1 /* x */",
      "EXEC xp_cmdshell 'dir'",
      "SELECT * FROM orders WHERE id = 1 UNION SELECT * FROM openrowset('x')",
      "update orders set status = 'x'",
    ])
      expect(checkSelect(sql).ok, sql).toBe(false);
  });

  it("compiles placeholders for each driver without inlining values", () => {
    const sql = "select * from t where a = :a and b = :b and c = :a";
    expect(compileSelect(sql, "postgres", { a: "x'; drop", b: 2 })).toEqual({
      text: "select * from t where a = $1 and b = $2 and c = $1",
      values: ["x'; drop", 2],
    });
    expect(compileSelect(sql, "mysql", { a: 1, b: 2 }).values).toEqual([1, 2, 1]);
    expect(compileSelect(sql, "sqlserver", { a: 1, b: 2 }).text).toContain("@p1 and b = @p2");
    expect(() => compileSelect(sql, "postgres", { a: 1 })).toThrow(DomainError);
  });

  it("checks parameter types and turns rows into text", () => {
    expect(coerceParam({ name: "n", label: "Number", type: "number" }, "12,5")).toBe(12.5);
    expect(() => coerceParam({ name: "d", label: "Date", type: "date" }, "tomorrow")).toThrow();
    expect(() => coerceParam({ name: "t", label: "Name", type: "text" }, "  ")).toThrow();
    expect(rowsToText([{ order_no: "A-1", status: "shipped" }])).toBe(
      "order_no: A-1; status: shipped",
    );
    expect(rowsToText([])).toBe("No matching records.");
  });
});

describe("connections", () => {
  let connectionId = "";

  it("only owners and admins add connections, and the secret never comes back", async () => {
    await expect(
      saveConnection(await ctxFor(people.member), {
        tenantId: tenant,
        agentId: agent,
        kind: "postgres",
        name: "Orders",
        config: { host: "db.acme-tools.example", database: "shop", user: "wyrm_readonly" },
        secret: "fictional-password",
        encryptionKey: KEY,
      }),
    ).rejects.toThrow(ForbiddenError);
    const saved = await saveConnection(await ctxFor(people.owner), {
      tenantId: tenant,
      agentId: agent,
      kind: "postgres",
      name: "Orders",
      config: { host: "db.acme-tools.example", database: "shop", user: "wyrm_readonly" },
      secret: "fictional-password",
      encryptionKey: KEY,
    });
    connectionId = saved.id;
    expect(saved).toMatchObject({ status: "untested", hasSecret: true });
    expect(JSON.stringify(saved)).not.toContain("fictional-password");
    expect(
      JSON.stringify(await listConnections(await ctxFor(people.owner), tenant, agent)),
    ).not.toContain("secretEnc");
    const opened = await openConnection(
      await ctxFor(people.owner),
      { tenantId: tenant, agentId: agent, id: connectionId, encryptionKey: KEY },
      "manage",
    );
    expect(opened.secret).toBe("fictional-password");
  });

  it("refuses private or local hosts and plain-http search APIs", async () => {
    for (const host of ["localhost", "10.0.0.5", "db.corp", "nas.local"])
      await expect(
        saveConnection(await ctxFor(people.owner), {
          tenantId: tenant,
          agentId: agent,
          kind: "mysql",
          name: "Bad",
          config: { host, database: "x", user: "y" },
          encryptionKey: KEY,
        }),
      ).rejects.toThrow(DomainError);
    await expect(
      saveConnection(await ctxFor(people.owner), {
        tenantId: tenant,
        agentId: agent,
        kind: "search_api",
        name: "Search",
        config: { url: "http://search.acme-tools.example/search" },
        encryptionKey: KEY,
      }),
    ).rejects.toThrow(DomainError);
  });

  it("stores only read-only lookups with matching parameters", async () => {
    await expect(
      saveLookup(await ctxFor(people.owner), {
        tenantId: tenant,
        agentId: agent,
        connectionId,
        name: "Wipe",
        description: "Never allowed, writes data",
        query: "delete from orders where order_no = :order_no",
        params: [],
      }),
    ).rejects.toThrow(DomainError);
    const lookup = await saveLookup(await ctxFor(people.owner), {
      tenantId: tenant,
      agentId: agent,
      connectionId,
      name: "Order status",
      description: "When someone asks where an order is or when it ships",
      query: "select status, eta from orders_v where order_no = :order_no",
      params: [{ name: "order_no", label: "Order number", type: "text" }],
    });
    expect(lookup.params).toEqual([{ name: "order_no", label: "Order number", type: "text" }]);
  });

  it("runs a lookup while answering only once the connection passed its check, and logs it", async () => {
    await addKnowledgeSource(await ctxFor(people.owner), {
      tenantId: tenant,
      agentId: agent,
      kind: "text",
      name: "Shipping policy",
      text: "Orders ship within 2 working days. Tracking is emailed when an order ships.",
    });
    const ran: Record<string, string | number>[] = [];
    const deps: KnowledgeDeps = {
      plan: async () => ({
        words: ["order", "ships"],
        lookup: { n: 1, params: { order_no: "A-1001" } },
        costMicros: 0,
      }),
      runLookup: async ({ values }) => {
        ran.push(values);
        return [{ order_no: "A-1001", status: "shipped", eta: "2026-10-24" }];
      },
      answer: async ({ passages }) => ({
        reply: `It shipped [1]. ${passages[0]?.text}`,
        cited: [1],
        answered: true,
        provider: "groq",
        model: "fake",
        inputTokens: 1,
        outputTokens: 1,
        costMicros: 0,
      }),
    };
    const ask = async () =>
      askKnowledge(
        await ctxFor(people.member),
        { tenantId: tenant, agentId: agent, question: "Where is order A-1001?" },
        deps,
      );
    await ask();
    expect(ran).toHaveLength(0); // untested connection: not used

    await recordConnectionCheck(await ctxFor(people.owner), {
      tenantId: tenant,
      agentId: agent,
      id: connectionId,
      ok: true,
      note: "Read-only user",
    });
    const r = await ask();
    expect(ran).toEqual([{ order_no: "A-1001" }]);
    expect(r.citations[0]?.name).toBe("Orders · Order status");
    expect(r.reply).toContain("status: shipped");
    const log = await listConnectionCalls(await ctxFor(people.owner), tenant, agent);
    expect(log[0]?.call).toMatchObject({ ok: true, rows: 1, params: { order_no: "A-1001" } });
    expect(log[0]?.call.questionId).toBe(r.questionId);

    await setConnectionEnabled(await ctxFor(people.owner), {
      tenantId: tenant,
      agentId: agent,
      id: connectionId,
      enabled: false,
    });
    await ask();
    expect(ran).toHaveLength(1); // disabled: not used
  });

  it("removes a connection with its lookups", async () => {
    await deleteConnection(await ctxFor(people.owner), {
      tenantId: tenant,
      agentId: agent,
      id: connectionId,
    });
    expect(await listConnections(await ctxFor(people.owner), tenant, agent)).toEqual([]);
    const left = await client.query("select count(*)::int as n from connection_lookups");
    expect((left.rows[0] as { n: number }).n).toBe(0);
  });
});
