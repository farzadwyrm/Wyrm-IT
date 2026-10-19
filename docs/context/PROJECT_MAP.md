# Project map (current state)

Last updated: 2026-10-19

## Done

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
