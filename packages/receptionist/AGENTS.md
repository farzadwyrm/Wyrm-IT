# packages/receptionist

Rule-based receptionist for the free website demo, working for a fictional clinic.
Pure TypeScript: no I/O, no AI calls, no React. It runs in the visitor's browser.

- `src/engine.ts`: conversation state machine (`respond(state, message, now)`).
- `src/dates.ts`: day and time understanding. `src/availability.ts`: free times.
- `src/profile.ts`: `BusinessProfile`, `hoursText`, `openingHours`, `validateProfile`.
- `src/clients/`: one file per client; `index.ts` lists them (`PROFILES`, `DEMO_PROFILE`).
  Demo profiles are fictional (`demo: true`); never put customer data or secrets here.
- `src/clinic.ts`: the old `CLINIC`/`SERVICES` names, derived from the demo profile.
- Every function that depends on the business takes a profile (default: the demo), so code
  must never hard-code a business name, service, hours or reference prefix.

## Safety rules (each has tests in `src/engine.test.ts`; never remove them)

- Never book without an explicit yes at the confirmation step.
- Reject past days, closed days, days beyond the booking window, impossible dates,
  times outside opening hours, times that are too soon, and taken times.
- Accept corrections (day, time, treatment, name) at any step.
- Answer side questions (hours, prices, location) without losing the booking in progress.
- Do not ask for personal data beyond a first name; the demo says a made-up name is fine.

Every new bug found in a conversation becomes a test case first.
