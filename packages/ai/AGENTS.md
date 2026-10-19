# packages/ai

Everything that talks to an AI model goes through this package.

- `src/models.ts`: the only place model ids are written. Do not hard-code model ids elsewhere.
- `src/demo-guard.ts`: rate limit plus daily spend cap. Every public demo route must call
  `check()` before the model call and `record()` after it. No exceptions.
- API keys are read from the environment on the server only. Never import this package's
  provider code into client components, and never send keys to the browser.
- Prompts for each demo live next to that demo's eval cases in `evals/<demo>/`.
- A change to prompts or guards needs passing unit tests and a passing eval run (see `evals/`).
