# Setting up a receptionist for a new client

One settings file per client. The engine, AI prompts, booking tools, safety checks and the
chat/call screens are shared; only this file changes.

## 1. Collect the details (30-minute call)

Use the workflow analysis (`/analyse`) with the owner, then fill in:

| What | Example | Field |
|---|---|---|
| Business name and type | Bright Cuts Salon, a hair salon | `name`, `kind` |
| Address and how to get there | 48 Market Street; parking on Market Square | `address`, `directions` |
| Opening hours per day | Tue–Fri 09:00–18:00, closed Mon/Sun | `hours` (Monday first, `null` = closed) |
| Services: name, length, price, words customers use | Men's cut, 30 min, €30, "trim", "fade" | `services` |
| What customers call them | treatment / service | `serviceWord` |
| How far ahead, minimum notice, time grid | 6 weeks, 2 hours, every 30 min | `booking` |
| Reference prefix | BC | `booking.referencePrefix` |
| Extra facts (payment, cancellations…) | 24 hours' notice to cancel | `facts` |
| What happens when someone wants a person | Message to the team, same-day call back | `handoff` |
| Safety and care rules | Patch test before first colour | `careRules` |
| What it must never advise on | Medical advice about skin or scalp | `noAdviceOn` |
| 1–3 example exchanges in their style (optional) | — | `examples` |

Never put customer data, staff names or secrets in the file.

## 2. Create the file

1. Copy `packages/receptionist/src/clients/bright-cuts-salon.ts` to
   `packages/receptionist/src/clients/<client-id>.ts` and fill it in.
2. Set `demo: false` for a real client (removes all "demo" wording).
3. Add it to `PROFILES` in `packages/receptionist/src/clients/index.ts`.
4. Run `pnpm verify`. The tests check every profile: valid hours, service lengths on the time
   grid, unique ids, a reference prefix. Fix anything they report.

## 3. Try it

`pnpm dev`, then open `http://127.0.0.1:3000/receptionist/<client-id>`: chat and the simulated
phone call both run on the client's settings. Test with the owner on 20–30 real past
questions and bookings before go-live.

## 4. What is shared vs per client

| Shared (built once) | Per client (this file) |
|---|---|
| Conversation skills, booking rules, "book only after a clear yes" | Business facts, hours, services, prices |
| Calendar checks, references, reply guard, fallbacks | Care rules, things it must not advise on |
| Claude → Groq → basic receptionist chain | Tone examples, hand-off message |
| Chat and call screens, voice handling | Reference prefix, booking window |

## Not done yet for a real phone line (next steps)

- **Real calendar**: today availability comes from a demo calendar in code. Next: a calendar
  adapter for Google Calendar / Outlook so bookings land in the client's real calendar.
- **Phone number**: today calls run in the browser. Next: a Twilio (or Vapi/Retell) number
  connected to the same agent, so customers can phone it.
- **Storage and notifications**: bookings are not stored and nobody is notified. Next: store
  bookings, and email/SMS the team on each booking and hand-off.
- **Contract**: a DPA with the client before any real personal data is processed.
