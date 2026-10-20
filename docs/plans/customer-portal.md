# Customer portal plan

Status: proposed, 2026-10-21. Build after the first 3–5 paying clients or when a client asks to
change their own settings. Until then, Wyrm edits settings files and emails a weekly report.

## 1. Shape: a separate app, same repo

- **Marketing site** (`apps/web`, wyrm domain): public, static, fast. Unchanged.
- **Portal** (`apps/portal`, `app.` subdomain): logged-in area for clients and for Wyrm staff.
- Both share `packages/ui`, `packages/receptionist`, `packages/agents`, `packages/ai`; the portal
  adds `packages/db`.
- Why separate: a clean security boundary (no login code or customer data in the public site),
  independent deploys, and the public site stays cacheable.

## 2. Who uses it

| Role | Who | Can |
|---|---|---|
| `owner` | Client's owner/manager | Everything for their own business, invite staff, billing |
| `staff` | Client's team | See conversations, bookings and hand-offs; mark hand-offs done |
| `admin` | Wyrm | All clients: create clients, invite owners, view usage and health |

**No public sign-up.** Wyrm creates the client and invites the owner by email. This matches a
done-for-you service and blocks abuse and cost surprises.

## 3. MVP features (v1)

1. **Sign in**: email magic link (no passwords to manage); sessions expire; admins must use
   two-step login.
2. **Overview**: this week's conversations, bookings made, hand-offs waiting, estimated hours
   saved (same method as `/analyse`).
3. **Conversations**: list and full transcript, filtered by outcome (booked, handed off,
   unresolved, AI fallback). Button: "This answer was wrong", which feeds the monthly review.
4. **Hand-offs inbox**: callback requests and messages the agent took; mark done. Email the team
   on each new one.
5. **Bookings**: what the agent booked or cancelled (calendar sync comes with the calendar adapter).
6. **Business settings**: edit hours, services and prices, facts and the hand-off text. Changes
   are checked with `validateProfile`, previewed in a **test chat**, then published. Every
   version is kept, with one-click undo.
7. **Billing**: a link to the Stripe-hosted customer portal for invoices and card details. No
   payment screens of our own.
8. **Admin (Wyrm only)**: client list, create client and invite owner, usage and cost per client,
   failures and fallbacks, and a read-only view of any client's portal.

Out of scope for v1: self-serve onboarding, our own billing UI, phone-number buying, SSO
(add for large clients later), mobile app.

## 4. Data model (Postgres)

```
organizations   id, name, slug, plan, created_at
memberships     user_id, org_id, role (owner|staff|admin)
agents          id, org_id, type (receptionist|…), status (draft|live|paused)
profile_versions id, agent_id, profile_json, created_by, created_at, published_at
conversations   id, org_id, agent_id, channel (chat|voice|phone), started_at, outcome, summary
messages        id, conversation_id, role, text, created_at        -- retention-limited
bookings        id, org_id, conversation_id, reference, service_id, day, time, first_name, status
handoffs        id, org_id, conversation_id, reason, callback_note, status, done_by, done_at
usage_daily     org_id, day, conversations, tokens_in, tokens_out, voice_minutes, cost_cents
audit_log       id, org_id, user_id, action, target, at
```

- **Tenant isolation**: `org_id` on every row; Postgres row-level security (RLS) plus server-side
  checks; tests prove one client can never read another's rows.
- **Agent runtime**: the receptionist API loads the published `profile_json` for an agent id
  (cached) instead of a file; files stay for demos and tests.
- **Privacy**: EU data region; first names only (as today); transcripts kept 90 days by default
  (configurable per client); no secrets or API keys in rows; DPA signed before go-live.

## 5. Technology (free to start)

| Need | Choice | Why |
|---|---|---|
| App | Next.js 16 (same as the site) | One skill set, shared components |
| Auth + database | Supabase (EU region): Auth with magic links, Postgres with RLS | Free tier, built-in RLS |
| Database access | Drizzle ORM in `packages/db` | Typed schema and migrations in git |
| Email | Resend | Invites, hand-off alerts, weekly report; free tier |
| Billing | Stripe Billing + hosted customer portal | No card data touches us |
| Hosting | Vercel (second project for `apps/portal`) | Same as the site |

## 6. Phases and effort (solo, focused weeks)

| Phase | Delivers | Effort |
|---|---|---|
| P0 Foundations | `packages/db` schema and migrations, Supabase Auth, orgs and roles, RLS with tests, admin "create client + invite", deploy at `app.` | 1 week |
| P1 Settings | Settings editor with validation, test chat, versions and publish; receptionist reads its profile from the database | 1 week |
| P2 Activity | Conversation logging from the agent APIs, Conversations and Hand-offs pages, email alerts | 1 week |
| P3 Polish | Overview stats, weekly email report, Stripe billing link, admin usage view | 3–4 days |
| Later | Calendar connect (Google/Outlook OAuth), phone-number management, staff invites UI, monthly PDF report, SSO for large clients | per need |

## 7. Decisions needed from the owner

1. **Domain**: buy one (e.g. a `wyrm` .ai or .com) so the portal can live at `app.<domain>`.
   Until then it can run on a second `*.vercel.app` address.
2. **Accounts** (created by the owner, never via chat): Supabase (EU region), Stripe, Resend.
3. **Transcript retention default**: 90 days proposed.
4. **When to start**: proposed after the first 3–5 paying clients, or sooner if a client needs
   to edit their own settings.

## 8. Until the portal exists

- Wyrm edits the client's settings file (docs/business/NEW_CLIENT.md) on request, same day.
- Weekly email: conversations, bookings, hand-offs, anything that went wrong.
- Hand-offs go straight to the client by email.
