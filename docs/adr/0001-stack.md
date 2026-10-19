# ADR 0001: Technology stack

Date: 2026-10-19 · Status: accepted

## Context

Wyrm IT needs a marketing website with interactive AI demos now, and room to grow into a client
portal and productised AI services later. One engineer builds it, with AI coding agents.

## Decision

- **Language:** TypeScript everywhere in this repo. Python only in separate services that need it
  (for example a voice backend), reached over HTTP.
- **Monorepo:** pnpm workspaces + Turborepo. Nx was rejected as unnecessary overhead at this size.
- **Web:** Next.js 16 App Router, React 19, Tailwind CSS v4, shared tokens in `packages/ui`.
- **Lint/format:** Biome (one fast tool instead of ESLint + Prettier).
- **Tests:** Vitest for units; Playwright for interactive demos (added with the first demo);
  scenario evals for AI behaviour in `evals/`.
- **Data (when needed):** Supabase Postgres with Drizzle ORM.
- **AI:** Vercel AI SDK with Claude models by default; model ids centralised in `packages/ai`.
- **Hosting:** Vercel (free tier until there are paying clients). Code on GitHub (private).

## Consequences

- One language and one toolchain for most work; agents get fast, uniform feedback (`pnpm verify`).
- Workspace packages ship TS source, so no per-package build step is needed today.
- Vercel and Supabase lock-in is limited: Next.js and Postgres both run elsewhere.
