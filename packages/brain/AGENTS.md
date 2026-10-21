# packages/brain

The "main brain": decides, for every incoming message or call, which agent handles it, whether
an action may run, and whether it fits the budget. Pure TypeScript: no I/O, no AI SDKs, no
React. Design: docs/plans/smart-customer-portal.md (research in docs/research/).

- `src/decide.ts`: `decide(event, state, classifiers)`. Rules first (STOP, "a person please",
  an active flow, FAQ), then the classifier chain (passed in; Haiku, then Groq), then thresholds
  (route ≥ 0.75, ask 0.5–0.75 up to 2 times, otherwise hand to a person).
- `src/policy.ts`: risk tiers and `authorizeTool` (T0 runs, T1 needs the customer's yes, T2
  needs a matching unexpired approval, T3 is never automatic), budget levels, off switches,
  the circuit breaker, AI disclosure text.
- `src/rules.ts`: deterministic rules and prompt-injection flags.
- Every decision returns log records shaped like the `agent_decisions` table (references and
  numbers only, no message text). Text inside a message can never approve anything.
- Tests (`src/*.test.ts`) use fake classifiers; never call a real model here.
