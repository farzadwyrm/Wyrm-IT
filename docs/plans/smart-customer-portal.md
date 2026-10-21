# Plan: smart customer portal and the "main brain"

Status: proposed (2026-10-21). Research behind it:
[main-brain-orchestration.md](../research/main-brain-orchestration.md),
[agent-dashboard-products.md](../research/agent-dashboard-products.md).

## The idea in one paragraph

A small-business owner opens the portal and sees, in plain words, what their AI agents did for
them, what needs their attention, and what to fix, with one click to each of those. Behind it, a "main brain"
decides for every incoming call or message which agent handles it, whether an action is safe to
do alone, and whether it stays within budget. It logs every decision so the portal can explain it.

## Design decisions (from the research)

1. **The brain is code, not a chatty AI supervisor.** A TypeScript module does routing rules,
   permission and risk checks, budget and logging. The AI model is only used to classify a
   message, pull out details and write wording. This is cheaper (multi-agent AI uses ~15× the
   tokens), predictable and testable.
2. **Agents are handlers** (receptionist, booking, follow-up, quotes, FAQ): each has its own
   instructions and a small set of tools. They don't talk to each other freely.
3. **Routing:** rules first (continue the active conversation, a known FAQ, "I want a person",
   STOP), then Haiku classifies with a confidence score (Groq if Haiku fails, a message-taking fallback if both fail).
   ≥0.75 route · 0.5–0.75 ask one question (max 2) · lower → hand to a person.
4. **Risk tiers:**
   - **T0** (inform/read): runs on its own.
   - **T1** (book, reschedule, confirm, draft a quote): only after the customer says yes.
   - **T2** (cancel, send quote/invoice, discount, edit records): staff approval.
   - **T3** (refunds, payments, mass messages, deletions, settings): always a human, and not built yet.
   - Text inside calls, emails or messages can never approve anything.
5. **Honesty:** every channel says it's an AI at the start (EU AI Act, Article 50). Numbers
   separate *confirmed* from *assumed* results, and every number clicks through to the calls behind it.
6. **Budget and safety switches:**
   - Each organisation has a monthly AI budget, with a daily cap of 1/20 of it.
   - At 80% of the daily cap, only code answers and free models are used.
   - At 100%, the agent takes a message instead.
   - A booking in progress is never dropped.
   - Off switches at five levels: everything, organisation, agent, tool, AI provider.
   - An agent stops sending on its own if its errors spike or it suddenly sends far more than usual.
7. **Learning loop:** "Fix this answer" on any transcript line becomes a correction that the
   agent uses next time and a test case it must keep passing. An AI reviewer scores a 5–10%
   sample; people review every handoff.

## Customer portal (what the owner sees)

Navigation (6 items):

| Item | What it does |
| --- | --- |
| **Home** | 6 numbers with week-over-week change: calls/chats answered, bookings (confirmed / pending), leads and callbacks, handed to a person, needs attention, plan usage with a month-end forecast. Plain-language insight cards ("12 people asked about parking this week; add an answer?"). |
| **Conversations** | Filterable list (agent, outcome, date; filters kept in the link). Drawer with AI summary, outcome label, transcript, and "why the brain chose this agent". |
| **To-do** | One queue: approvals (T2), handoffs, callbacks, unconfirmed bookings, unanswered questions. Approve or reject with a reason. |
| **Teach** | Corrections and answers in plain language, suggested fixes grouped by topic with links to the calls behind them, business facts (hours, services, prices). |
| **Test & publish** | Draft vs live versions, test questions (including ones made from real calls), publish, restore an older version, agent on/off. |
| **Settings** | Team, roles and invitations, teams, agent access, security, audit log, plan and usage. |

What each person sees and can do follows their role and per-agent access (use / configure / view logs), all checked on the
server. Calm, simple design; works on a phone; WCAG 2.2 AA.

Skip for now: custom dashboard builders, latency and concurrency charts, A/B splits, flow
editors, free-form "ask your data" (later: preset questions only).

## Data (new migration 0004)

All tables are tenant-scoped and select-only for signed-in users under row-level security. Every
write goes through `@wyrm/core`. Data is minimal: logs hold references, not raw personal data.

- `conversations`: channel, agent, customer reference, started/ended, outcome (confirmed /
  assumed / handed off / abandoned), AI summary, flags, quality score.
- `conversation_messages`: role, text (kept for the retention period), timestamps.
- `agent_decisions`: about 25 fields per brain decision: decision type, intent and confidence,
  rule id, chosen agent, tool and risk tier, approval id, provider and model, fallback depth,
  tokens, cost, latency, retries, errors, guardrail flags, config version.
- `approvals`: a held action with its tier, payload hash, expiry, single use, reviewer and reason.
- `corrections`: the original answer, the correct answer, scope (agent/topic), status, and the test made from it.
- `agent_tests`: test questions and expected behaviour; results per published version.
- `usage_daily`: tokens, cost, conversations per tenant per agent per day (budget and the usage page).
- `kill_switches`: scope (global / tenant / agent / tool / provider), on/off, who, why.
- Reuse what already exists: `agents`, `agent_settings_versions` (draft/live/restore), `agent_access`, `audit_logs`
  (T2/T3 actions and every settings change).

## Build stages

Each stage ends with typecheck, lint, tests, a green CI run, deployment, and a live check with a fictional demo
organisation.

1. **Data foundation:** migration 0004, Drizzle schema, PGlite tests (row-level security, tenant isolation,
   approval single-use and expiry). Applied live together with stage 3.
2. **Main brain package (`packages/brain`):** pure TypeScript: rules → classifier (via
   `@wyrm/ai`, Haiku → Groq → fallback) → policy (risk tier, `can()`, budget, off switches) →
   decision + log record. Unit tests with a fake classifier: routing thresholds, every risk tier,
   budget steps, off switches, injected "approve this" text ignored, a booking in progress
   finished during a budget stop.
3. **Core API:** list and filter conversations, conversation detail, decide on an approval, add a
   correction, publish and restore a version, agent on/off, usage, Home metrics (SQL with week-over-week change),
   off switches. Permission tests including cross-tenant ones.
4. **Portal screens:** Home, Conversations, To-do, Teach, Test & publish, Settings (folds in
   the earlier "/app/settings" stage). Wyrm admin gets the same views per tenant ("view as",
   read-only for Support).
5. **Smart features (free-tier friendly):**
   - A summary and outcome label generated once per conversation (budget-gated).
   - An unanswered-question finder with one-click "answer this".
   - Change chips and simple anomaly flags.
   - "Turn this call into a test".
   - A weekly digest by a daily Vercel cron job (free) with Resend emails (free tier).
6. **Connect the live agents:** the receptionist (web chat and voice) runs through the brain, so
   real conversations, decisions and usage flow into the portal; AI disclosure at first contact.
7. **Demo organisation and acceptance:** a fictional business with seeded conversations, live checks of each screen
   and role, docs and ADR 0010.

Still open from the user-management build: Wyrm admin console (stage 4 there), invitation
and role-change emails, two-step verification for Wyrm staff and "view as". They are scheduled into
stages 4–5 above where they fit.

## Not now

An AI supervisor planning every turn; agents chatting freely; vector memory; automatic refunds, payments or mass sends;
self-rewriting prompts; paid monitoring tools; learning across customers.
