# Wyrm AI

Practical AI for small and medium businesses: an IT and AI readiness assessment, then AI
assistants (receptionist, ask-your-documents, workflow automation) built and run for the client.

## Quick start

Requirements: Node.js 24+, pnpm (via `corepack enable`).

```bash
corepack enable
pnpm install
pnpm dev
```

Open http://127.0.0.1:3000.

On Windows, `corepack enable` needs an Administrator terminal. Without admin rights, install
pnpm for your user instead: `npm install -g pnpm@10.15.0`. Turborepo needs a `pnpm` command on
PATH, so `corepack pnpm …` alone is not enough for `pnpm verify`.

## Checks

```bash
pnpm verify
```

Runs the harness check, lint, typecheck, unit tests and production build. CI runs the same.

## Where to look

- `AGENTS.md`: guide for AI coding agents (and a good map for humans).
- `ARCHITECTURE.md`: how the code is organised.
- `docs/business/ROADMAP.md`: what gets built when.
