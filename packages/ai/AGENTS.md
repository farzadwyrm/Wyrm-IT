# packages/ai

Everything that talks to an AI model goes through this package.

- Provider chain (`src/receptionist/providers.ts`): Claude if `ANTHROPIC_API_KEY`, then Groq's free
  models (`src/receptionist/groq-agent.ts`, `GROQ_MODELS`) if `GROQ_API_KEY`, then the basic
  versions. Both AI engines must use the same tools and checks from `src/receptionist/tools.ts`.
- `src/models.ts`: the only place Claude model ids are written (Groq ids live in `GROQ_MODELS`). Do not hard-code model ids elsewhere.
- `src/demo-guard.ts`: rate limit plus daily spend cap. Every public demo route must call
  `check()` before the model call and `record()` after it. No exceptions.
- API keys are read from the environment on the server only. Never import this package's
  provider code into client components, and never send keys to the browser.
- `src/receptionist/agent.ts` (AI receptionist turn loop) and `src/receptionist/tools.ts`
  (its booking tools).
  Booking safety lives in the tools, never only in the prompt (see `docs/adr/0003-ai-receptionist.md`).
- Unit tests use fake clients only. Live evals are in `evals/` (`pnpm eval`, needs a key, costs
  money, never in CI). A change to prompts, tools or models needs passing unit tests and a
  passing eval run.
- `src/brain-models.ts`: model calls for the main brain: `brainClassifiers` (Haiku, then Groq)
  and `answerAsAgent` (answers only from the agent's facts and taught answers; never acts).
