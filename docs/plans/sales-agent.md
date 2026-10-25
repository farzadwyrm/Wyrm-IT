# Sales agent

Inbound sales agent for small businesses: it answers enquiries on the website chat, asks the
owner's qualifying questions, and hands the team a scored lead. Research basis (2026-10-25):
inbound AI SDR practice (qualify in a real conversation against a written ideal customer, route
by fit, humans take qualified leads) and speed-to-lead studies (answer within minutes). Outbound
email/SMS is out of scope until consent and opt-out handling exist (ePrivacy/GDPR).

## Phase 1 (built)

- **Sales setup** (Studio tab, `studio/sales-form.tsx`): offer, good fit, not a fit, up to 5
  questions with answers rated great (2) / possible (1) / not a fit, a hot threshold and a
  not-a-fit message. Stored in `agent_sales` (migration 0010), published with the policy.
- **Qualify procedure** (`brain/studio.ts` template `qualify`, `brain/sales.ts`): the questions
  become fields the model collects; the model is told the exact answer options. A sales agent
  starts qualifying whatever the visitor opens with.
- **Scoring in code** (`scoreLead`): answers are matched to options; any "not a fit" answer ends
  politely, else points >= threshold is hot, otherwise warm. Unmatched answers score nothing, so
  a visitor can't talk their way to "hot". The score is never shown to the visitor.
- **Leads** (`leads` table, `core/leads.ts`, portal `agents/[id]/leads`): name, contact, answers,
  score, bucket, reasons, status new/contacted/won/lost. Test chats are marked and hidden by
  default. Read: whoever can see the agent's conversations; status: whoever may use the agent.
- **Setup and tests**: a new sales agent (back office, "Sales agent" template) starts with the
  qualify procedure, two example questions, and the "Qualifies a sales enquiry" and safety tests.
  Go-live needs the offer and fit, one rated question, handoff, passing tests, a published
  version, practice chats and Wyrm's sign-off.

## Next phases

2. Hot leads book a call in the connected Google Calendar; notify the owner (email or To-do).
3. Follow-up drafts for warm leads, approved in To-do before anything is sent; opt-out honoured.
4. CRM sync (HubSpot write scopes, owner opt-in) and an outbound email provider with consent
   records.

## Limits

- Open questions are required but not scored.
- If the owner changes the questions, the starter test's scripted answers may no longer complete
  qualification; edit or turn off that test.
