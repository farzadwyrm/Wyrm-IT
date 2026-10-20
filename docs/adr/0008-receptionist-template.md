# ADR 0008: Receptionist as a reusable template

Date: 2026-10-21. Status: accepted.

## Context

The receptionist was hard-coded for one fictional dental clinic (names, hours, services,
dental care rules and examples in the engine, the AI prompts, the tools and the UI). Selling it
to clinics, salons and garages needs the same agent with different settings.

## Decision

- `BusinessProfile` (`packages/receptionist/src/profile.ts`): name, kind, demo flag, address,
  directions, hours per weekday ("HH:MM"), services (with an `urgent` flag), service word,
  booking window/notice/grid/reference prefix, facts, hand-off text, care rules, topics it
  must not advise on, optional style examples. One file per client in `src/clients/`.
- `validateProfile` + tests check every profile (hours, service lengths on the grid, ids).
- The rule engine, availability, AI tools (service enum per client), full and compact
  prompts (built from the profile, cached per profile for prompt caching), reply guard,
  state context and provider chain all take the profile; default = the demo profile, so the
  public demo and all regression tests are unchanged.
- Demo wording ("made-up name", "fictional") appears only when `demo: true`.
- Web: `POST /api/receptionist` takes `client` (profile id; unknown → 400) and validates
  service ids per profile; `/receptionist/[client]` renders any profile (static); the demo
  stays at `/receptionist`.

## Consequences

- New client = one file + `pnpm verify` + testing with the owner (docs/business/NEW_CLIENT.md).
- Still demo-only: availability uses the in-code demo calendar, bookings aren't stored or
  notified, calls run in the browser. Next: calendar adapter (Google/Outlook), phone number
  (Twilio or Vapi), booking storage and team notifications, client DPA.
