# packages/agents

The AI agent catalogue and workflow model shared by the website pages and the workflow
planner. Pure TypeScript: no I/O, no AI calls, no React.

- `src/catalogue.ts` + `src/more-agents.ts`: 12 agents in 5 categories (customers, sales,
  operations, finance, team): voice, inbox, knowledge, sales, back-office,
  support, quote, payment reminder, scheduling, reporting, reviews, meeting notes), each with capabilities, a typical workflow, integrations, guardrails, measures.
  Measures are what we track, never promised results. No client names.
- `src/workflow.ts`: `Workflow`/`Step` types; `parseWorkflow` validates model output (trigger
  first, at least one agent step, 3-9 steps, capped lengths); `extractJson`.
- `src/match.ts`: `matchAgent` (keyword match of a visitor's task), `isTemplateTask`.

Every catalogue workflow must include a human check and at least three guardrails (tested).
