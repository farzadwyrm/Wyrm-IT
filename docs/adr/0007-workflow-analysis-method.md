# ADR 0007: Workflow analysis method

Date: 2026-10-20. Status: accepted. Replaces the one-shot workflow planner (ADR 0006).

## Context

The planner turned one sentence into a generic diagram. The owner asked for a real analysis
method. Research (docs/research/reports/AI agent workflow analysis method.md, notes alongside)
compared SIPOC, metrics-based process mapping, BPMN, Lean waste, process/task mining, UiPath
Automation Hub and Blue Prism scoring, Gartner/Deloitte prioritisation, agent guidance
(OpenAI, Anthropic, AWS), EU AI Act and NIST AI RMF.

## Decision

`/analyse` runs a "conversational mini-PDD":

1. Interview (about 12 interactions): scope (SIPOC), volume (last week, normal week), a
   walk-through of the last real case, a pre-filled step card (actor, input, decision, minutes,
   wait, right first time, re-typing, what's at stake, keep human), exceptions out of 10,
   change expected, documentation, hourly cost, pain points.
2. One AI call (`POST /api/analyse/steps`, `packages/ai/src/extract-steps.ts`) drafts the steps
   from the walk-through; keyword rules (`draftStepsFromText`) when no AI. The owner confirms.
3. All scoring is deterministic code in `packages/agents/src/analysis/`: Rule, Input, AI-fit
   (1-5); capability class by ordered rules; risk tier 1-4 from impact flags (highest wins);
   final class = lower of capability and tier cap; gates (major change → defer; rolled
   first-pass yield < 0.5 → fix first); priority quadrant (value × feasibility).
4. Agent design generated from the classes (approval node before Tier 3 actions).
5. Savings: hours as a low/base/high range (UiPath benefit formula + rework, exceptions and
   oversight terms); money only with a wage, labelled "value of time, not cash"; every
   assumption shown with its provenance.

Deviation from the report: deterministic "Automate" also requires structured input (Input ≥ 4),
because plain code cannot read emails or PDFs reliably.

## Consequences

- Saving rates, thresholds and sampling percentages are defaults (no source validates them);
  they are visible to users and must be calibrated with real deployments.
- Answers stay in the browser (localStorage draft); only the walk-through text is sent.
- GDPR Art. 22 wording and an LLM run-cost model are open items.

## Update 2026-10-20: simpler interface

Owners found the first version confusing. The method is unchanged underneath, but the UI now
asks six questions, one per screen (task, how it starts, times a week, the last time step by
step, minutes per step, how often it goes off plan + optional hourly cost). AI-drafted step
details sit under "More detail"; unasked fields use defaults. The result shows one number,
a plain verdict per step ("AI does it", "AI does it, you check", "AI helps you", "You keep
it"), one diagram, and the method and assumptions folded away.

