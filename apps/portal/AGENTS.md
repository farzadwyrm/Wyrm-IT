# apps/portal

Invite-only client portal (Next.js 16 App Router + Supabase Auth and Postgres). Plan and
phases: docs/plans/customer-portal.md. Setup: docs/plans/portal-setup.md.

## Next.js version rule

Next.js 16 renamed Middleware to Proxy (`src/proxy.ts`). Before writing Next.js code, read the
relevant guide in `apps/web/node_modules/next/dist/docs/`. Do not rely on memory.

## Security rules

- Three layers, all required: `src/proxy.ts` (signed-out → /login), the data access layer
  `src/lib/auth.ts` (`requireAccess` / `requireAdmin` in every page and server action), and
  row-level security in the database (`packages/db/migrations`).
- Read data with `userClient()` (runs as the user, under RLS). Use `adminClient()` (secret
  key, bypasses RLS) only after `requireAdmin()`, never in client components.
- No public sign-up: `signInWithOtp` uses `shouldCreateUser: false`; clients are invited by an
  admin. Sign-in replies never reveal whether an email has an account.
- Redirect targets go through `safeNext` (same-site paths only).
- No customer data, secrets or real emails in code, tests or fixtures. Tests run with the
  Supabase variables empty and never call a real project.
