# Project map (current state)

Last updated: 2026-10-20

## Done

- 2026-10-20 PIVOT (ADR 0006): Wyrm is an AI agents company. Site = home (agents), `/agents` +
  `/agents/[slug]` (catalogue in `packages/agents`), `/planner` (AI workflow planner, `POST
  /api/plan`, `packages/ai/src/planner.ts`), `/receptionist` (live voice agent), services,
  about, contact, blog. Dark technical design (`packages/ui/src/theme.css`). Removed: scan,
  IT guide, `packages/assessment`, readiness report. Older bullets below mentioning the scan or
  guide are history only.
- 2026-10-21 Portal LIVE: https://wyrm-portal.vercel.app (Vercel project `wyrm-portal`, Supabase
  project `Wyrm-AI`, EU Frankfurt, migration applied, sign-ups off, redirect URL = live portal
  only). Owner signed in by email link and is admin. Public home; sign-in only for /dashboard,
  /admin. Not yet tested: admin "create client + invite" (secret key). Supabase's built-in email
  only reaches org members, few per hour: set up custom SMTP (e.g. Resend) before real clients.
- 2026-10-21 Portal P0 built locally (ADR 0009): `apps/portal` (magic-link sign-in, invite-only,
  proxy + data access layer, dashboard, admin "create client + invite owner") and `packages/db`
  (migration with row-level security, 9 PGlite isolation tests). NOT connected yet: needs the
  owner's Supabase project, keys in `apps/portal/.env.local`, steps in docs/plans/portal-setup.md.
- 2026-10-21 Receptionist template (ADR 0008): one `BusinessProfile` file per client in
  `packages/receptionist/src/clients/` drives engine, AI prompts/tools and UI;
  `/receptionist/[client]`; guide `docs/business/NEW_CLIENT.md`. Next for real clients:
  calendar adapter, phone number (Twilio/Vapi), booking storage + notifications.
- 2026-10-20 Workflow analysis (ADR 0007) replaces the planner: `/analyse` interview → step
  drafting (`/api/analyse/steps`) → deterministic scoring, risk tiers, agent design and savings
  range in `packages/agents/src/analysis/`. Research: `docs/research/`.

- Phase 0 scaffold: monorepo, harness docs, CI, Claude Code hooks.
- `packages/assessment`: 12 starter questions across 7 pillars; scoring with tests.
- `packages/ai`: model ids, in-memory demo guard (rate limit and daily budget) with tests.
- Phase 1 website: Home, Services, About, Contact, Blog (1 post), 404, sitemap, robots;
  header with phone menu, footer, logo mark, Inter + Fraunces fonts, light/dark mode.
  Copy lives in `apps/web/src/lib/site.ts` and `posts.ts`.
- Phase 2 Readiness Scan at `/scan`: 24 questions in 7 areas (`packages/assessment`), score,
  verdict band, area bars, top 5 fixes; written summary via `POST /api/scan/report`: free
  rule-based text (`packages/assessment/src/summary.ts`) by default, or an AI summary
  (`packages/ai/src/readiness-report.ts`, Claude Haiku 5.5, low effort; refusals fall back to the
  free summary). Server re-validates answers and re-scores; demo guard: 3 summaries per visitor per
  hour, daily cap `DEMO_DAILY_BUDGET_CENTS` (default 500 = $5).
- AI receptionist (ADR 0003): Claude Haiku 5.5 + booking tools via `POST /api/receptionist`
  (`packages/ai/src/receptionist/`). Two-step booking enforced in code (proposal card, then a
  deterministic clear-yes check). Falls back to the rule-based receptionist without a key.
  Live evals: `packages/ai/evals/receptionist.eval.ts` (`pnpm eval`). Scan summary also Haiku 5.5.
- Voice call mode (ADR 0004): `[Chat | Call]` on `/receptionist`, shared session, browser speech
  in/out (`apps/web/src/lib/voice/`), call state machine and "Tide ring" visualiser
  (`apps/web/src/components/receptionist/`). Conversation upgrade from the ai_quality review:
  hardened clear-yes check, voice-aware prompt, part-of-day tools, text kept across tool rounds.
