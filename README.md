# Wyrm IT

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

On Windows, `corepack enable` needs an Administrator terminal. Without it, prefix commands with
`corepack`, for example `corepack pnpm install` and `corepack pnpm dev`.

## Checks

```bash
pnpm verify
```

Runs the harness check, lint, typecheck, unit tests and production build. CI runs the same.

## Where to look

- `AGENTS.md`: guide for AI coding agents (and a good map for humans).
- `ARCHITECTURE.md`: how the code is organised.
- `docs/business/ROADMAP.md`: what gets built when.
