# ADR 0003: AI receptionist = language model + deterministic booking tools

Date: 2026-10-19 · Status: accepted

## Context

The first receptionist demo was rule-based: reliable, but it understood only common phrasings.
The owner wants real AI. Market practice for AI receptionists (2026) is consistent: a language
model handles the conversation and calls tools; application code owns availability and booking,
re-checks every slot, and never lets the model invent one.

## Decision

- **Model:** Claude Haiku 5.5 (`packages/ai/src/models.ts`), effort `low`, adaptive thinking.
  Owner's choice for cost (about €0.004 per conversation). Opus 5.5 is the quality upgrade.
- **Tools** (`packages/ai/src/receptionist/tools.ts`), all backed by the tested engine in
  `packages/receptionist`: `check_availability`, `find_next_available_days`, `propose_booking`,
  `book_appointment`, `cancel_appointment`. Strict schemas.
- **Guardrails in code, not in the prompt:**
  - `book_appointment` only accepts a proposal created in an earlier turn (shown to the
    visitor as a confirmation card) and only if the visitor's latest message passes the
    deterministic `isClearYes` check. The model cannot book in the turn it proposes.
  - Slots are re-checked at proposal and at booking.
  - (Added after live testing, 2026-10-19.) Code books a read-back proposal itself when the
    visitor's reply is a plain yes (`bookIfClearYes`), so booking never depends on the model
    choosing the tool, and the model cannot book twice.
  - Every reply is checked before the visitor sees it (`reply-guard.ts`): claims of a booking that
    didn't happen, internal ids, and read-backs of unproposed times are sent back to the model
    once to correct, then replaced with an honest line.
  - At most 6 tool rounds per turn; history capped at 30 messages of 600 characters.
  - The server re-validates everything the browser sends.
- **No training or fine-tuning.** Quality comes from the prompt, tools and evals.
- **State** lives in the visitor's browser (history, demo bookings, pending proposal); the server
  is stateless. Nothing is stored.
- **Fallback:** without `ANTHROPIC_API_KEY`, over budget, or on any AI failure, the chat switches to
  the rule-based receptionist, so the demo always works.
- **Quality:** unit tests use a scripted fake model that tries to misbehave; live evals in
  `packages/ai/evals/` run real conversations (`pnpm eval`, needs a key, under 1 cent per run).

## Consequences

- The demo understands natural language, while booking safety does not depend on the model
  behaving well.
- A forged proposal from a tampered browser can only "book" a fake demo appointment in that
  browser. For real clients, proposals and bookings must live server-side (ReceptionAI does this).
- Live behaviour is only verified once a key is configured and `pnpm eval` passes.