- Phase 3 Receptionist demo at `/receptionist` (basic mode): rule-based engine in
  `packages/receptionist` for the fictional Harbor Lane Dental; runs in the browser, nothing is
  booked. Hours/prices/location answers, booking with corrections and side questions, explicit
  yes before booking, demo cancel. 60 unit tests incl. rejected dates/times and corrections.
- Playwright smoke tests (`apps/web/e2e/`): every page on desktop and phone, 404, navigation,
  no dead booking link. Included in `pnpm verify` and CI.

- Uptime: `.github/workflows/uptime.yml` runs `scripts/uptime-check.sh` hourly (home, agent
  pages, analyser, receptionist; AI step drafting; each under 10 s). A failed run emails the owner. Provider
  "text" on the AI step drafting means the AI is down, rate-limited or the key is missing.

## Live

- Production: https://wyrm-it.vercel.app (Vercel, auto-deploys from `main`; root `apps/web`).
  First deploy 2026-10-19: all pages 200, unknown path 404.

## Last verification

2026-10-19, local Windows, Node 24.20, pnpm 10.15: `pnpm verify` passed (harness check, Biome,
typecheck in 5 packages, 185 unit tests, `next build`, 46 Playwright tests incl. full scan, chat booking and a spoken
call booking with a fake microphone and scripted speech). Visual check of the call view (idle,
speaking, listening, ended) in a browser with simulated audio; no real microphone used.
AI mode verified only with scripted fake models; live evals not yet run (no API key configured).
Visual check in a browser: site pages; scan steps and results (desktop dark).
GitHub CI confirmed green by the owner on commit 678002e; later runs not checked from here
(the `gh` CLI is not signed in).

## In progress / next

- RESUME HERE (2026-10-20): token savings shipped (ADR 0005 "Token use"): instant code answers
  for plain FAQs (provider "instant", no AI call), fixed system prompt + append-only history with
  the booking state in the last user message (Groq prefix caching; cached tokens skip rate limits),
  compact tool results ("4 pm [16:00]": spoken label + tool value), `max_completion_tokens` 600, `groq <model> tokens: in/out` logs. Verified by
  unit tests only. Next: paced live voice test, read Vercel logs for token counts; then `pnpm eval`.
- Old Groq key pasted in chat on 2026-10-19 must be deleted in the Groq console (owner).

- Owner to confirm: About page founder wording, contact promises (reply time, no model training).
- Booking live: `NEXT_PUBLIC_BOOKING_URL` set in Vercel (Production) to the owner's Cal.com
  30-minute event; Contact page verified on the live site. Still to do: `NEXT_PUBLIC_CONTACT_EMAIL`.
- AI providers (ADR 0005): Claude if `ANTHROPIC_API_KEY`, else Groq's free models if `GROQ_API_KEY`,
  else basic. `GROQ_API_KEY` set in Vercel (Production) on 2026-10-19. Next: run `pnpm eval` with
  the Groq key (free) and fix failing scenarios.
- Marketing: LinkedIn plan in `docs/business/marketing/LINKEDIN.md`, local outreach plan in
  `docs/business/marketing/OUTREACH.md`. Real lead lists stay out of git (`.gitignore`).
- Phase 2 remainder: lead capture (email the report) needs a database + email provider.
- Receptionist next steps: AI understanding (Claude) behind a key like the scan; voice; reuse
  of ReceptionAI's engine for real clients.

## Known limits

- Demo guard is in-memory: each Vercel instance has its own counters, so the real daily cap can be
  a few times higher than configured. Back it with Postgres/Redis before heavy traffic.
- No live eval for the AI summary yet (`evals/readiness-report/`).
- No database, auth, email or analytics wired yet.
- No domain yet; site URL comes from `NEXT_PUBLIC_SITE_URL`.
