# ADR 0002: Guardrails for public AI demos

Date: 2026-10-19 · Status: accepted

## Context

Public demos call paid AI models. Without limits, one script or curious visitor can create a
large bill or get the site's API key rate-limited.

## Decision

Every public AI endpoint calls `demoGuard.check(visitorId, estimate)` before the model and
`demoGuard.record(visitorId, actual)` after it (`packages/ai/src/demo-guard.ts`).
Limits: per-visitor requests per rolling hour, and a global daily budget in cents
(`DEMO_DAILY_BUDGET_CENTS`). Demos use fictional data only.

## Consequences

- The in-memory store is fine locally; before launch on serverless hosting it must be backed by
  shared storage (Postgres or Redis), otherwise each instance has its own counters.
- When the budget runs out, demos show a friendly "back tomorrow, or book a call" message,
  which is also a sales prompt.
