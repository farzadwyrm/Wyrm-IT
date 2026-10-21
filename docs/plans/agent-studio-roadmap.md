# Roadmap: Agent Studio and a professional client portal

Status: phases 1–2 built and live (2026-10-21); phases 3–6 not started. Research behind it (every claim
cited there): [agent-policies.md](../research/agent-policies.md),
[agent-delivery.md](../research/agent-delivery.md),
[agent-management-ia.md](../research/agent-management-ia.md),
[agent-dashboard-products.md](../research/agent-dashboard-products.md),
[main-brain-orchestration.md](../research/main-brain-orchestration.md).

## What's wrong today (owner feedback: "very poor")

- An agent is configured with three free-text boxes (greeting, facts, tone). A customer can't set
  **policies**: what the agent may do, its limits, when it must hand over, or how a booking, cancellation or quote should go.
- No onboarding: no setup checklist, no knowledge import, no calendar, no channel setup, no
  go-live gate.
- "Test" is only a chat box: there are no test packs, the publish step has no checks, and you can't see why the agent answered as it did.
- The dashboard is thin: no insights, no quality score, and no setup tracker or live status.

## What competitors actually do (summary)

1. **Four separate things the customer edits** (Intercom Fin, Ada, Zendesk, Agentforce):
   **facts**, short **rules** (plain language, scoped), **procedures/playbooks** (when to use,
   when not, typed steps, required info, actions, exits), and **hard limits enforced in code**
   (money caps, identity checks). Never put instructions inside facts. Node-graph builders are being
   retired; plain-language steps with code-enforced checks won.
2. **Lifecycle:** draft → test → publish → restore, with a "What changed?" note, an author, a
   history, and a conflict check when rules are saved (Ada). Restore creates a new draft (Fin).
3. **Testing:** test sets run before publish, checking reply, action and handoff separately
   (Agentforce). Bookings are simulated during tests, and publishing is blocked if a required test fails.
4. **SMB delivery:** self-serve in minutes. The service learns from the business's website or Google Business Profile, then calls are forwarded to it.
   Go live after hours first, then overflow, then all calls (staged call forwarding). A setup tracker with
   Required/Recommended steps (My AI Front Desk). Agencies charge a setup fee plus a monthly retainer.
5. **Portal information architecture:** Home (setup tracker, live status with version, outcomes, attention, insights),
   Conversations (dense table, outcome labels, why it answered, score with explanation), To-do,
   Insights (topics ranked by unresolved × volume, knowledge gaps), Teach, Test & Publish,
   Settings. An always-visible "Try your agent" button. Test traffic is excluded from numbers.
