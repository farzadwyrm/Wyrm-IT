# Wyrm IT — agent guide

AI solutions company for small and medium businesses. This repo holds the website, AI demos and
(later) the client portal. Read this map first, then only the files your task needs.

## Map

- `ARCHITECTURE.md`: code map, package boundaries, data flow.
- `docs/context/PROJECT_MAP.md`: current state and what is in progress.
- `docs/context/DECISIONS.md`: decisions already made; do not re-argue them without new facts.
- `docs/business/`: offer, roadmap, ideal client. Read these before writing site copy.
- `docs/adr/`: one file per architecture decision.
- Nested guides: `apps/web/AGENTS.md`, `packages/ai/AGENTS.md`, `packages/assessment/AGENTS.md`.

## Commands (run from repo root)

- `pnpm install`: install everything.
- `pnpm dev`: website at http://127.0.0.1:3000.
- `pnpm verify`: harness check, lint, typecheck, tests and build. Must pass before you finish.
- `pnpm verify:fast`: the same without the build.
- `pnpm format`: auto-fix formatting and safe lint issues.

## Red lines

- No secrets in the repo. Keys go in `apps/web/.env.local` (git-ignored); document new ones in
  `.env.example` with an empty value.
- Demos use fictional businesses and people only. No real client names or data anywhere.
- Every public AI endpoint goes through `@wyrm/ai`'s demo guard (rate limit and spend cap).
- Never copy text from third-party documents into the product; rewrite in Wyrm IT's words.
- Do not weaken or delete a test or check to make it pass. Fix the cause.
- Local changes are not deployed changes. Say which one you mean.

## Working loop

1. Read the nested `AGENTS.md` for the area you touch.
2. Make the change with a focused test.
3. Run `pnpm verify`.
4. Update `docs/context/PROJECT_MAP.md` if the state changed; add an ADR for new decisions.
5. When an agent makes a repeatable mistake, add a rule or check so it cannot happen again.
