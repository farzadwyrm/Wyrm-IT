import { readFileSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

/**
 * Runs every migration, in order, in an in-memory Postgres with a stand-in for Supabase's
 * `auth` schema, exactly as the live project was upgraded (0001 → 0002 → 0003). Then proves
 * the two-tier rules: tenant isolation, platform access, identity separation, one owner,
 * seat and agent limits, suspended tenants, and that signed-in users cannot write.
 */

const migration = (name: string) =>
  readFileSync(new URL(`../migrations/${name}`, import.meta.url), "utf8");

const SUPABASE_STANDIN = `
create schema auth;
create table auth.users (id uuid primary key, email text);
create function auth.uid() returns uuid language sql stable as $$
  select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
$$;
create role anon;
create role authenticated;
create role service_role;
grant usage on schema public, auth to anon, authenticated, service_role;
`;

// Fictional people only.
const id = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const SUPER = id(1);
const SUPPORT = id(2);
const OWNER_A = id(11);
const ADMIN_A = id(12);
const MEMBER_A = id(13);
const OWNER_B = id(21);
const NEWBIE = id(31);
const TENANT_A = "10000000-0000-4000-8000-00000000000a";
const TENANT_B = "10000000-0000-4000-8000-00000000000b";

let db: PGlite;
const rows = async (sql: string, params: unknown[] = []) =>
  (await db.query<Record<string, unknown>>(sql, params)).rows;

/** Runs queries as a signed-in user (or signed out with null), like Supabase does. */
async function as<T>(userId: string | null, run: () => Promise<T>): Promise<T> {
  await db.exec(userId ? "set role authenticated" : "set role anon");
  await db.query("select set_config('request.jwt.claim.sub', $1, false)", [userId ?? ""]);
  try {
    return await run();
  } finally {
    await db.exec("reset role");
    await db.query("select set_config('request.jwt.claim.sub', '', false)");
  }
}

const roleId = async (key: string) =>
  (await rows("select id from roles where key = $1 and tenant_id is null", [key]))[0]?.id as string;

async function addStaff(tenant: string, user: string, email: string, role: string) {
  return db.query(
    "insert into tenant_users (tenant_id, user_id, email, role_id) values ($1, $2, $3, $4) returning id",
    [tenant, user, email, await roleId(role)],
  );
}

beforeAll(async () => {
  db = new PGlite();
  await db.exec(SUPABASE_STANDIN);
  const people: [string, string][] = [
    [SUPER, "super@wyrm.example"],
    [SUPPORT, "support@wyrm.example"],
    [OWNER_A, "owner@dental-a.example"],
    [ADMIN_A, "admin@dental-a.example"],
    [MEMBER_A, "member@dental-a.example"],
    [OWNER_B, "owner@salon-b.example"],
    [NEWBIE, "new@dental-a.example"],
  ];
  for (const [uid, email] of people) {
    await db.query("insert into auth.users (id, email) values ($1, $2)", [uid, email]);
  }
  // The live project as it was before v2: 0001 + 0002 with one Wyrm admin.
  await db.exec(migration("0001_portal_foundations.sql"));
  await db.exec(migration("0002_api_grants.sql"));
  await db.query("insert into wyrm_admins (user_id) values ($1)", [SUPER]);
  await db.exec(migration("0003_two_tier_users.sql"));

  // Seed as the server (database owner).
  await db.query(
    "insert into platform_users (id, email, platform_role) values ($1, 'support@wyrm.example', 'support')",
    [SUPPORT],
  );
  await db.query(
    "insert into tenants (id, name, slug, seat_limit, agent_limit) values ($1, 'Fictional Dental A', 'dental-a', 4, 2), ($2, 'Fictional Salon B', 'salon-b', 5, 1)",
    [TENANT_A, TENANT_B],
  );
  await addStaff(TENANT_A, OWNER_A, "owner@dental-a.example", "owner");
  await addStaff(TENANT_A, ADMIN_A, "admin@dental-a.example", "admin");
  await addStaff(TENANT_A, MEMBER_A, "member@dental-a.example", "member");
  await addStaff(TENANT_B, OWNER_B, "owner@salon-b.example", "owner");
  await db.query(
    "insert into agents (tenant_id, name, type) values ($1, 'Front desk', 'receptionist'), ($1, 'Inbox', 'inbox'), ($2, 'Salon phone', 'receptionist')",
    [TENANT_A, TENANT_B],
  );
});

afterAll(async () => {
  await db.close();
});

describe("upgrade from P0", () => {
  it("turns existing Wyrm admins into super admins and removes the old tables", async () => {
    expect(await rows("select platform_role from platform_users where id = $1", [SUPER])).toEqual([
      { platform_role: "super_admin" },
    ]);
    expect(await rows("select to_regclass('public.organizations') as t")).toEqual([{ t: null }]);
  });
});

describe("tenant isolation", () => {
  it("shows each tenant only its own organisation, staff and agents", async () => {
    await as(OWNER_A, async () => {
      expect(await rows("select slug from tenants")).toEqual([{ slug: "dental-a" }]);
      expect(await rows("select count(*)::int as n from tenant_users")).toEqual([{ n: 3 }]);
      expect(await rows("select count(*)::int as n from agents")).toEqual([{ n: 2 }]);
    });
    await as(OWNER_B, async () => {
      expect(await rows("select slug from tenants")).toEqual([{ slug: "salon-b" }]);
      expect(await rows("select email from tenant_users")).toEqual([
        { email: "owner@salon-b.example" },
      ]);
    });
  });

  it("returns nothing for another tenant even when its ids are known", async () => {
    await as(OWNER_B, async () => {
      expect(await rows("select * from tenants where id = $1", [TENANT_A])).toEqual([]);
      expect(await rows("select * from agents where tenant_id = $1", [TENANT_A])).toEqual([]);
    });
  });

  it("shows members only the agents granted to them", async () => {
    await as(MEMBER_A, async () => {
      expect(await rows("select * from agents")).toEqual([]);
      expect(await rows("select email from tenant_users")).toEqual([
        { email: "member@dental-a.example" },
      ]);
    });
    const [member] = await rows("select id from tenant_users where user_id = $1", [MEMBER_A]);
    const [agent] = await rows("select id from agents where name = 'Front desk'");
    await db.query(
      "insert into agent_access (agent_id, tenant_id, subject_type, subject_id, level) values ($1, $2, 'user', $3, 'use')",
      [agent?.id, TENANT_A, member?.id],
    );
    await as(MEMBER_A, async () => {
      expect(await rows("select name from agents")).toEqual([{ name: "Front desk" }]);
    });
  });

  it("gives signed-out visitors no access at all", async () => {
    await as(null, async () => {
      for (const table of ["tenants", "tenant_users", "agents", "platform_users", "audit_logs"]) {
        await expect(db.query(`select * from ${table}`)).rejects.toThrow(/permission denied/);
      }
    });
  });

  it("never lets signed-in users write directly (the server does all writes)", async () => {
    await as(OWNER_A, async () => {
      await expect(
        db.query("update tenants set seat_limit = 999 where id = $1", [TENANT_A]),
      ).rejects.toThrow(/permission denied/);
      await expect(
        db.query("insert into agents (tenant_id, name, type) values ($1, 'X agent', 'inbox')", [
          TENANT_A,
        ]),
      ).rejects.toThrow(/permission denied/);
      await expect(db.query("truncate audit_logs")).rejects.toThrow(/permission denied/);
    });
  });
});

describe("platform level", () => {
  it("lets Wyrm staff see every tenant", async () => {
    await as(SUPPORT, async () => {
      expect(await rows("select count(*)::int as n from tenants")).toEqual([{ n: 2 }]);
      expect(await rows("select count(*)::int as n from agents")).toEqual([{ n: 3 }]);
    });
  });

  it("hides the Wyrm staff list from customers", async () => {
    await as(OWNER_A, async () => {
      expect(await rows("select * from platform_users")).toEqual([]);
    });
  });

  it("keeps Wyrm staff and customer staff separate", async () => {
    await expect(addStaff(TENANT_A, SUPPORT, "support@wyrm.example", "member")).rejects.toThrow(
      /identity_separation/,
    );
    await expect(
      db.query(
        "insert into platform_users (id, email, platform_role) values ($1, 'owner@dental-a.example', 'support')",
        [OWNER_A],
      ),
    ).rejects.toThrow(/identity_separation/);
  });
});

describe("hard rules", () => {
  it("allows exactly one owner, who can't be deactivated or removed", async () => {
    await expect(
      db.query("update tenant_users set role_id = $1 where user_id = $2", [
        await roleId("owner"),
        ADMIN_A,
      ]),
    ).rejects.toThrow(/duplicate key|tenant_users_one_owner/);
    await expect(
      db.query("update tenant_users set status = 'deactivated' where user_id = $1", [OWNER_A]),
    ).rejects.toThrow(/owner_required/);
    await expect(
      db.query("delete from tenant_users where user_id = $1", [OWNER_A]),
    ).rejects.toThrow(/owner_required/);
  });

  it("blocks new invitations and staff beyond the seat limit", async () => {
    // Tenant A: 4 seats, 3 staff in use.
    await db.query(
      "insert into invitations (tenant_id, email, role_id, token_hash) values ($1, 'one@dental-a.example', $2, 'hash-1')",
      [TENANT_A, await roleId("member")],
    );
    await expect(
      db.query(
        "insert into invitations (tenant_id, email, role_id, token_hash) values ($1, 'two@dental-a.example', $2, 'hash-2')",
        [TENANT_A, await roleId("member")],
      ),
    ).rejects.toThrow(/seat_limit/);
    await expect(addStaff(TENANT_A, NEWBIE, "new@dental-a.example", "member")).rejects.toThrow(
      /seat_limit/,
    );
  });

  it("lets an invited person take their reserved seat", async () => {
    await db.query(
      "update invitations set email = 'new@dental-a.example' where token_hash = 'hash-1'",
    );
    await addStaff(TENANT_A, NEWBIE, "new@dental-a.example", "member");
    await db.query("update invitations set status = 'accepted' where token_hash = 'hash-1'");
    expect(await rows("select public.seats_in_use($1) as n", [TENANT_A])).toEqual([{ n: 4 }]);
  });

  it("blocks agents beyond the agent limit", async () => {
    await expect(
      db.query("insert into agents (tenant_id, name, type) values ($1, 'Second', 'inbox')", [
        TENANT_B,
      ]),
    ).rejects.toThrow(/agent_limit/);
  });

  it("refuses links between tenants", async () => {
    const [agentB] = await rows("select id from agents where tenant_id = $1", [TENANT_B]);
    const [memberA] = await rows("select id from tenant_users where user_id = $1", [MEMBER_A]);
    await expect(
      db.query(
        "insert into agent_access (agent_id, tenant_id, subject_type, subject_id, level) values ($1, $2, 'user', $3, 'use')",
        [agentB?.id, TENANT_A, memberA?.id],
      ),
    ).rejects.toThrow(/tenant_mismatch/);
  });
});

describe("suspended tenants", () => {
  it("lock out their staff and pause their agents, keeping the data", async () => {
    await db.query("update agents set status = 'live' where tenant_id = $1", [TENANT_B]);
    await db.query("update tenants set status = 'suspended' where id = $1", [TENANT_B]);
    await as(OWNER_B, async () => {
      expect(await rows("select * from tenants")).toEqual([]);
      expect(await rows("select * from agents")).toEqual([]);
    });
    expect(await rows("select status from agents where tenant_id = $1", [TENANT_B])).toEqual([
      { status: "paused" },
    ]);
    await db.query("update tenants set status = 'active' where id = $1", [TENANT_B]);
  });
});

describe("audit", () => {
  it("shows tenant owners their log, including Wyrm view-as sessions, but not other tenants'", async () => {
    const [ownerA] = await rows("select id from tenant_users where user_id = $1", [OWNER_A]);
    await db.query(
      "insert into impersonation_sessions (platform_user_id, tenant_id, tenant_user_id, reason, read_only) values ($1, $2, $3, 'Checking a booking issue', true)",
      [SUPPORT, TENANT_A, ownerA?.id],
    );
    await db.query(
      "insert into audit_logs (tenant_id, actor_type, actor_id, action) values ($1, 'platform', $2, 'impersonation.started'), ($3, 'tenant', $4, 'staff.invited')",
      [TENANT_A, SUPPORT, TENANT_B, OWNER_B],
    );
    await as(OWNER_A, async () => {
      expect(await rows("select action from audit_logs")).toEqual([
        { action: "impersonation.started" },
      ]);
      expect(await rows("select reason from impersonation_sessions")).toEqual([
        { reason: "Checking a booking issue" },
      ]);
    });
    await as(MEMBER_A, async () => {
      expect(await rows("select * from audit_logs")).toEqual([]);
    });
  });
});
