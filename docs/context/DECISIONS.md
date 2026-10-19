# Decisions log

Short record of settled decisions. Details live in `docs/adr/`.

| Date | Decision | ADR |
|---|---|---|
| 2026-10-19 | TypeScript monorepo: pnpm + Turborepo, Next.js 16, Tailwind v4, Biome, Vitest | 0001 |
| 2026-10-19 | Supabase Postgres + Drizzle for data (when needed); Vercel hosting | 0001 |
| 2026-10-19 | Public AI demos must use a rate limit and a daily spend cap | 0002 |
| 2026-10-19 | Repo hosted on GitHub as a private repository | 0001 |
| 2026-10-19 | Scan AI summary uses Claude Opus 5.5 at low effort with `fallbacks: "default"`; Haiku 5.5 is the cheaper option if costs matter | 0002 |
| 2026-10-19 | Scan answers stay in the browser; only scores and gaps are sent to the AI, never personal data | 0002 |
| 2026-10-19 | Free mode for now: scan summary is rule-based (no API key, €0); Claude is used automatically once a key is added, with the free summary as fallback | 0002 |
| 2026-10-19 | Receptionist demo is rule-based and runs in the browser (free); clinic is fictional; no personal data beyond a first name | — |
| 2026-10-19 | Playwright never reuses a running server, so tests always hit the current build | — |
| 2026-10-19 | Legal setup (company, contracts, GDPR paperwork) deferred until first client commits | — |
