# packages/db

Database for the customer portal (Supabase Postgres). Plan: docs/plans/customer-portal.md.

- `migrations/*.sql`: the source of truth, including row-level security (RLS) policies. Run in
  order in the Supabase SQL editor. Never edit an applied migration; add a new file.
- `src/schema.ts`: typed Drizzle view of the same tables; keep in sync with the SQL.
- `src/rls.test.ts`: runs the migrations in an in-memory Postgres (PGlite) with a stand-in for
  Supabase's `auth` schema and proves tenant isolation. Every new table gets `org_id`, RLS
  enabled, policies, and a test here.

Every new table also needs explicit grants (see `0002_api_grants.sql`): Supabase no longer
exposes new tables to the API by default. Never grant anything to `anon`.

Applied to the live project (Wyrm-AI): 0001, 0002, 0003 (two-tier users), 0004 (agent operations), 0005 (agent policies), 0006 (test gate), 0007 (onboarding) (2026-10-21).

Rules: no customer data, secrets or real emails in migrations or tests; signed-out visitors
see nothing; only Wyrm admins create organisations and agents.

`seed/demo-business.sql`: fictional demo organisation (Bright Smile Dental (demo)) with agents,
conversations, an approval and usage; idempotent; run in the Supabase SQL editor.
`seed/demo-studio.sql`: published Agent Studio policy for the demo front desk (run after the above).
`seed/demo-tests.sql`: starter tests for the demo front desk (after demo-studio.sql and 0006).
