# Workflow

## Branches and commits

- `main` is always deployable. Work on short branches: `feat/…`, `fix/…`, `docs/…`.
- Open a pull request; CI must be green before merging.
- One logical change per commit, with a message that says why.

## Definition of done

1. `pnpm verify` passes locally and in CI.
2. New behaviour has a test (unit now; Playwright for interactive demos; evals for AI behaviour).
3. `docs/context/PROJECT_MAP.md` reflects the new state.
4. A new decision gets an ADR in `docs/adr/` and a row in `DECISIONS.md`.

## The ratchet

When a person or an AI agent makes a mistake that could happen again, do not just fix it:
add a test, a lint rule, a check in `scripts/check-harness.mjs`, or a line in the relevant
`AGENTS.md` so it is caught automatically next time.
