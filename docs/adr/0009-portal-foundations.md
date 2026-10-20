# ADR 0009: Portal foundations (P0)

Date: 2026-10-21. Status: accepted. Plan: docs/plans/customer-portal.md.

## Decision

- Separate app `apps/portal` (Next.js 16), invite-only, at its own address; the public site
  is untouched.
- Supabase: Auth (email magic links, `shouldCreateUser: false`, links verified server-side via
  `token_hash`) and Postgres in the EU region.
- Security in three layers: `src/proxy.ts` (signed-out → /login), data access layer
  `src/lib/auth.ts` (`requireAccess`/`requireAdmin` in every page and action), and row-level
  security in `packages/db/migrations/0001_portal_foundations.sql`.
- Roles: `owner`, `staff` per organisation; Wyrm `admin` via `wyrm_admins`. Only admins create
  organisations and agents; owners add staff and save settings versions; staff read.
- RLS is tested by running the migration in PGlite (in-memory Postgres) with a stand-in `auth`
  schema; portal e2e tests run with Supabase unset (everything locked except /login).
- Admin "create client" uses the secret key only after `requireAdmin()`: creates the
  organisation and a draft receptionist, invites the owner, links membership, writes audit log.

## Consequences

- Nothing works against real data until the owner creates the Supabase project and runs the
  migration (docs/plans/portal-setup.md). The invite and magic-link flow is untested against a
  real project.
- P1 next: settings editor (BusinessProfile JSON in `profile_versions`) and the receptionist
  reading its profile from the database.
