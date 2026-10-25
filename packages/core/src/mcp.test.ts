import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";
import { procedureFromTemplate } from "@wyrm/brain";
import { drizzle } from "drizzle-orm/pglite";
import { beforeAll, describe, expect, it } from "vitest";
import {
  assertMcpActor,
  type Ctx,
  callMcpTool,
  createAuthCode,
  decideApproval,
  exchangeCode,
  handleMcpMessage,
  loadActor,
  type McpDeps,
  refreshTokens,
  registerClient,
  verifyAccessToken,
} from "./index";
import type { Answer } from "./runtime";

/** Wyrm agents over MCP (phase 0), on the real migrations. Fictional data and fake models only. */

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

const OWNER_A = "00000000-0000-4000-8000-0000000000a1";
const MEMBER_A = "00000000-0000-4000-8000-0000000000a2";
const OWNER_B = "00000000-0000-4000-8000-0000000000b1";
const TENANT_A = "10000000-0000-4000-8000-0000000000aa";
const TENANT_B = "10000000-0000-4000-8000-0000000000bb";
const SALES_A = "20000000-0000-4000-8000-0000000000a1";
const SALES_B = "20000000-0000-4000-8000-0000000000b1";
const RESOURCE = "https://portal.example/mcp";
const REDIRECT = "https://client.example/callback";

let client: PGlite;
let db: ReturnType<typeof drizzle>;
const rows = async <T = Record<string, unknown>>(q: string, p: unknown[] = []) =>
  (await client.query<T>(q, p)).rows;

const ctxFor = async (userId: string, tenantId: string): Promise<Ctx> => ({
  db,
  actor: await loadActor(db, { userId, mfa: false, tenantId }),
});