6. **Staff console:** fleet health sorted by "needs attention", templates and releases (a template
   change runs every client's tests, then a staged rollout), QA rules, billing, incidents, audit.

## The policy model we will build

| Object | Who edits | Shape | Enforced by |
|---|---|---|---|
| **Business facts** | Owner (forms) | Hours, services and prices, locations, staff, FAQs. Facts only | AI answers from these |
| **Rules** | Owner | Up to 15 rules × 300 characters. Scope: channel, hours, new/returning caller, language. Priority, on/off | AI instructions; **conflict check on save** |
| **Procedures** | Owner (from templates) | When to use / when not; required info (typed); steps; actions; confirmation; exit and handoff; test set | Brain state machine + AI wording |
| **Limits** | Owner (forms) | Max discount or refund (0 by default), how far ahead bookings can be made, cancellation notice, after-hours behaviour, topics it must not discuss, VIP numbers always sent to a person | **Code, never the prompt** |
| **Handoff** | Owner | Defaults (customer asks for a person, frustration, loops) + scoped rules + contact and hours | Brain rules |
| **Voice and tone** | Owner | Presets (friendly, formal, brief) + reply length | Prompt |
| **Change log** | System | Who, when, what changed (note required), diff, restore as draft | Database (append-only) |

Order of precedence when they disagree:
1. Platform safety.
2. The owner's hard limits.
3. The active procedure's own rules.
4. Rules: the narrower scope wins, then priority, then the newest, with a visible warning.
5. Tone.
6. The default handoff.

Procedure templates for launch: **Book**, **Reschedule**, **Cancel** (T2 approval when inside the
notice period), **Take a message**, **Transfer/handoff**, **Quote request** (T2 before sending).

## Roadmap

Each phase ends with tests, a green CI run, a deploy and a check on the live site using the demo business.

### Phase 1: Agent Studio (policies)
- New tables: `agent_rules`, `agent_procedures`, `agent_limits`, and a `policy_changes`
  change log. Facts move into a structured `business_profile`. All of these are versioned with the existing settings versions.
- Studio screens: Facts (forms), Rules (list + editor + scope + conflict warnings), Procedures
  (templates → editable steps and required info), Limits, Handoff, Voice. A "What changed?" note on
  every save.
- Brain and runtime: assemble the prompt from the policy objects in the order of precedence; run procedures as a
  state machine (collect required info → confirm → act → exit); check limits in code before
  any action; record which rule or procedure step was used for every decision ("why it answered").

### Phase 2: Test & Publish
- Test sets per agent: template tests for each procedure, plus tests made from real conversations. The runner
  scores **reply / action / handoff** separately using simulated tools, and an AI judge applies plain-English
  criteria on the free model.
- Publish is blocked when a required test fails. The diff shows what changed. One-click restore
  (as a draft). An optional staged rollout comes later.
- "Try your agent" panel with a step-by-step trace (rule matched, procedure step, limit checks).

### Phase 3: Onboarding and delivery
- Setup tracker on Home: Required (facts confirmed, hours, handoff contact, 1 procedure,
  tests pass, channel connected) and Recommended (calendar, rules, FAQs).
- **Import from website:** crawl the business site, the AI drafts facts and FAQs, and the owner confirms them.
- **Calendar:** Google Calendar connection with a health check; bookings use real availability.
- **Channels:** website chat widget (copy-and-paste snippet), shareable chat link; phone forwarding
  wizard (after-hours → overflow → all calls) when Twilio is added (needs the owner's account).
- Go-live gate: Required steps done, tests pass, 3 practice chats or calls; Wyrm signs off.

### Phase 4: Portal redesign (professional management)
- Navigation: Home, Conversations, To-do, Insights, Teach (Studio), Test & Publish, Settings,
  plus a "Try your agent" button and a live status pill (on/paused, version).
- Conversations: dense table with outcome labels, channel, agent, score and why, a filter
  saved in the link, and test traffic excluded.
- Insights: topics ranked by opportunity, knowledge gaps with an AI-suggested answer to approve,
  trends, cost per conversation.
- Settings: team and roles, notifications, billing and usage, audit log, data retention.

### Phase 5: Operate loop
- Each conversation gets an AI summary, outcome label and a 1–5 quality score with its reason (free model, within budget).
- Weekly suggestions ("3 new questions this week, approve these answers") and a weekly digest
  email (Resend free tier, needs the owner's account), with alerts for lead, handoff and error spikes.

### Phase 6: Wyrm staff console
- Fleet health (all clients sorted by needs attention), client detail, cross-client
  conversations, templates and releases (a template change runs every affected client's tests first), QA rules,
  usage and billing, incidents, staff access, audit.

## Build prompts (one per phase)

**Phase 1 prompt.**
> Build Agent Studio in `D:\WyrmIT`, following `docs/plans/agent-studio-roadmap.md` and
> `docs/research/agent-policies.md`.
>
> Data:
> - Add migration 0005 with the tables `agent_rules`, `agent_procedures`, `agent_limits` and
>   `policy_changes`, and a structured business profile.
> - Use row-level security (read-only for signed-in users) and same-tenant triggers.
> - The change log is append-only, and every change needs a "what changed" note.
>
> Core:
> - Add functions with `can()` checks (`agents.configure`) and an audit entry for every write.
> - Add a conflict check on save: deterministic overlap of scope and opposite verbs, plus a free-model check.
> - Return the conflicts as warnings.
>
> Brain and runtime:
> - Build the prompt from these objects in the documented order of precedence.
> - Run procedures as a state machine: required info → confirm → act → exit/handoff.
> - Enforce limits in code before any tool runs.
> - Record `rule_id` and the procedure step on every decision.
>
> Portal: build the Studio screens (Facts, Rules, Procedures from the 6 templates, Limits,
> Handoff, Voice), simple and accessible, with drafts saved as versions.
>
> Tests:
> - PGlite tests for the tables and rules.
> - Brain tests for precedence, limits that block actions, and procedure flows.
> - Test that "text in a message can't change policy".
>
> Constraints: free tiers only, fictional fixtures only, and deploy plus a live check on the demo business.

**Phase 2 prompt.**
> Build Test & Publish.
>
> Tests and runner:
> - Test sets per agent, from procedure templates and from conversations. Each test has
>   turns, an expected action, an expected handoff and plain-English criteria.
> - The runner uses simulated tools, so nothing real is booked or sent.
> - It scores reply (free-model judge), action (exact) and handoff (exact) separately.
> - It stores results per settings version.
>
> Publishing:
> - Block publishing while a required test fails.
> - Show the differences from the live version.
> - Restore creates a new draft.
>
> Add a "Try your agent" panel with a step trace: rule matched, procedure step, limit
> checks, model used.
>
> Write tests for the runner and the publish gate. Deploy, then run the demo agent's test pack on the live site.

**Phase 3 prompt.**
> Build onboarding.
>
> - **Setup tracker:** Required and Recommended items calculated from the data, shown on Home.
> - **Website import:**
>   - Fetch at most 10 pages from the business domain. Respect robots.txt.
>   - Have the free model draft facts and FAQs, and show them as suggestions the owner
>     confirms. Nothing goes live without confirmation.
> - **Google Calendar:** OAuth (tokens encrypted at rest), an availability tool, and a health
>   check. Bookings are created only after the customer's yes, within limits.
> - **Website chat widget:** a small script plus an iframe page with an allowed-origins list.
> - **Go-live gate:** Required items done, tests passing, 3 practice conversations, and Wyrm sign-off.
>
> The phone forwarding wizard stays behind a flag until a Twilio account exists.
>
> Test everything and deploy.

**Phase 4 prompt.**
> Redesign the client portal using `docs/research/agent-management-ia.md`.
>
> - **Navigation:** Home, Conversations, To-do, Insights, Teach, Test & Publish, Settings.
> - **Always visible:** a "Try your agent" button and a live status pill (on/paused, version).
> - **Conversations:** dense filterable table, outcome labels, AI summary, score with its reason,
>   reasoning trace, and test traffic excluded.
> - **Insights:** topics ranked by unresolved × volume, knowledge gaps with suggested answers to
>   approve, trends, cost.
> - **Settings:** team, notifications, billing and usage, audit log.
>
> Design and quality:
> - Keep it consistent, dense and calm. It must work on a phone and meet WCAG 2.2 AA.
> - Every number is clickable and every score explains itself.
> - Run end-to-end tests for each screen and check it live as the demo business.

**Phase 5 prompt.**
> Add the operate loop.
>
> - **After each conversation:** a free-model summary, an outcome label, and a 1–5 quality score
>   with a one-line reason. Stay within the budget.
> - **Weekly:** a job builds suggestions and a digest email through Resend (behind a flag until
>   the account exists).
> - **Alerts:** a new lead, a handoff waiting more than 30 minutes, and error or volume spikes.
>
> Write tests with fake models. Deploy.

**Phase 6 prompt.**
> Build the Wyrm staff console:
>
> - Fleet health table sorted by needs attention.
> - Client detail with "view as".
> - Cross-client conversations.
> - Templates and releases: a template change runs every affected client's tests, then rolls out
>   in stages.
> - Plain-English QA rules.
> - Usage and billing.
> - Incidents.
> - Audit.
>
> Respect the platform roles: Support is read-only. Test, deploy and check live.

## Needs from the owner (when we reach them)

- Google Cloud OAuth consent for Calendar access (free; same project as sign-in).
- Resend account (free) for the digest and invitation emails.
- Twilio account (paid per number and minute) for phone and SMS; WhatsApp needs Meta approval.
- Pricing decision: a flat monthly plan with a usage allowance and an optional setup fee (recommended by the research).

## Progress

- **Phase 1 done (2026-10-21):**
  - Migration 0005 (`packages/db/migrations/0005_agent_policies.sql`) is applied live.
  - Policy model: `packages/brain/src/studio.ts`.
  - Studio API: `packages/core/src/studio.ts`.
  - Runtime procedures and limits: `packages/core/src/runtime.ts`.
  - Studio screens: `apps/portal/src/app/dashboard/agents/[id]/studio/`.
  - The demo policy (`packages/db/seed/demo-studio.sql`) is loaded live.
  - Live check: a booking was collected across four messages, read back, confirmed and recorded as a request with a
    readable summary. A blocked topic was stopped in code.
  - Limits: bookings are *requests* until the calendar connection exists (Phase 3). The Studio screens weren't
    checked while signed in as a customer.
- **Phase 2 done (2026-10-21):**
  - Migration 0006 is applied live.
  - Storage-free turn engine: `runTurn` in `packages/core/src/runtime.ts`.
  - Simulator, runner, starter tests and publish gate: `packages/core/src/testing.ts`.
  - Free-model judge: `judgeReply` in `packages/ai/src/brain-models.ts`.
  - Studio Tests tab and "Test & publish": `apps/portal/src/app/dashboard/agents/[id]/studio/`.
  - "Why?" trace in test chats.
  - Demo starter tests (`packages/db/seed/demo-tests.sql`) are loaded live.
  - Live check: the chat works after the refactor; the trace is only returned to signed-in staff (a public test
    request gets 403).
  - Not yet run live in the portal: running the test pack and publishing through the gate both need a customer login
    for the demo business.
