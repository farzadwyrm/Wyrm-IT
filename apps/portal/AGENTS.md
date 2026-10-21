# apps/portal

Invite-only client portal (Next.js 16 App Router + Supabase Auth and Postgres). Plan and
phases: docs/plans/customer-portal.md. Setup: docs/plans/portal-setup.md.

## Next.js version rule

Next.js 16 renamed Middleware to Proxy (`src/proxy.ts`). Before writing Next.js code, read the
relevant guide in `apps/web/node_modules/next/dist/docs/`. Do not rely on memory.

## Security rules

- The portal home and tools are public; only the client area (`/dashboard`, `/admin`,
  `PROTECTED_PATHS` in `src/lib/config.ts`) needs sign-in.
- Three layers, all required: `src/proxy.ts` (signed-out → /login for the client area), the data access layer
  `src/lib/auth.ts` (`requireAccess` / `requireAdmin` in every page and server action, which
  loads the verified actor), and `@wyrm/core`, which checks `can()` on every operation. Row-level
  security (`packages/db/migrations`) still guards the Supabase API.
- Reads and writes go through `@wyrm/core` with `coreContext(access)` over `DATABASE_URL`
  (`src/lib/db.ts`, server only). Server actions stay thin: validate input, call core, explain
  `DomainError`s. Use `adminClient()` (secret key) only for account actions: Wyrm staff after
  `requireAdmin()`, or a valid invitation for that exact email.
- Two-step verification for Wyrm staff is off (`STAFF_MFA_ENFORCED`) until its set-up screen
  ships in stage 7.
- No public sign-up: `signInWithOtp` uses `shouldCreateUser: false`; clients are invited by an
  admin. Sign-in replies never reveal whether an email has an account.
- Redirect targets go through `safeNext` (same-site paths only).
- No customer data, secrets or real emails in code, tests or fixtures. Tests run with the
  Supabase variables empty and never call a real project.
