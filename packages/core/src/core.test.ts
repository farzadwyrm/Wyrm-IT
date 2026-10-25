import { readFileSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";
import { ForbiddenError } from "@wyrm/auth";
import { tenantUsers } from "@wyrm/db";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/pglite";
import { beforeAll, describe, expect, it } from "vitest";
import {
  acceptInvitation,
  type Ctx,
  changeRole,
  createTenant,
  DomainError,
  deleteTenant,
  grantAgentAccess,
  inviteStaff,
  listAgents,
  listAudit,
  listRoles,
  listStaff,
  loadActor,
  provisionAgent,
  setStaffStatus,
  setTenantStatus,
  startViewAs,
  translateDbError,
  updateSecurity,
} from "./index";

/**
 * The required acceptance tests, run against the real migrations in an in-memory Postgres.
 * Fictional people and organisations only.
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
  support: { id: uid(2), email: "support@wyrm.example" },
  ownerA: { id: uid(11), email: "owner@dental-a.example" },
  adminA: { id: uid(12), email: "admin@dental-a.example" },
  memberA: { id: uid(13), email: "member@dental-a.example" },
  extraA: { id: uid(14), email: "extra@dental-a.example" },
  ownerB: { id: uid(21), email: "owner@salon-b.example" },
};

let client: PGlite;
let db: ReturnType<typeof drizzle>;
let tenantA = "";
let tenantB = "";

async function ctxFor(person: { id: string }, tenantId?: string): Promise<Ctx> {
  return {
    db,
    actor: await loadActor(db, { userId: person.id, mfa: true, tenantId: tenantId ?? null }),
    ip: "203.0.113.7",
  };
}

async function join(token: string, person: { id: string; email: string }) {
  return acceptInvitation({ db, actor: null }, { token, userId: person.id, email: person.email });
}

const roleId = async (key: string) => {
  const rows = await client.query<{ id: string }>(
    "select id from roles where key = $1 and tenant_id is null",
    [key],
  );
  return rows.rows[0]?.id ?? "";
};

beforeAll(async () => {
  client = new PGlite();
  db = drizzle(client);
  await client.exec(STANDIN);
  for (const p of Object.values(people)) {
    await client.query("insert into auth.users (id, email) values ($1, $2)", [p.id, p.email]);
  }
  await client.exec(migration("0001_portal_foundations.sql"));
  await client.exec(migration("0002_api_grants.sql"));
  await client.query("insert into wyrm_admins (user_id) values ($1)", [people.super.id]);
  await client.exec(migration("0003_two_tier_users.sql"));
  await client.exec(migration("0004_agent_operations.sql"));
  await client.exec(migration("0005_agent_policies.sql"));
  await client.exec(migration("0006_agent_test_gate.sql"));
  await client.exec(migration("0007_onboarding.sql"));
  await client.exec(migration("0008_knowledge.sql"));
  await client.exec(migration("0009_connections.sql"));
  await client.exec(migration("0010_sales.sql"));
  await client.query(
    "insert into platform_users (id, email, platform_role) values ($1, $2, 'support')",
    [people.support.id, people.support.email],
  );

  // Super Admin creates two tenants; their owners accept.
  const sup = await ctxFor(people.super);
  const a = await createTenant(sup, {
    name: "Fictional Dental A",
    slug: "dental-a",
    ownerEmail: people.ownerA.email,
    seatLimit: 4,
    agentLimit: 2,
  });
  const b = await createTenant(sup, {
    name: "Fictional Salon B",
    slug: "salon-b",
    ownerEmail: people.ownerB.email,
  });
  tenantA = a.tenant.id;
  tenantB = b.tenant.id;
  await join(a.token, people.ownerA);
  await join(b.token, people.ownerB);

  const ownerA = await ctxFor(people.ownerA);
  const inviteAdmin = await inviteStaff(ownerA, {
    tenantId: tenantA,
    email: people.adminA.email,
    roleId: await roleId("admin"),
  });
  await join(inviteAdmin.token, people.adminA);
  const inviteMember = await inviteStaff(ownerA, {
    tenantId: tenantA,
    email: people.memberA.email,
    roleId: await roleId("member"),
  });
  await join(inviteMember.token, people.memberA);
  await provisionAgent(sup, { tenantId: tenantA, name: "Front desk", type: "receptionist" });
  await provisionAgent(sup, { tenantId: tenantB, name: "Salon phone", type: "receptionist" });
});

describe("1. tenant isolation through the API", () => {
  it("refuses to read another tenant's staff or agents", async () => {
    const ownerB = await ctxFor(people.ownerB);
    await expect(listStaff(ownerB, tenantA)).rejects.toThrow(ForbiddenError);
    await expect(listAgents(ownerB, tenantA)).rejects.toThrow(ForbiddenError);
    expect((await listStaff(ownerB, tenantB)).map((s) => s.email)).toEqual([people.ownerB.email]);
  });

  it("refuses to modify another tenant's data, even with real ids", async () => {
    const ownerB = await ctxFor(people.ownerB);
    const [memberA] = await db
      .select()
      .from(tenantUsers)
      .where(eq(tenantUsers.email, people.memberA.email));
    await expect(
      setStaffStatus(ownerB, {
        tenantId: tenantA,
        tenantUserId: memberA?.id ?? "",
        status: "deactivated",
      }),
    ).rejects.toThrow(/other_tenant/);
    await expect(
      changeRole(ownerB, {
        tenantId: tenantB,
        tenantUserId: memberA?.id ?? "",
        roleId: await roleId("viewer"),
      }),
    ).rejects.toThrow(/not found/i);
    await expect(updateSecurity(ownerB, tenantA, { require_mfa: true })).rejects.toThrow(
      /other_tenant/,
    );
  });
});

describe("2. no role escalation", () => {
  it("lets an admin invite or promote up to admin, never owner", async () => {
    const adminA = await ctxFor(people.adminA);
    await expect(
      inviteStaff(adminA, {
        tenantId: tenantA,
        email: "boss@dental-a.example",
        roleId: await roleId("owner"),
      }),
    ).rejects.toThrow(/use_ownership_transfer/);
    const [memberA] = await db
      .select()
      .from(tenantUsers)
      .where(eq(tenantUsers.email, people.memberA.email));
    await changeRole(adminA, {
      tenantId: tenantA,
      tenantUserId: memberA?.id ?? "",
      roleId: await roleId("manager"),
    });
    await changeRole(adminA, {
      tenantId: tenantA,
      tenantUserId: memberA?.id ?? "",
      roleId: await roleId("member"),
    });
  });

  it("stops members granting anything and admins changing the owner or themselves", async () => {
    const memberA = await ctxFor(people.memberA);
    await expect(
      inviteStaff(memberA, {
        tenantId: tenantA,
        email: "x@dental-a.example",
        roleId: await roleId("viewer"),
      }),
    ).rejects.toThrow(ForbiddenError);
    const adminA = await ctxFor(people.adminA);
    const [owner] = await db
      .select()
      .from(tenantUsers)
      .where(eq(tenantUsers.email, people.ownerA.email));
    const [self] = await db
      .select()
      .from(tenantUsers)
      .where(eq(tenantUsers.email, people.adminA.email));
    await expect(
      changeRole(adminA, {
        tenantId: tenantA,
        tenantUserId: owner?.id ?? "",
        roleId: await roleId("member"),
      }),
    ).rejects.toThrow(/target_outranks_you/);
    await expect(
      changeRole(adminA, {
        tenantId: tenantA,
        tenantUserId: self?.id ?? "",
        roleId: await roleId("member"),
      }),
    ).rejects.toThrow(/cannot_change_own_role/);
    await expect(
      setStaffStatus(adminA, {
        tenantId: tenantA,
        tenantUserId: owner?.id ?? "",
        status: "deactivated",
      }),
    ).rejects.toThrow(/owner_protected/);
  });
});

describe("3. seat limit", () => {
  it("blocks new invitations when seats are full", async () => {
    // Tenant A: 4 seats; owner, admin, member = 3; one pending invitation fills the last seat.
    const ownerA = await ctxFor(people.ownerA);
    await inviteStaff(ownerA, {
      tenantId: tenantA,
      email: people.extraA.email,
      roleId: await roleId("viewer"),
    });
    const full = inviteStaff(ownerA, {
      tenantId: tenantA,
      email: "fifth@dental-a.example",
      roleId: await roleId("viewer"),
    });
    await expect(full).rejects.toThrow(DomainError);
    await expect(full).rejects.toThrow(/no free seats/);
  });
});

describe("4. suspended tenants", () => {
  it("lock out every member and pause agents", async () => {
    const sup = await ctxFor(people.super);
    await client.query("update agents set status = 'live' where tenant_id = $1", [tenantB]);
    await setTenantStatus(sup, tenantB, "suspended");
    expect(await loadActor(db, { userId: people.ownerB.id, mfa: false })).toBeNull();
    const agents = await client.query<{ status: string }>(
      "select status from agents where tenant_id = $1",
      [tenantB],
    );
    expect(agents.rows).toEqual([{ status: "paused" }]);
    await setTenantStatus(sup, tenantB, "active");
    expect(await loadActor(db, { userId: people.ownerB.id, mfa: false })).not.toBeNull();
  });

  it("can only be suspended by Wyrm staff with that permission", async () => {
    await expect(
      setTenantStatus(await ctxFor(people.ownerA), tenantA, "suspended"),
    ).rejects.toThrow(ForbiddenError);
    await expect(
      setTenantStatus(await ctxFor(people.support), tenantA, "suspended"),
    ).rejects.toThrow(/missing_permission/);
  });

  it("are deleted only by a Super Admin, only once suspended, with the short name typed", async () => {
    const sup = await ctxFor(people.super);
    const { tenant } = await createTenant(sup, {
      name: "Fictional Closing Shop",
      slug: "closing-shop",
      plan: "pilot",
      seatLimit: 2,
      ownerEmail: "owner@closing-shop.example",
    });
    await expect(deleteTenant(sup, tenant.id, "closing-shop")).rejects.toThrow(
      /Suspend the client/,
    );
    await setTenantStatus(sup, tenant.id, "suspended");
    await expect(deleteTenant(sup, tenant.id, "closing")).rejects.toThrow(/short name/);
    await expect(
      deleteTenant(await ctxFor(people.support), tenant.id, "closing-shop"),
    ).rejects.toThrow(ForbiddenError);
    await deleteTenant(sup, tenant.id, "closing-shop");
    const left = await client.query("select 1 from tenants where id = $1", [tenant.id]);
    expect(left.rows).toEqual([]);
  });
});

describe("5. impersonation", () => {
  it("is logged and appears in the tenant's own audit log", async () => {
    const support = await ctxFor(people.support);
    const [memberA] = await db
      .select()
      .from(tenantUsers)
      .where(eq(tenantUsers.email, people.memberA.email));
    await expect(
      startViewAs(support, { tenantUserId: memberA?.id ?? "", reason: "" }),
    ).rejects.toThrow(/reason/);
    const session = await startViewAs(support, {
      tenantUserId: memberA?.id ?? "",
      reason: "Customer reported a missing agent",
    });
    expect(session?.readOnly).toBe(true);

    const viewing = {
      db,
      actor: await loadActor(db, {
        userId: people.support.id,
        mfa: true,
        viewAsSessionId: session?.id ?? null,
      }),
    };
    expect(viewing.actor?.kind).toBe("impersonating");
    await expect(
      inviteStaff(viewing, {
        tenantId: tenantA,
        email: "z@dental-a.example",
        roleId: await roleId("viewer"),
      }),
    ).rejects.toThrow(ForbiddenError);

    const log = await listAudit(db, { tenantId: tenantA });
    const entry = log.find((e) => e.action === "impersonation.started");
    expect(entry?.actorType).toBe("platform");
    expect(entry?.ip).toBe("203.0.113.7");
    expect((entry?.metadata as { after?: { reason?: string } } | undefined)?.after?.reason).toBe(
      "Customer reported a missing agent",
    );
  });
});

describe("other rules", () => {
  it("lists built-in roles plus the tenant's own", async () => {
    const roles = await listRoles(await ctxFor(people.ownerA), tenantA);
    expect(roles.map((r) => r.key)).toEqual(["owner", "admin", "manager", "member", "viewer"]);
  });

  it("enforces allowed email domains for invitations", async () => {
    const ownerB = await ctxFor(people.ownerB);
    await updateSecurity(ownerB, tenantB, { allowed_domains: ["salon-b.example"] });
    await expect(
      inviteStaff(ownerB, {
        tenantId: tenantB,
        email: "someone@gmail.example",
        roleId: await roleId("member"),
      }),
    ).rejects.toThrow(/Only salon-b.example/);
  });

  it("shows members only agents granted to them", async () => {
    const memberCtx = await ctxFor(people.memberA);
    expect(await listAgents(memberCtx)).toEqual([]);
    const owner = await ctxFor(people.ownerA);
    const [agent] = await listAgents(owner);
    const [memberA] = await db
      .select()
      .from(tenantUsers)
      .where(eq(tenantUsers.email, people.memberA.email));
    await grantAgentAccess(owner, {
      tenantId: tenantA,
      agentId: agent?.agent.id ?? "",
      subjectType: "user",
      subjectId: memberA?.id ?? "",
      level: "use",
    });
    expect((await listAgents(await ctxFor(people.memberA))).map((a) => a.agent.name)).toEqual([
      "Front desk",
    ]);
  });

  it("refuses invitations accepted by the wrong account", async () => {
    const ownerB = await ctxFor(people.ownerB);
    const { token } = await inviteStaff(ownerB, {
      tenantId: tenantB,
      email: "new@salon-b.example",
      roleId: await roleId("member"),
    });
    await expect(join(token, people.memberA)).rejects.toThrow(
      /This invitation is for new@salon-b.example/,
    );
  });
});

describe("database errors", () => {
  it("are translated from the database's message, never from the SQL text", () => {
    const wrapped = Object.assign(
      new Error('Failed query: insert into "tenants" ("seat_limit") values ($1)'),
      {
        cause: { message: 'null value in column "name" violates not-null constraint' },
      },
    );
    expect(() => translateDbError(wrapped)).toThrow(/Failed query/);
    const seat = Object.assign(new Error("Failed query: insert into invitations"), {
      cause: { message: "seat_limit" },
    });
    expect(() => translateDbError(seat)).toThrow(DomainError);
  });
});
