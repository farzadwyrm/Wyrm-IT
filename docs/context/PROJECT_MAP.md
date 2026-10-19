# Project map (current state)

Last updated: 2026-10-19

## Done

- Phase 0 scaffold: monorepo, harness docs, CI, Claude Code hooks.
- `packages/assessment`: 12 starter questions across 7 pillars; scoring with tests.
- `packages/ai`: model ids, in-memory demo guard (rate limit and daily budget) with tests.
- `apps/web`: placeholder one-page home (hero, demos "coming soon", offer ladder, contact).

## In progress / next

- Phase 1: real pages (Services, About, Contact with booking, blog skeleton), fonts, logo,
  Vercel deployment.

## Known limits

- Demo guard is in-memory: not safe for multi-instance serverless until backed by Postgres/Redis.
- No database, auth, email or analytics wired yet.
- No end-to-end (Playwright) tests yet; add them with the first interactive demo.
- Not deployed anywhere yet.
