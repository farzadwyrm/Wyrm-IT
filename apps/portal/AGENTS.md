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
- Sign-in: email + password or Google (Supabase Auth). No public sign-up: sign-ups are off in
  Supabase; accounts are created only from a valid invitation (`/invite/[token]`, password chosen
  there) or by Wyrm. Sign-in errors never reveal whether an email has an account. Passwords:
  `passwordProblem` (10–72 chars); reset via emailed link to `/account/password`.
- Redirect targets go through `safeNext` (same-site paths only).
- No customer data, secrets or real emails in code, tests or fixtures. Tests run with the
  Supabase variables empty and never call a real project.
- Customer chat: `src/app/api/chat/route.ts` (public for live agents, per-IP limit; `test: true`
  only for signed-in staff with access) runs `handleCustomerMessage` from `@wyrm/core` with the
  brain (`@wyrm/brain`) and model calls from `@wyrm/ai`. `/chat/[agentId]` is the public page;
  "Try it" on the agent page uses the same endpoint. Every turn is recorded for the portal.
- Client area screens live in `src/app/dashboard/` (Home, Conversations, To-do, Teach, Agents,
  Settings); `src/lib/portal.ts` (`requireTenant`) is the access check every page calls.
- Agent Studio: `src/app/dashboard/agents/[id]/studio/` (Facts, Rules, Procedures, Limits &
  handoff, Changes, Publish) over `packages/core/src/studio.ts`. Every change needs a note; edits
  are a draft until published; limits are enforced by the runtime, not the prompt.
- Launch (`src/app/dashboard/agents/[id]/launch/`): setup checklist and go-live (customers need all
  required steps plus Wyrm sign-off from the admin client page), website import
  (`src/lib/site-import.ts`: public hosts only, private addresses refused after every redirect,
  robots.txt respected, 10 pages max), website widget (`public/widget.js` + `/api/widget/[agentId]`
  + `/chat/[agentId]?embed=1`; only `/chat/*` may be framed), and Google Calendar
  (`/api/calendar/connect` and `/callback`; switched off until `GOOGLE_CLIENT_ID` and
  `GOOGLE_CLIENT_SECRET` are set; tokens encrypted with a key derived from `SUPABASE_SECRET_KEY`).