/** Fake models: the classifier always says "general_question"; replies come from a script. */
function deps(replies: Partial<Answer>[] = [{ reply: "Happy to help. What's your budget?" }]) {
  let i = 0;
  const d: McpDeps = {
    secret: "test-secret-for-confirmations-only",
    runtime: {
      classifiers: [
        {
          provider: "groq",
          paid: false,
          async classify() {
            return {
              intent: "general_question",
              confidence: 0.9,
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
      async answer() {
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
    },
    // No documents agent in these fixtures; the knowledge tool is never reached.
    knowledge: { answer: async () => null },
  };
  return d;
}

const salesConfig = JSON.stringify({
  version: 2,
  profile: { timezone: "UTC" },
  rules: [],
  procedures: [{ ...procedureFromTemplate("qualify"), id: "p-qualify" }],
  limits: { handoffContact: "Sales team" },
  sales: {
    offer: "Stone worktops.",
    idealCustomer: "Kitchens over 1,500 EUR.",
    questions: [
      {
        key: "budget",
        question: "What budget do you have?",
        options: [
          { label: "Under 500 EUR", rating: "no" },
          { label: "Over 1,500 EUR", rating: "great" },
        ],
      },
    ],
  },
});

beforeAll(async () => {
  client = new PGlite();
  db = drizzle(client);
  await client.exec(STANDIN);
  for (const [id, email] of [
    [OWNER_A, "owner@stone-a.example"],
    [MEMBER_A, "member@stone-a.example"],
    [OWNER_B, "owner@salon-b.example"],
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
    "0008_knowledge.sql",
    "0009_connections.sql",
    "0010_sales.sql",
    "0011_history_cleanup.sql",
    "0012_mcp_oauth.sql",
  ])
    await client.exec(migration(m));
  await client.query(
    `insert into tenants (id, name, slug, agent_limit, features) values
     ($1, 'Fictional Stone A', 'stone-a', 3, '{"mcp": true}'),
     ($2, 'Fictional Salon B', 'salon-b', 3, '{"mcp": true}')`,
    [TENANT_A, TENANT_B],
  );
  const role = async (key: string) =>
    (
      await rows<{ id: string }>("select id from roles where key = $1 and tenant_id is null", [key])
    )[0]?.id;
  const owner = await role("owner");
  const member = await role("member");
  await client.query(
    `insert into tenant_users (tenant_id, user_id, email, role_id) values
     ($1, $2, 'owner@stone-a.example', $5), ($1, $3, 'member@stone-a.example', $6),
     ($4, $7, 'owner@salon-b.example', $5)`,
    [TENANT_A, OWNER_A, MEMBER_A, TENANT_B, owner, member, OWNER_B],
  );
  await client.query(
    `insert into agents (id, tenant_id, name, type, status, config) values
     ($1, $3, 'Sales A', 'sales', 'live', $5), ($2, $4, 'Sales B', 'sales', 'live', $5)`,
    [SALES_A, SALES_B, TENANT_A, TENANT_B, salesConfig],
  );
});

describe("OAuth for MCP clients", () => {
  it("registers a public client, issues single-use PKCE codes and audience-bound tokens", async () => {
    await expect(registerClient(db, { redirect_uris: ["http://evil.example/cb"] })).rejects.toThrow(
      /https/,
    );
    const app = await registerClient(db, {
      client_name: "Fictional AI",
      redirect_uris: [REDIRECT],
    });
    const verifier = "a-very-long-fictional-code-verifier-that-is-random-enough-123";
    const challenge = createHash("sha256").update(verifier).digest("base64url");
    const code = await createAuthCode(db, {
      clientId: app.clientId,
      userId: OWNER_A,
      tenantId: TENANT_A,
      redirectUri: REDIRECT,
      codeChallenge: challenge,
      resource: RESOURCE,
    });
    // Wrong verifier, wrong redirect: refused.
    await expect(
      exchangeCode(db, {
        code,
        clientId: app.clientId,
        redirectUri: REDIRECT,
        codeVerifier: "x".repeat(50),
      }),
    ).rejects.toThrow(/invalid/);
    await expect(
      exchangeCode(db, {
        code,
        clientId: app.clientId,
        redirectUri: "https://client.example/other",
        codeVerifier: verifier,
      }),
    ).rejects.toThrow(/invalid/);
    const tokens = await exchangeCode(db, {
      code,
      clientId: app.clientId,
      redirectUri: REDIRECT,
      codeVerifier: verifier,
    });
    // A code works once.
    await expect(
      exchangeCode(db, {
        code,
        clientId: app.clientId,
        redirectUri: REDIRECT,
        codeVerifier: verifier,
      }),
    ).rejects.toThrow(/invalid|used/);
    expect(await verifyAccessToken(db, tokens.access_token, RESOURCE)).toMatchObject({
      userId: OWNER_A,
      tenantId: TENANT_A,
    });
    // A token for this server is no good anywhere else, and a made-up token is nothing.
    expect(
      await verifyAccessToken(db, tokens.access_token, "https://other.example/mcp"),
    ).toBeNull();
    expect(await verifyAccessToken(db, "made-up-token", RESOURCE)).toBeNull();
    // Refresh rotates: the old refresh token stops working.
    const next = await refreshTokens(db, {
      refreshToken: tokens.refresh_token,
      clientId: app.clientId,
    });
    expect(next.access_token).not.toBe(tokens.access_token);
    await expect(
      refreshTokens(db, { refreshToken: tokens.refresh_token, clientId: app.clientId }),
    ).rejects.toThrow(/invalid/);
    // Switching AI app access off for the organisation stops its tokens at once.
    await client.query("update tenants set features = '{}' where id = $1", [TENANT_A]);
    expect(await verifyAccessToken(db, next.access_token, RESOURCE)).toBeNull();
    await client.query(`update tenants set features = '{"mcp": true}' where id = $1`, [TENANT_A]);
  });
});

describe("MCP tools", () => {
  it("lists five tools and negotiates the protocol version", async () => {
    const ctx = await ctxFor(OWNER_A, TENANT_A);
    const caller = { tenantId: TENANT_A, userId: OWNER_A };
    const init = await handleMcpMessage(
      ctx,
      caller,
      { jsonrpc: "2.0", id: 1, method: "initialize", params: { protocolVersion: "2025-06-18" } },
      deps(),
    );
    expect(init).toMatchObject({ result: { protocolVersion: "2025-06-18" } });
    const list = await handleMcpMessage(
      ctx,
      caller,
      { jsonrpc: "2.0", id: 2, method: "tools/list" },
      deps(),
    );
    const names = (list as { result: { tools: { name: string }[] } }).result.tools.map(
      (t) => t.name,
    );
    expect(names).toEqual([
      "wyrm_sales_qualify",
      "wyrm_knowledge_ask",
      "wyrm_booking_request",
      "wyrm_request_status",
      "wyrm_leads_search",
    ]);
    expect(
      await handleMcpMessage(
        ctx,
        caller,
        { jsonrpc: "2.0", method: "notifications/initialized" },
        deps(),
      ),
    ).toBeNull();
  });

  it("says replies are AI-generated, and finishes with a lead scored in code", async () => {
    const ctx = await ctxFor(OWNER_A, TENANT_A);
    const caller = { tenantId: TENANT_A, userId: OWNER_A };
    const d = deps([
      { reply: "Happy to help. What's your budget?", fields: { need: "Kitchen worktop" } },
      {
        reply: "Thanks!",
        fields: { q_budget: "Over 1,500 EUR", name: "Ana Example", contact: "ana@example.com" },
      },
    ]);
    const first = await callMcpTool(
      ctx,
      caller,
      "wyrm_sales_qualify",
      { message: "Hi, a new worktop?" },
      d,
    );
    expect(first.isError).toBeUndefined();
    expect(first.structuredContent).toMatchObject({ ai_generated: true, finished: false });
    expect(String(first.structuredContent?.reply)).toContain("I'm an AI");
    const id = String(first.structuredContent?.conversation_id);
    const last = await callMcpTool(
      ctx,
      caller,
      "wyrm_sales_qualify",
      { message: "Over 1,500. Ana Example, ana@example.com", conversation_id: id },
      d,
    );
    expect(last.structuredContent).toMatchObject({
      finished: true,
      lead: { bucket: "hot", score: 2, name: "Ana Example" },
    });
  });

  it("refuses forged or borrowed conversation handles", async () => {
    const d = deps();
    const a = await ctxFor(OWNER_A, TENANT_A);
    const started = await callMcpTool(
      a,
      { tenantId: TENANT_A, userId: OWNER_A },
      "wyrm_sales_qualify",
      { message: "Hello" },
      d,
    );
    const id = String(started.structuredContent?.conversation_id);
    // A made-up handle.
    const forged = await callMcpTool(
      a,
      { tenantId: TENANT_A, userId: OWNER_A },
      "wyrm_sales_qualify",
      { message: "Hi", conversation_id: "30000000-0000-4000-8000-000000000000" },
      d,
    );
    expect(forged.isError).toBe(true);
    // Another member of the same business can't continue it.
    const member = await callMcpTool(
      await ctxFor(MEMBER_A, TENANT_A),
      { tenantId: TENANT_A, userId: MEMBER_A },
      "wyrm_sales_qualify",
      { message: "Hi", conversation_id: id },
      d,
    );
    expect(member.isError).toBe(true);
    // Another business can't either.
    const other = await callMcpTool(
      await ctxFor(OWNER_B, TENANT_B),
      { tenantId: TENANT_B, userId: OWNER_B },
      "wyrm_sales_qualify",
      { message: "Hi", conversation_id: id },
      d,
    );
    expect(other.isError).toBe(true);
  });

  it("keeps businesses apart: leads, requests and the caller's organisation", async () => {
    const d = deps([
      {
        reply: "Thanks.",
        fields: { q_budget: "Over 1,500 EUR", name: "Ben B", contact: "ben@example.com" },
      },
    ]);
    const b = await ctxFor(OWNER_B, TENANT_B);
    await callMcpTool(
      b,
      { tenantId: TENANT_B, userId: OWNER_B },
      "wyrm_sales_qualify",
      { message: "Hi" },
      d,
    );
    const a = await ctxFor(OWNER_A, TENANT_A);
    const leadsA = await callMcpTool(
      a,
      { tenantId: TENANT_A, userId: OWNER_A },
      "wyrm_leads_search",
      {},
      d,
    );
    const found = (leadsA.structuredContent?.leads ?? []) as { name: string }[];
    const names = found.map((l) => l.name);
    expect(names).toContain("Ana Example");
    expect(names).not.toContain("Ben B");
    // Members can't list leads; only the owner.
    const member = await callMcpTool(
      await ctxFor(MEMBER_A, TENANT_A),
      { tenantId: TENANT_A, userId: MEMBER_A },
      "wyrm_leads_search",
      {},
      d,
    );
    expect(member.isError).toBe(true);
    // A token for business B with A's login is refused before any tool runs.
    const mixed = await ctxFor(OWNER_A, TENANT_B);
    expect(() => assertMcpActor(mixed, { tenantId: TENANT_B, userId: OWNER_A })).toThrow();
  });

  it("never books by itself: confirmation first, then staff approval", async () => {
    const d = deps();
    const ctx = await ctxFor(OWNER_A, TENANT_A);
    const caller = { tenantId: TENANT_A, userId: OWNER_A };
    const details = {
      name: "Ana Example",
      contact: "ana@example.com",
      service: "Measuring visit",
      date: "2026-11-10",
      time: "10:00",
    };
    const ask = await callMcpTool(ctx, caller, "wyrm_booking_request", details, d);
    expect(ask.structuredContent).toMatchObject({ status: "needs_confirmation" });
    expect(await rows("select id from approvals where tenant_id = $1", [TENANT_A])).toEqual([]);
    const token = String(ask.structuredContent?.confirm_token);
    // A token for other details, or a tampered one, is refused.
    const changed = await callMcpTool(
      ctx,
      caller,
      "wyrm_booking_request",
      { ...details, time: "11:00", confirm_token: token },
      d,
    );
    expect(changed.isError).toBe(true);
    const tampered = await callMcpTool(
      ctx,
      caller,
      "wyrm_booking_request",
      { ...details, confirm_token: `${token}x` },
      d,
    );
    expect(tampered.isError).toBe(true);
    // Business B can't use A's confirmation.
    const otherBusiness = await callMcpTool(
      await ctxFor(OWNER_B, TENANT_B),
      { tenantId: TENANT_B, userId: OWNER_B },
      "wyrm_booking_request",
      { ...details, confirm_token: token },
      d,
    );
    expect(otherBusiness.isError).toBe(true);
    const sent = await callMcpTool(
      ctx,
      caller,
      "wyrm_booking_request",
      { ...details, confirm_token: token },
      d,
    );
    expect(sent.structuredContent).toMatchObject({ status: "pending_staff_approval" });
    const requestId = String(sent.structuredContent?.request_id);
    // Sending again doesn't make a second request.
    const again = await callMcpTool(
      ctx,
      caller,
      "wyrm_booking_request",
      { ...details, confirm_token: token },
      d,
    );
    expect(again.structuredContent?.request_id).toBe(requestId);
    const waiting = await callMcpTool(
      ctx,
      caller,
      "wyrm_request_status",
      { request_id: requestId },
      d,
    );
    expect(waiting.structuredContent).toMatchObject({ status: "pending" });
    // Business B can't see it.
    const peek = await callMcpTool(
      await ctxFor(OWNER_B, TENANT_B),
      { tenantId: TENANT_B, userId: OWNER_B },
      "wyrm_request_status",
      { request_id: requestId },
      d,
    );
    expect(peek.isError).toBe(true);
    // Only a staff decision moves it on.
    await decideApproval(ctx, { tenantId: TENANT_A, approvalId: requestId, approve: true });
    const done = await callMcpTool(
      ctx,
      caller,
      "wyrm_request_status",
      { request_id: requestId },
      d,
    );
    expect(done.structuredContent).toMatchObject({ status: "approved" });
  });
});
