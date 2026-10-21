import { readFileSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

/**
 * Runs the real migration in an in-memory Postgres with a stand-in for Supabase's `auth`
 * schema, then proves the row-level security rules: each client sees only its own data.
 */

const migration = (name: string) =>
  readFileSync(new URL(`../migrations/${name}`, import.meta.url), "utf8");
const SQL = migration("0001_portal_foundations.sql");
const GRANTS = migration("0002_api_grants.sql");

const SUPABASE_STANDIN = `
create schema auth;
create table auth.users (id uuid primary key, email text);
create function auth.uid() returns uuid language sql stable as $$
  select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
$$;
create role anon;
create role authenticated;
create role service_role;
grant usage on schema public, auth to anon, authenticated;
`;

const ADMIN = "00000000-0000-4000-8000-00000000000a";
const OWNER_A = "00000000-0000-4000-8000-0000000000a1";
const STAFF_A = "00000000-0000-4000-8000-0000000000a2";
const NEW_STAFF = "00000000-0000-4000-8000-0000000000a3";
const OWNER_B = "00000000-0000-4000-8000-0000000000b1";
const ORG_A = "10000000-0000-4000-8000-00000000000a";
const ORG_B = "10000000-0000-4000-8000-00000000000b";
const AGENT_A = "20000000-0000-4000-8000-00000000000a";
const AGENT_B = "20000000-0000-4000-8000-00000000000b";

let db: PGlite;

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

const rows = async (sql: string, params: unknown[] = []) =>
  (await db.query<Record<string, unknown>>(sql, params)).rows;

const insertProfile = (agent: string, org: string) =>
  db.query("insert into profile_versions (agent_id, org_id, profile) values ($1, $2, $3)", [
    agent,
    org,
    { name: "new" },
  ]);

const RLS = /row-level security/;
/** Refused either by table privileges or by row-level security. */
const BLOCKED = /row-level security|permission denied/;

beforeAll(async () => {
  db = new PGlite();
  await db.exec(SUPABASE_STANDIN);
  await db.exec(SQL);
  await db.exec(GRANTS);
  // Seed as the database owner (like the server's secret key).
  await db.query("insert into auth.users (id) values ($1), ($2), ($3), ($4), ($5)", [
    ADMIN,
    OWNER_A,
    STAFF_A,
    NEW_STAFF,
    OWNER_B,
  ]);
  await db.query("insert into wyrm_admins (user_id) values ($1)", [ADMIN]);
  await db.query(
    "insert into organizations (id, name, slug) values ($1, 'Fictional Dental A', 'dental-a'), ($2, 'Fictional Salon B', 'salon-b')",
    [ORG_A, ORG_B],
  );
  await db.query(
    "insert into memberships (org_id, user_id, role) values ($1, $2, 'owner'), ($1, $3, 'staff'), ($4, $5, 'owner')",
    [ORG_A, OWNER_A, STAFF_A, ORG_B, OWNER_B],
  );
  await db.query(
    "insert into agents (id, org_id, type) values ($1, $2, 'receptionist'), ($3, $4, 'receptionist')",
    [AGENT_A, ORG_A, AGENT_B, ORG_B],
  );
  await db.query(
    "insert into profile_versions (agent_id, org_id, profile) values ($1, $2, $3), ($4, $5, $6)",
    [AGENT_A, ORG_A, { name: "A" }, AGENT_B, ORG_B, { name: "B" }],
  );
});

afterAll(async () => {
  await db.close();
});

describe("tenant isolation (row-level security)", () => {
  it("shows each client only its own organisation, agents and settings", async () => {
    await as(OWNER_A, async () => {
      expect(await rows("select slug from organizations")).toEqual([{ slug: "dental-a" }]);
      expect(await rows("select id from agents")).toEqual([{ id: AGENT_A }]);
      expect(await rows("select profile->>'name' as n from profile_versions")).toEqual([
        { n: "A" },
      ]);
    });
    await as(OWNER_B, async () => {
      expect(await rows("select slug from organizations")).toEqual([{ slug: "salon-b" }]);
    });
  });

  it("gives signed-out visitors no access at all", async () => {
    await as(null, async () => {
      for (const table of ["organizations", "profile_versions", "memberships", "wyrm_admins"]) {
        await expect(db.query(`select * from ${table}`)).rejects.toThrow(/permission denied/);
      }
    });
  });

  it("never lets signed-in users empty or change tables outside the rules", async () => {
    await as(OWNER_A, async () => {
      await expect(db.query("truncate organizations cascade")).rejects.toThrow(/permission denied/);
      await expect(db.query("update agents set status = 'live'")).rejects.toThrow(
        /permission denied/,
      );
    });
  });

  it("lets Wyrm admins see every client", async () => {
    await as(ADMIN, async () => {
      expect(await rows("select id from organizations")).toHaveLength(2);
    });
  });

  it("lets staff read but not change settings", async () => {
    await as(STAFF_A, async () => {
      expect(await rows("select id from profile_versions")).toHaveLength(1);
      await expect(insertProfile(AGENT_A, ORG_A)).rejects.toThrow(RLS);
    });
  });

  it("lets owners save settings for their own agent only", async () => {
    await as(OWNER_A, async () => {
      await insertProfile(AGENT_A, ORG_A);
      // Another client's agent is refused, whichever organisation id is claimed.
      await expect(insertProfile(AGENT_B, ORG_A)).rejects.toThrow(RLS);
      await expect(insertProfile(AGENT_B, ORG_B)).rejects.toThrow(RLS);
    });
  });

  it("lets owners add staff, but not owners, and only in their own organisation", async () => {
    const add = (org: string, user: string, role: string) =>
      db.query("insert into memberships (org_id, user_id, role) values ($1, $2, $3)", [
        org,
        user,
        role,
      ]);
    await as(OWNER_A, async () => {
      await add(ORG_A, NEW_STAFF, "staff");
      await expect(add(ORG_A, OWNER_B, "owner")).rejects.toThrow(RLS);
      await expect(add(ORG_B, NEW_STAFF, "staff")).rejects.toThrow(RLS);
    });
  });

  it("does not let clients create agents or organisations", async () => {
    await as(OWNER_A, async () => {
      await expect(
        db.query("insert into agents (org_id, type) values ($1, 'receptionist')", [ORG_A]),
      ).rejects.toThrow(BLOCKED);
      await expect(
        db.query("insert into organizations (name, slug) values ('Nope', 'nope')"),
      ).rejects.toThrow(BLOCKED);
    });
  });

  it("never lets signed-in users look up accounts by email", async () => {
    await as(OWNER_A, async () => {
      await expect(
        db.query("select public.user_id_by_email('someone@example.com')"),
      ).rejects.toThrow(/permission denied/);
    });
  });

  it("hides other clients' team members, and shows staff only themselves", async () => {
    await as(OWNER_B, async () => {
      expect(await rows("select user_id from memberships")).toEqual([{ user_id: OWNER_B }]);
    });
    await as(STAFF_A, async () => {
      expect(await rows("select user_id from memberships")).toEqual([{ user_id: STAFF_A }]);
    });
  });
});
