# packages/core

Server-side operations for the portal (the "API"): tenants, staff, invitations, roles, teams,
agents and access, security settings, Wyrm staff, "view as", dashboard numbers, audit, and
agent operations (`src/operations.ts`: conversations, to-do, approvals, corrections and tests,
settings versions, off switches, usage and budget, home metrics, unanswered topics).

- Every function takes a `Ctx` (`db`, `actor`, `ip`), calls the central permission check from
  `@wyrm/auth` first, filters every query by tenant, and writes an audit entry (who, what,
  when, IP, before/after).
- `db` is Drizzle on Postgres: postgres-js in production (server only, never in the browser),
  PGlite in tests. Database rule violations become `DomainError`s with safe messages.
- Tests (`src/*.test.ts`) run the real migrations in PGlite and include the required cases:
  cross-tenant access, no role escalation, seat limit, suspended tenants, impersonation audit.
