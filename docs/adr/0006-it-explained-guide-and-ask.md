# ADR 0006: "IT explained" guide and grounded Ask AI

Date: 2026-10-20. Status: accepted.

## Context

The owner wants the site to explain, in plain language, every IT system area a discovery
review covers (identity, devices, network, apps, data, monitoring, governance and more), and
an AI that can discuss any of them. Source material was a third-party discovery handbook:
we use it only as a checklist of topics and write all content ourselves.

## Decision

- `packages/guide` holds 19 areas, each with a Zero Trust pillar (7) and a priority phase
  (1 fix first … 4 advanced): summary, why it matters, parts, warning signs, quick wins and
  questions to ask. Pages and the AI share this one source.
- Pages: `/guide` (by pillar, plus phases) and `/guide/[slug]` (static, `dynamicParams =
  false`). Home page leads with the guide: hero ask bar (`/guide?q=`), seven pillar questions,
  "Fix these first". Nav: "IT explained" first; Blog moved to the footer.
- Ask AI (`POST /api/ask`, `packages/ai/src/guide-ask.ts`), cheapest first:
  1. instant answers from the guide for clear shapes (quick wins, questions, warning signs,
     "what is X"): no AI call;
  2. Claude Haiku if `ANTHROPIC_API_KEY`, else Groq free models;
  3. guide-only fallback when no AI is available or limits are hit. Visitors always get an
     answer.
- Grounding with minimum tokens: keyword `pickArea` sends only the matched area's compact
  notes (or a one-line-per-area index), after a fixed system prompt, so prefix caches hit;
  last 4 turns (600 chars each); `max_completion_tokens` 700; one 20 s deadline (Claude 12 s, Groq
  8 s per model, rate-limited models skipped via the shared Groq cooldown); 32 KB body limit;
  one `ask status=… provider=… area=… ms=…` log line per question. Answers are cleaned of links and markdown.
- Limits: 30 questions per visitor per hour, shared daily budget setting.

## Consequences

- Keyword matching can pick the wrong area for unusual wording; the current page wins ties
  and the AI still sees the guide index when nothing matches.
- No live AI eval yet for this feature; unit tests use fake models only.
