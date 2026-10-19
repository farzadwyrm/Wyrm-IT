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
  (`packages/ai/src/readiness-report.ts`, Claude Opus 5.5, low effort, server-side refusal
  fallback). Server re-validates answers and re-scores; demo guard: 3 summaries per visitor per
  hour, daily cap `DEMO_DAILY_BUDGET_CENTS` (default 500 = $5).
- Playwright smoke tests (`apps/web/e2e/`): every page on desktop and phone, 404, navigation,
  no dead booking link. Included in `pnpm verify` and CI.

## Live

- Production: https://wyrm-it.vercel.app (Vercel, auto-deploys from `main`; root `apps/web`).
  First deploy 2026-10-19: all pages 200, unknown path 404.

## Last verification

2026-10-19, local Windows, Node 24.20, pnpm 10.15: `pnpm verify` passed (harness check, Biome,
typecheck in 5 packages, 39 unit tests, `next build`, 26 Playwright tests incl. full scan flow).
Visual check in a browser: site pages; scan steps and results (desktop dark).
AI summary verified only with a fake client and the no-key path; no real Claude call made yet.
GitHub CI passed on commit 678002e (before Phase 1); Phase 1 CI not yet confirmed.

## In progress / next

- Owner to confirm: About page founder wording, contact promises (reply time, no model training).
- Set `NEXT_PUBLIC_BOOKING_URL` (Cal.com) and `NEXT_PUBLIC_CONTACT_EMAIL` once they exist.
- AI summaries are OFF by choice (free mode). To switch on later: add `ANTHROPIC_API_KEY` in Vercel
  (Production only) and redeploy; the route falls back to the free summary when over budget.
- Phase 2 remainder: lead capture (email the report) needs a database + email provider.
- Phase 3: AI Receptionist demo.

## Known limits

- Demo guard is in-memory: each Vercel instance has its own counters, so the real daily cap can be
  a few times higher than configured. Back it with Postgres/Redis before heavy traffic.
- No live eval for the AI summary yet (`evals/readiness-report/`).
- No database, auth, email or analytics wired yet.
- No domain yet; site URL comes from `NEXT_PUBLIC_SITE_URL`.
