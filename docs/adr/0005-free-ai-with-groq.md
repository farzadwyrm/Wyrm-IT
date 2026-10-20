# ADR 0005: Free smart AI with Groq, after Claude and before the basic versions

Date: 2026-10-19 · Status: accepted

## Context

The owner wants a smart AI in the demos at no cost for now. Anthropic has no free API tier.
Groq's free tier (no card) serves open models quickly, which suits voice. Groq documents that it
does not retain inference data by default or train on customer data (console.groq.com/docs/your-data;
free-tier specifics not separately stated, so recheck before using real customer data).

## Decision

- Provider chain for the receptionist and the scan summary: **Claude** (`ANTHROPIC_API_KEY`) →
  **Groq free models** (`GROQ_API_KEY`) → **basic** (rule-based receptionist / instant summary).
- Groq models, tried in order (`GROQ_MODELS`): `openai/gpt-oss-120b` (production),
  `qwen/qwen3.8-27b` (preview), `openai/gpt-oss-20b` (production). Each has its own free allowance
  (per Groq docs, 2026-10-19: 30 requests/min, 1,000/day, 8,000 tokens/min, 200,000 tokens/day).
  A rate-limited model rests for Groq's `retry-after` and the next one answers.
- Reasoning is hidden per model (`include_reasoning: false` for gpt-oss, `reasoning_format: hidden`
  and `reasoning_effort: none` for qwen) and any leaked `<think>` text is stripped in code.
- Same tools, prompt and booking safety checks as the Claude agent (shared `tools.ts`).
- The demo header says which AI answered ("free open model" or "Claude").

## Consequences

- Capacity: roughly 15-20 full conversations a day across the three models (estimate; a turn uses
  about 5,000-9,000 tokens). Beyond that the basic versions answer.
- Open models are expected to be less reliable than Claude at nuance; run `pnpm eval` with the Groq
  key (free) to measure, and keep booking safety in code.
- The preview Qwen model may change or disappear without notice; the chain skips failing models.

## Token use (2026-10-20)

Groq's free tier allows 8K tokens/min per model, so every turn is kept small:

- **Answer in code first.** Short FAQ messages (hours, address, prices) with nothing pending are
  answered by `answerSimpleQuestion` (provider `instant`): zero tokens.
- **Cache-friendly prompt.** The system prompt and tools never change; history is append-only; the
  volatile booking state (time, calendar, pending proposal) is put in the latest user message. Groq
  caches exact prefixes automatically and cached tokens do not count toward rate limits.
- **Compact everything for Groq:** short prompt and tool descriptions, 10-day calendar, last 24
  messages, tool results reduced to "4 pm [16:00]" (words to say, value for tools), `max_completion_tokens` 600.
- **Measure.** Each call logs `groq <model> tokens: in N out M` (no conversation content).

