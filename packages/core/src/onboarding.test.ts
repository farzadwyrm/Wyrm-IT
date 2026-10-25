import { readFileSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";
import { ForbiddenError } from "@wyrm/auth";
import { drizzle } from "drizzle-orm/pglite";
import { beforeAll, describe, expect, it } from "vitest";
import {
  addProcedure,
  applySuggestion,
  type Ctx,
  cleanOrigins,
  createSuggestion,
  getStudio,
  listLeads,
  loadActor,
  provisionAgent,
  publishPolicy,
  saveChannel,
  saveLimits,
  saveProfile,
  saveSales,
  setAgentStatus,
  setLeadStatus,
  setupStatus,
  signOffLaunch,
  widgetAllowed,
} from "./index";

/** Onboarding on the real migrations (0001–0007). Fictional data only. */

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

const SUPER = "00000000-0000-4000-8000-000000000001";
const OWNER = "00000000-0000-4000-8000-000000000011";
const TENANT = "10000000-0000-4000-8000-00000000000a";
const AGENT = "20000000-0000-4000-8000-0000000000a1";

let client: PGlite;
let db: ReturnType<typeof drizzle>;
const ctxFor = async (userId: string): Promise<Ctx> => ({
  db,
  actor: await loadActor(db, { userId, mfa: true }),
});

beforeAll(async () => {
  client = new PGlite();
  db = drizzle(client);
  await client.exec(STANDIN);
  for (const [id, email] of [
    [SUPER, "super@wyrm.example"],
    [OWNER, "owner@dental-a.example"],
  ])
    await client.query("insert into auth.users (id, email) values ($1, $2)", [id, email]);
  await client.exec(migration("0001_portal_foundations.sql"));
  await client.exec(migration("0002_api_grants.sql"));
  await client.query("insert into wyrm_admins (user_id) values ($1)", [SUPER]);
  for (const m of [
    "0003_two_tier_users.sql",
    "0004_agent_operations.sql",
    "0005_agent_policies.sql",
    "0006_agent_test_gate.sql",
    "0007_onboarding.sql",
    "0008_knowledge.sql",
    "0009_connections.sql",
    "0010_sales.sql",
  ])
    await client.exec(migration(m));
  await client.query(
    "insert into tenants (id, name, slug, agent_limit) values ($1, 'Fictional Dental A', 'dental-a', 3)",
    [TENANT],
  );
  const owner = (
    await client.query<{ id: string }>(
      "select id from roles where key = 'owner' and tenant_id is null",
    )
  ).rows[0]?.id;
  await client.query(
    "insert into tenant_users (tenant_id, user_id, email, role_id) values ($1, $2, 'owner@dental-a.example', $3)",
    [TENANT, OWNER, owner],
  );
  await client.query(
    "insert into agents (id, tenant_id, name, type, status) values ($1, $2, 'Front desk', 'receptionist', 'draft')",
    [AGENT, TENANT],
  );
});

describe("setup tracker and go-live gate", () => {
  it("starts with everything required missing, and blocks going live", async () => {
    const owner = await ctxFor(OWNER);
    const s = await setupStatus(owner, TENANT, AGENT);
    expect(s.missing.map((i) => i.key)).toEqual([
      "facts",
      "handoff",
      "procedure",
      "tests",
      "published",
      "practice",
    ]);
    expect(s.readyToLaunch).toBe(false);
    await expect(
      setAgentStatus(owner, { tenantId: TENANT, agentId: AGENT, status: "live" }),
    ).rejects.toThrow(/Before going live/);
    // Wyrm staff can't skip the checklist either: no sign-off and no switching on.
    const staff = await ctxFor(SUPER);
    await expect(
      signOffLaunch(staff, { tenantId: TENANT, agentId: AGENT, note: "Looks fine" }),
    ).rejects.toThrow(/Can't sign off yet/);
    await expect(
      setAgentStatus(staff, { tenantId: TENANT, agentId: AGENT, status: "live" }),
    ).rejects.toThrow(/Before going live/);
  });

  it("ticks items off as the owner sets up, and still needs Wyrm's sign-off", async () => {
    const owner = await ctxFor(OWNER);
    await saveProfile(
      owner,
      TENANT,
      {
        hours: { mon: { open: "09:00", close: "17:00" } },
        services: [{ name: "Check-up", price: "65 EUR" }],
      },
      "Facts",
      AGENT,
    );
    await saveLimits(owner, {
      tenantId: TENANT,
      agentId: AGENT,
      limits: { handoffContact: "Reception" },
      note: "Handoff",
    });
    await addProcedure(owner, {
      tenantId: TENANT,
      agentId: AGENT,
      template: "message",
      note: "Messages",
    });
    await publishPolicy(owner, { tenantId: TENANT, agentId: AGENT, note: "First version" });
    // Simulate a passing test run and three practice chats.
    await client.query(
      "insert into agent_test_batches (tenant_id, agent_id, target, total, passed, required_failed) values ($1, $2, 'draft', 2, 2, 0)",
      [TENANT, AGENT],
    );
    for (let i = 0; i < 3; i++)
      await client.query(
        "insert into conversations (tenant_id, agent_id, channel, flags) values ($1, $2, 'web_chat', '{test}')",
        [TENANT, AGENT],
      );
    const s = await setupStatus(owner, TENANT, AGENT);
    expect(s.missing).toEqual([]);
    expect(s.signedOff).toBe(false);
    await expect(
      setAgentStatus(owner, { tenantId: TENANT, agentId: AGENT, status: "live" }),
    ).rejects.toThrow(/Wyrm sign-off/);
  });

  it("lets only Wyrm staff sign off; then the owner can go live, pause and resume", async () => {
    const owner = await ctxFor(OWNER);
    await expect(
      signOffLaunch(owner, { tenantId: TENANT, agentId: AGENT, note: "self" }),
    ).rejects.toThrow(ForbiddenError);
    await signOffLaunch(await ctxFor(SUPER), {
      tenantId: TENANT,
      agentId: AGENT,
      note: "Reviewed facts and tests",
    });
    await setAgentStatus(owner, { tenantId: TENANT, agentId: AGENT, status: "live" });
    await setAgentStatus(owner, { tenantId: TENANT, agentId: AGENT, status: "paused" });
    await setAgentStatus(owner, { tenantId: TENANT, agentId: AGENT, status: "live" });
    const s = await setupStatus(owner, TENANT, AGENT);
    expect(s.status).toBe("live");
    expect(s.recommended.find((i) => i.key === "signoff")?.done).toBe(true);
  });
});

describe("website widget", () => {
  it("keeps only valid https sites and checks where it may show", async () => {
    expect(
      cleanOrigins(
        "brightsmile.example, https://www.brightsmile.example/, http://insecure.example, javascript:alert(1)",
      ),
    ).toEqual(["https://brightsmile.example", "https://www.brightsmile.example"]);
    const saved = await saveChannel(await ctxFor(OWNER), {
      tenantId: TENANT,
      agentId: AGENT,
      enabled: true,
      origins: "brightsmile.example",
      color: "#123456",
      label: "Ask us",
    });
    expect(widgetAllowed(saved, "https://brightsmile.example")).toBe(true);
    expect(widgetAllowed(saved, "https://evil.example")).toBe(false);
    expect(widgetAllowed({ ...saved, widgetEnabled: false }, "https://brightsmile.example")).toBe(
      false,
    );
    expect(widgetAllowed({ ...saved, widgetOrigins: [] }, "https://anywhere.example")).toBe(true);
  });
});

describe("facts from the website", () => {
  it("adds only the parts the owner chooses, on top of existing facts", async () => {
    const owner = await ctxFor(OWNER);
    const suggestion = await createSuggestion(owner, {
      tenantId: TENANT,
      agentId: AGENT,
      sourceUrl: "https://brightsmile.example",
      pagesRead: 3,
      draft: {
        summary: "Family dental practice.",
        hours: { sat: { open: "09:00", close: "13:00" } },
        services: [{ name: "Whitening", price: "250 EUR" }],
        faqs: [{ question: "Parking?", answer: "Behind the building." }],
      },
    });
    await applySuggestion(owner, {
      tenantId: TENANT,
      agentId: AGENT,
      suggestionId: suggestion?.id ?? "",
      parts: ["services", "faqs"],
    });
    const { policy, changes } = await getStudio(owner, TENANT, AGENT);
    expect(policy.profile.services?.map((x) => x.name)).toEqual(["Check-up", "Whitening"]);
    expect(policy.profile.faqs?.length).toBe(1);
    expect(policy.profile.hours?.mon).toEqual({ open: "09:00", close: "17:00" }); // hours untouched
    expect(changes[0]?.note).toContain("Imported from https://brightsmile.example");
    await expect(
      applySuggestion(owner, {
        tenantId: TENANT,
        agentId: AGENT,
        suggestionId: suggestion?.id ?? "",
        parts: ["hours"],
      }),
    ).rejects.toThrow(/not found/i);
  });
});

describe("sales agent", () => {
  it("starts with a qualify step, example questions and tests, and needs its offer before launch", async () => {
    const staff = await ctxFor(SUPER);
    const agent = await provisionAgent(staff, { tenantId: TENANT, name: "Sales", type: "sales" });
    const agentId = agent?.id ?? "";
    const owner = await ctxFor(OWNER);
    const { policy } = await getStudio(owner, TENANT, agentId);
    expect(policy.procedures.map((p) => p.template)).toEqual(["qualify"]);
    expect(policy.sales?.questions.length).toBe(2);
    expect(policy.procedures[0]?.requiredInfo.map((f) => f.key)).toContain("q_budget");
    const tests = await client.query<{ template: string }>(
      "select template from agent_tests where agent_id = $1 order by template",
      [agentId],
    );
    expect(tests.rows.map((r) => r.template)).toEqual(["qualify", "safety"]);

    let s = await setupStatus(owner, TENANT, agentId);
    expect(s.missing.map((i) => i.key)).toContain("sales_offer");
    expect(s.missing.map((i) => i.key)).not.toContain("facts");

    await saveSales(owner, {
      tenantId: TENANT,
      agentId,
      setup: { ...policy.sales, offer: "Whitening packages.", idealCustomer: "Adults nearby." },
      note: "Our offer",
    });
    s = await setupStatus(owner, TENANT, agentId);
    expect(s.missing.map((i) => i.key)).not.toContain("sales_offer");
    expect(await listLeads(owner, TENANT, { agentId })).toEqual([]);
    await expect(
      setLeadStatus(owner, {
        tenantId: TENANT,
        leadId: "30000000-0000-4000-8000-000000000001",
        status: "won",
      }),
    ).rejects.toThrow(/not found/i);
  });
});
