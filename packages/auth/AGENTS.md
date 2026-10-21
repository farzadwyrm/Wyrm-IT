# packages/auth

The central authorisation layer for the portal: who may do what. Pure TypeScript: no I/O.

- `src/permissions.ts`: every tenant and platform permission, platform role → permissions,
  built-in tenant roles (must match the seed rows in `packages/db/migrations/0003_*.sql`).
- `src/can.ts`: `check(actor, permission, resource)` / `can()` / `assertCan()`. Actors are
  platform staff, tenant staff, or Wyrm staff viewing as a tenant user ("view as").
- `src/escalation.ts`: no-escalation rules for role changes, staff lifecycle, custom roles and
  platform staff changes.

Rules: every server action calls `assertCan` (never compare role names in app code); tenant
actors can never act on another tenant's resources; platform staff need MFA; read-only "view
as" sessions only get read permissions. Every rule has a test in `src/*.test.ts`.
