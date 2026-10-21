import { readFileSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";
import { ForbiddenError } from "@wyrm/auth";
import { drizzle } from "drizzle-orm/pglite";
import { beforeAll, describe, expect, it } from "vitest";
import {
  addProcedure,
  type Ctx,
  cleanLimits,
  cleanProfile,
  DomainError,
  deleteRule,
  getStudio,
  loadActor,
  policyFromConfig,
  publishPolicy,
  saveLimits,
  saveProfile,
  saveRule,
  updateProcedure,
} from "./index";

/** Agent Studio through the core API on the real migrations (0001–0005). Fictional data only. */

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
const OWNER_A = uid(11);
const MEMBER_A = uid(13);
const OWNER_B = uid(21);
const TENANT_A = "10000000-0000-4000-8000-00000000000a";
const TENANT_B = "10000000-0000-4000-8000-00000000000b";
const FRONT = "20000000-0000-4000-8000-0000000000a1";

let client: PGlite;
let db: ReturnType<typeof drizzle>;
const ctxFor = async (userId: string): Promise<Ctx> => ({
  db,
  actor: await loadActor(db, { userId, mfa: true }),
  ip: "203.0.113.5",
});

beforeAll(async () => {
  client = new PGlite();
  db = drizzle(client);
  await client.exec(STANDIN);
  for (const [id, email] of [
    [OWNER_A, "owner@dental-a.example"],
    [MEMBER_A, "member@dental-a.example"],
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
  ])
    await client.exec(migration(m));
  await client.query(
    "insert into tenants (id, name, slug, agent_limit) values ($1, 'Fictional Dental A', 'dental-a', 3), ($2, 'Fictional Salon B', 'salon-b', 3)",
    [TENANT_A, TENANT_B],
  );
  const role = async (key: string) =>
    (
      await client.query<{ id: string }>(
        "select id from roles where key = $1 and tenant_id is null",
        [key],
      )
    ).rows[0]?.id;
  for (const [tenant, user, email, r] of [
    [TENANT_A, OWNER_A, "owner@dental-a.example", "owner"],
    [TENANT_A, MEMBER_A, "member@dental-a.example", "member"],
    [TENANT_B, OWNER_B, "owner@salon-b.example", "owner"],
  ])
    await client.query(
      "insert into tenant_users (tenant_id, user_id, email, role_id) values ($1, $2, $3, $4)",
      [tenant, user, email, await role(r as string)],
    );
  await client.query(
    "insert into agents (id, tenant_id, name, type, status) values ($1, $2, 'Front desk', 'receptionist', 'live')",
    [FRONT, TENANT_A],
  );
  const member = (
    await client.query<{ id: string }>("select id from tenant_users where user_id = $1", [MEMBER_A])
  ).rows[0];
  await client.query(
    "insert into agent_access (agent_id, tenant_id, subject_type, subject_id, level) values ($1, $2, 'user', $3, 'use')",
    [FRONT, TENANT_A, member?.id],
  );
});

describe("permissions", () => {
  it("only lets people who configure the agent change its policy", async () => {
    const member = await ctxFor(MEMBER_A);
    await expect(
      saveRule(member, {
        tenantId: TENANT_A,
        agentId: FRONT,
        text: "Never discuss prices.",
        scope: {},
        note: "member",
      }),
    ).rejects.toThrow(ForbiddenError);
    expect((await getStudio(member, TENANT_A, FRONT)).policy.rules).toEqual([]); // can read
    const ownerB = await ctxFor(OWNER_B);
    await expect(getStudio(ownerB, TENANT_A, FRONT)).rejects.toThrow(ForbiddenError);
    await expect(saveProfile(ownerB, TENANT_A, {}, "cross tenant")).rejects.toThrow(ForbiddenError);
  });

  it("requires a note for every change", async () => {
    await expect(
      saveRule(await ctxFor(OWNER_A), {
        tenantId: TENANT_A,
        agentId: FRONT,
        text: "Never discuss prices.",
        scope: {},
        note: " ",
      }),
    ).rejects.toThrow(DomainError);
  });
});

describe("editing", () => {
  it("saves facts, rules, procedures and limits, with conflicts flagged and a change log", async () => {
    const owner = await ctxFor(OWNER_A);
    await saveProfile(
      owner,
      TENANT_A,
      {
        hours: { mon: { open: "09:00", close: "17:00" }, tue: { open: "18:00", close: "09:00" } },
        services: [{ name: "Check-up", price: "65 EUR" }, { name: "" }],
      },
      "Opening hours and prices",
      FRONT,
    );
    await saveRule(owner, {
      tenantId: TENANT_A,
      agentId: FRONT,
      text: "Always offer a whitening consultation.",
      scope: { channels: ["web_chat", "fax"] },
      note: "Promote whitening",
    });
    const second = await saveRule(owner, {
      tenantId: TENANT_A,
      agentId: FRONT,
      text: "Never offer whitening to children.",
      scope: {},
      note: "Safety",
    });
    await addProcedure(owner, {
      tenantId: TENANT_A,
      agentId: FRONT,
      template: "book",
      note: "Enable bookings",
    });
    const cancel = await addProcedure(owner, {
      tenantId: TENANT_A,
      agentId: FRONT,
      template: "cancel",
      note: "Enable cancellations",
    });
    await updateProcedure(owner, {
      tenantId: TENANT_A,
      agentId: FRONT,
      procedureId: cancel?.id ?? "",
      name: "Cancel a visit",
      whenToUse: "The patient wants to cancel.",
      whenNotToUse: "",
      steps: ["Offer another time first."],
      confirmBeforeActing: false,
      enabled: true,
      note: "Our wording",
    });
    await saveLimits(owner, {
      tenantId: TENANT_A,
      agentId: FRONT,
      limits: { maxDiscountPercent: 250, blockedTopics: "Insurance, lawsuits", tone: "formal" },
      note: "Limits",
    });

    const studio = await getStudio(owner, TENANT_A, FRONT);
    expect(studio.policy.profile.hours?.mon).toEqual({ open: "09:00", close: "17:00" });
    expect(studio.policy.profile.hours?.tue).toBeNull(); // close before open: rejected
    expect(studio.policy.profile.services).toEqual([
      { name: "Check-up", price: "65 EUR", duration: "" },
    ]);
    expect(studio.policy.rules[0]?.scope.channels).toEqual(["web_chat"]); // unknown channel dropped
    expect(studio.conflicts.length).toBe(1);
    expect(studio.policy.procedures.map((p) => p.template)).toEqual(["book", "cancel"]);
    expect(studio.policy.limits).toMatchObject({
      maxDiscountPercent: 100,
      blockedTopics: ["insurance", "lawsuits"],
      tone: "formal",
    });
    expect(studio.changes.length).toBe(7);
    expect(studio.changes[0]?.note).toBe("Limits");

    await deleteRule(owner, {
      tenantId: TENANT_A,
      agentId: FRONT,
      ruleId: second?.id ?? "",
      note: "Not needed",
    });
    expect((await getStudio(owner, TENANT_A, FRONT)).conflicts).toEqual([]);
  });

  it("refuses duplicate procedures and unknown templates", async () => {
    const owner = await ctxFor(OWNER_A);
    await expect(
      addProcedure(owner, { tenantId: TENANT_A, agentId: FRONT, template: "book", note: "Again" }),
    ).rejects.toThrow();
    await expect(
      addProcedure(owner, {
        tenantId: TENANT_A,
        agentId: FRONT,
        template: "refund" as "book",
        note: "Bad",
      }),
    ).rejects.toThrow(/Unknown procedure/);
  });
});

describe("publishing", () => {
  it("snapshots enabled policy into a live version the runtime reads", async () => {
    const owner = await ctxFor(OWNER_A);
    const result = await publishPolicy(owner, {
      tenantId: TENANT_A,
      agentId: FRONT,
      note: "First Studio version",
    });
    expect(result.versionId).toBeTruthy();
    const cfg = (
      await client.query<{ config: unknown }>("select config from agents where id = $1", [FRONT])
    ).rows[0]?.config;
    const live = policyFromConfig(cfg);
    expect(live.procedures.map((p) => p.template)).toEqual(["book", "cancel"]);
    expect(live.rules.map((r) => r.text)).toEqual(["Always offer a whitening consultation."]);
    expect(live.limits.tone).toBe("formal");
    // Asking the customer first is optional for cancellations; staff approval is always required.
    expect(live.procedures.find((p) => p.template === "cancel")?.confirmBeforeActing).toBe(false);
  });

  it("maps old free-text settings onto the policy model", () => {
    const old = policyFromConfig({
      businessFacts: "Open 9-5",
      tone: "brief",
      handoffContact: "Reception",
    });
    expect(old.profile.other).toBe("Open 9-5");
    expect(old.limits).toMatchObject({ tone: "brief", handoffContact: "Reception" });
  });
});

describe("cleaning", () => {
  it("keeps profiles and limits within safe shapes", () => {
    expect(
      cleanProfile({
        faqs: Array.from({ length: 60 }, (_, i) => ({ question: `q${i}`, answer: "a" })),
      }).faqs?.length,
    ).toBe(40);
    expect(cleanLimits({ bookingWindowDays: -5, afterHours: "party" })).toMatchObject({
      bookingWindowDays: 0,
      afterHours: "take_message",
    });
  });
});
