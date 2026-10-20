# ADR 0006: Pivot to AI agents and workflows

Date: 2026-10-20. Status: accepted. Replaces the IT-focused scan and "IT explained" guide.

## Context

The owner decided Wyrm will not do classic IT. The company designs, deploys and runs AI agents
and agent workflows for small and medium businesses. The site looked like an IT consultancy.

## Decision

- Removed: `/scan`, `/guide`, their APIs, `packages/assessment`, the IT guide content and the
  readiness report AI.
- `packages/agents`: catalogue of six agents (voice, inbox, knowledge, sales, back-office,
  support), each with capabilities, a typical workflow (trigger → agent → system → human check
  → result), integrations, guardrails and measures. Pure and tested.
- Pages: `/agents`, `/agents/[slug]` (static), `/planner` (AI workflow planner), home rebuilt
  around agents; `/receptionist` is the live voice-agent demo.
- Planner (`POST /api/plan`, `packages/ai/src/planner.ts`), cheapest first: a standard
  workflow for short, clear tasks (no AI); Claude Haiku if configured; Groq free models; the
  closest standard workflow when no AI is available. Model output must pass `parseWorkflow`
  (trigger first, an agent step, 3-9 steps, capped lengths) or the next model is tried.
  Fixed system prompt first (prefix caching), task last, 20 s deadline, shared Groq cooldowns,
  4 KB body limit, 20 plans per visitor per hour, one log line per request.
- Design: dark technical theme (grid backdrop, violet/cyan accents, Space Grotesk headings,
  JetBrains Mono labels), workflow diagrams as the main visual.

## Consequences

- Planner quality depends on free models; output is validated, never rendered as raw HTML.
- No live eval for the planner yet.
