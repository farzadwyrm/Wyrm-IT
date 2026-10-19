# Project map (current state)

Last updated: 2026-10-19

## Done

- Phase 0 scaffold: monorepo, harness docs, CI, Claude Code hooks.
- `packages/assessment`: 12 starter questions across 7 pillars; scoring with tests.
- `packages/ai`: model ids, in-memory demo guard (rate limit and daily budget) with tests.
- Phase 1 website: Home, Services, About, Contact, Blog (1 post), 404, sitemap, robots;
  header with phone menu, footer, logo mark, Inter + Fraunces fonts, light/dark mode.
  Copy lives in `apps/web/src/lib/site.ts` and `posts.ts`.
- Playwright smoke tests (`apps/web/e2e/`): every page on desktop and phone, 404, navigation,
  no dead booking link. Included in `pnpm verify` and CI.

## Last verification

2026-10-19, local Windows, Node 24.20, pnpm 10.15: `pnpm verify` passed (harness check, Biome,
typecheck in 5 packages, 14 unit tests, `next build` of 10 routes, 18 Playwright tests).
Visual check in a browser: desktop dark mode, phone light mode, phone menu.
GitHub CI passed on commit 678002e (before Phase 1); Phase 1 CI not yet confirmed.

## In progress / next

- Owner to confirm: About page founder wording, contact promises (reply time, no model training).
- Set `NEXT_PUBLIC_BOOKING_URL` (Cal.com) and `NEXT_PUBLIC_CONTACT_EMAIL` once they exist.
- Deploy to Vercel (owner signs in and imports the GitHub repo; steps in `docs/business/LAUNCH.md`).
- Phase 2: Readiness Scan demo.

## Known limits

- Demo guard is in-memory: not safe for multi-instance serverless until backed by Postgres/Redis.
- No database, auth, email or analytics wired yet.
- No domain yet; site URL comes from `NEXT_PUBLIC_SITE_URL`.
- Not deployed anywhere yet.
