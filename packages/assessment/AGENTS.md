# packages/assessment

The AI-Readiness & IT Health Scan as typed data plus a pure scoring function.

- `src/questions.ts`: question bank. `src/score.ts`: scoring. `src/types.ts`: shared types.
- Keep it pure: no I/O, no AI calls, no React. The web app and the AI report consume it.
- Question `id`s are permanent once published. To retire a question, remove it; never reuse its id.
- Write questions in Wyrm IT's own plain words for non-technical SMB owners. Never paste text from
  third-party handbooks, and never name real client companies.
- Any change to scoring needs a matching test in `src/score.test.ts`.
