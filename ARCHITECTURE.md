# Architecture

## Shape

A pnpm + Turborepo monorepo. Apps are deployable; packages are shared, framework-light code.

```
apps/
  web/              Next.js 16 site: agent catalogue, workflow planner, live agent demos (Vercel)
  portal/           invite-only client portal (Supabase Auth + Postgres); plan: docs/plans/customer-portal.md
packages/
  config/           shared TypeScript presets
  ui/               brand tokens (Tailwind v4 theme) + shared React components
  agents/           agent catalogue + workflow model (pure: matching, validation)
  receptionist/     rule-based receptionist engine for the voice-agent demo (pure)
  ai/               model ids, demo guard, Claude/Groq chains: receptionist, workflow planner
  db/               portal database: SQL migrations with row-level security, Drizzle types, RLS tests
evals/              fixed scenarios that every AI demo must pass
scripts/            repo tooling (harness check)
docs/               context, decisions, business docs
```

## Dependency rules

- `apps/*` may import any `packages/*`. Packages never import from `apps/*`.
- `agents` and `receptionist` are pure: no I/O, no React, no AI calls.
- `ai` is server-only: never imported by client components.
- `ui` has no business logic and no data fetching.
- Workspace packages export TypeScript source; `apps/web` compiles them via `transpilePackages`.

## Request flow (demos, from Phase 2)

```
browser ──> apps/web route handler / server action
              ├─ @wyrm/ai demoGuard.check()   (rate limit + daily budget)
              ├─ model call (AI SDK, model from @wyrm/ai MODELS)
              ├─ @wyrm/ai demoGuard.record()
              └─ lead / result stored via packages/db (Supabase Postgres)
```

## Quality gates

`pnpm verify` = `scripts/check-harness.mjs` + Biome lint + `tsc` per package + Vitest + Next build.
CI (`.github/workflows/ci.yml`) runs the same on every push and pull request.
AI behaviour is additionally checked by `evals/` once demos exist.
