# Agent-management dashboards: information architecture and screens (2025-2026)

Researched 2026-10-21. This file builds on `agent-dashboard-products.md`, which already covers headline metrics, call-log basics, alerts, billing and versioning for Fin, Sierra, Decagon, Retell, Vapi, Bland, Lindy, Relevance, Voiceflow, Zendesk, Goodcall, Smith.ai, Rosie and My AI Front Desk (MAFD). This file adds **navigation trees, screen layouts, configuration panels, review, trace, test and insight screens, and the recommended Wyrm IA**.

Source labels: **[doc]** is an official help or docs page. **[vendor]** is marketing copy. **[3p]** is a third-party source. **n/f** means not found publicly. Screen descriptions come from docs text, not from screenshots that were viewed directly.

---

## 1. Product teardown

### 1.1 Intercom Fin

**Navigation.** Since 19 Mar 2025, Fin has four areas: **Analyze** ("track performance & uncover insights"), **Train** ("manage content & refine responses"), **Test** ("preview answers"), and **Deploy** ("choose who sees Fin and when") [doc]. https://www.intercom.com/help/en/articles/10742658-navigating-fin-from-setup-to-deploy

| Area | What it contains |
|---|---|
| Analyze | Performance report, conversations, unresolved questions, Optimize dashboard, Topics Explorer |
| Train | **Content** (what Fin knows), **Guidance** (how Fin behaves), **Tasks** (what Fin does), and **Suggestions**, described as "a to-do list for content managers" |
| Test | Previews, batch tests, simulations (see the earlier file) |
| Deploy | Channels (chat, email, phone) and the audience who sees Fin |

Sources: https://www.intercom.com/help/en/articles/12554470-optimize-fin-instantly-with-the-help-of-ai , https://www.intercom.com/help/en/articles/11394959-use-ai-powered-suggestions-to-improve-fin

**Optimize dashboard** (Analyze > Optimize) [doc]. https://fin.ai/updates/optimize-dashboard , https://www.intercom.com/help/en/articles/12554470-optimize-fin-instantly-with-the-help-of-ai
- It reviews conversations that Fin escalated or could not answer, then gives **weekly suggestions grouped by gap type**: content, data and actions.
- There are two content-suggestion types:
  - **Add content:** many related questions are not covered by any article.
  - **Edit article:** an article only partly answers a common question.
- Data and action suggestions have two parts:
  1. **Interim escalation guidance**, ready to use now, which routes the query to the right team.
  2. **Automation setup instructions**, which link to Tasks or data connectors.
- The dashboard is visible only once Fin is live.

**Topics Explorer** (Analyze > Topics Explorer, Pro add-on) [doc]. https://www.intercom.com/help/en/articles/11390087-use-the-topics-explorer-to-see-what-s-driving-volume
- **Left side:** a treemap of topics. Box size is conversation volume, and box colour is the selected metric (Fin involvement rate, resolution rate, median handling time and so on). In light mode, darker boxes mean "needs attention".
- **Right side:** ridge-line charts show each topic over time.
- Clicking a topic opens the same layout one level down, for its subtopics. Hovering shows a definition of the topic, and you can open its conversations.
- How topics are built: similar questions are clustered into subtopics first, then grouped into topics. A subtopic needs at least 15 conversations. English only.
- You can switch the metric to automation rate and slice by channel or segment. https://fin.ai/help/en/articles/13560797-fin-ai-agent-automation-rate

**CX Score** [doc]. https://fin.ai/help/en/articles/13975974-understand-customer-experience-at-scale-with-the-cx-score
- An AI rating from 1 to 5 for every closed chat or email conversation, with no survey needed. **Phone calls are not scored.**
- It is built from six reasons:
  1. Fin answer quality
  2. Teammate answer quality
  3. Customer effort
  4. Strong emotion
  5. Product feedback
  6. Policy feedback

  Each reason is rated positive, negative, high, low or neutral, and all reasons carry equal weight.
- The Performance report shows % positive with a breakdown by reason. **Drill-in** lists each conversation with its score and an *AI explanation of the factors behind it*.
- Topics Explorer shows the CX Score for each topic and can filter by reason.
- A Pro benchmark panel compares you with peers in your industry: score distribution bars and "What's standing out" cards.

**Lesson for Wyrm:** every score comes with a short "why" sentence, and every chart opens the conversations behind it.

### 1.2 Ada

**Left navigation** [doc]. https://docs.ada.cx/docs/welcome/dashboard-navigation.md

- **Home:** performance overview plus key metrics and recent activity.
- **Analytics:**
  - **Topics & Intents:** ranked by *AR opportunity*.
  - **Reports**
  - **Explore:** a custom query builder.
- **Convos:** a searchable library of conversations, grouped by customer with the newest first.
- **Testing:** test cases with expected outcomes and pass/fail results. Requires Simulations.
- **Config:** a second sidebar with three groups.
  - *AI Agent:* Knowledge (Articles and Sources), Glossary, Playbooks, Greeting, Actions, Processes, Handoffs (rules, integrations, Off hours), CSAT, **Coaching**, and Settings (Preferences such as name, personality, voice and tone; Languages; Variables; Custom Instructions; Redactions, which are Owner or Admin only).
  - *Channels:* Chat (Appearance, Installation, **Launch** rollout controls, Data & privacy, Outreach), Email, Social, Voice.
  - *Platform:* API keys, Apps, Webhooks.
  - A persistent **"Test AI Agent"** button sits in the Config sidebar.
- **Team:** members, roles, SSO and session limits.
- **Profile menu:** What's new, Ask for help, Documentation, **Audit log** (configuration changes), Profile.

**Conversation view and reasoning trace** [doc]. https://docs.ada.cx/docs/optimization/conversations.md
- Each conversation shows the steps the agent took and the resources it used (Coaching, Knowledge, Actions, Playbooks), an **Automated Resolution assessment**, and conversation and end-user attributes.
- Tool rows show latency inline, for example "Slow API response: 4.3 s" or "API timed out after 45.0 s". A turn's total time is shown when it exceeds 1 s. Clicking a row opens a details pane.
- A 2025 redesign shows more reasoning steps, and each reasoning decision can be coached. https://docs.ada.cx/release-notes/2025/1/7

**Coaching flow** [doc]. https://docs.ada.cx/docs/optimization/coaching/coaching-tools
1. In a conversation, hover over a message or reasoning step and click **Provide coaching**. Customer messages, human messages, system events and empty searches cannot be coached.
2. Check the **"When replying to"** intent, which is pre-filled and editable.
3. Choose a behaviour: send a message (up to 500 characters), handoff, use the knowledge base, run an action, follow a process, or run a playbook.
4. **Save**, then **Test AI Agent**.

A Coaching list page lets you edit or delete each entry, open its source conversation, and see the conversations where it was applied. The conversation list has a "Coaching applied" filter. In a conversation where coaching fired, the reviewer is asked **"Should this coaching have been applied here?"** Impact metrics are not shown yet.

**Topics & Intents** [doc]. https://docs.ada.cx/docs/optimization/performance/intent-intelligence/topic-and-intent-analysis.md
- An expandable table: each Topic opens to show its Intents.
- Columns: Conversations, AR rate, **AR opportunity = (1 − AR rate) × share of conversations**, CSAT, and Containment. The default sort is AR opportunity.
- System buckets "Other" and "Unclassified" catch the rest. Conversations are classified about 10 minutes after the last message.
- The **Recommended Intents** panel offers Review, then Approve or Dismiss. Clicking a row opens Convos with the matching filters. CSV export.

**Reports** [doc]. https://docs.ada.cx/docs/optimization/performance/reports/performance-reports.md
- 11 reports: AR and containment (with the per-conversation AR reasoning), API usage (error rate per action, downloadable error log), handle time, message-volume histograms, conversations breakdown (Opened, Engaged, Escalated, Resolved), CSAT, knowledge usage per article, survey results, and proactive outreach for messaging and voice.
- Filters include **"Include test user" (off by default)**, AR classification, coaching, article, action, playbook, generated topic, handoff, channel, language, status code and variable.

**Change sets** (draft and release) [doc]. https://docs.ada.cx/docs/optimization/change-sets.md
- Statuses: Testing, Promoting, Promoted, Reverted.
- The detail view shows each entity touched, with a summary ("2 edits", "article added") and a **side-by-side diff with only the changed words highlighted**.
- **Live customer test:** roll out to x% of new conversations, up to a conversation limit.
- Reverts are possible for 90 days. Promote and delete require confirmation.

### 1.3 Salesforce Agentforce

**Builder** (new, Agent Script based) [doc]. https://trailhead.salesforce.com/pt-BR/content/learn/modules/new-agentforce-builder-quick-look/explore-the-new-agentforce-builder
- It has three panels:
  1. **Explorer:** subagents (topics) and their actions.
  2. **Canvas:** a document-style editor showing natural-language blocks, with a toggle to **Script** view that has validation.
  3. **Preview:** a test chat.
- Header: Canvas/Script toggle, Agentforce Assistant (build and debug by chat), **Save** (draft), and **Commit Version** (a locked snapshot you then activate).
- Preview has two modes:
  - **Simulate:** no actions run and no data changes.
  - **Live Test:** actions really run.
- Each message has *Interaction details* (an AI summary of the reasoning) and a **Trace** of every step. You can "ask Agentforce to explain" any step, see variables over time, and see timing per step.
- Building blocks are topics, actions, instructions, channels and guardrails. Global Instructions are listed with actions, variables and topics [3p/vendor]. https://www.salesforceben.com/new-agentforce-builder-released-in-beta-our-first-thoughts/ , https://www.salesforce.com/au/agentforce/agent-builder

**Testing Center** [doc]. https://trailhead.salesforce.com/ko/content/learn/modules/agentforce-agent-testing/view-test-results , https://trailhead.salesforce.com/content/learn/modules/agentforce-agent-testing/set-up-testing-criteria
- **Setup:** New Test, choose the agent, optionally add context variables or conversation history, then choose **AI-generated cases** or upload a **CSV**. CSV columns are utterance, expected topic, expected actions, and expected response in plain language. Up to 1,000 cases.
- **Results header:** three pass rates, for **Subagent (topic) %, Action %, and Response %**.
- **Run history:** status, results, who ran it, and start time, plus Details and Download.
- **Results table columns:** Utterance, Expected Subagent, Expected Actions, Expected Response, Agent Response, then Pass/Fail for each, plus the actual subagent and actions.
- A failure is debugged by replaying it in Builder Preview. "Run Again" is in the row menu.

**Observability** (formerly Command Center) [vendor/3p]. https://www.salesforce.com/blog/agentforce-observability/ , https://www.salesforce.com/blog/command-centre/
- **Agent Analytics:** trust, RAG, health and quality metrics in one view. Choose a metric and slice it by subagent, action or intent. Voice has its own view, and custom dashboards are supported.
- **Session view:**
  - Trace linked to sources, with inline citations that highlight the exact chunk retrieved.
  - **Errors placed at the point in the reasoning path where they happened.**
  - A waterfall trace across subagents, and a graph view with trust and RAG metrics per interaction.
  - Bulk download and saved table configurations.
- **Scoring:** deflection and abandonment are scored by an LLM over the whole session using an **editable prompt**, and custom LLM-as-judge scores can be added (sentiment, tone, pricing).
- **Agent Optimization** clusters sessions by similar request and scores them by intent, topic and quality. Health Monitoring was planned for Spring 2026 [3p]. https://www.royalcyber.com/technologies/agentforce-observability/
- Observability is unmetered on all Agentforce SKUs [vendor].

### 1.4 Sierra
- **Product areas:** Agent Studio (Journeys, Knowledge, Simulations) and Insights.
  - **Insights** includes Reporting, **one-click investigation** (a data point opens Explorer), Explorer (natural-language Q&A with sample conversations and recommendations), Automated tagging, Monitoring ("always-on conversation review that flags conversations needing attention"), **Auditing** (the reasoning for each action, including the knowledge and systems used), and Alerting (abuse and performance drops).
  - Source [vendor]: https://sierra.ai/product/optimize-your-agent
- **Experience Manager:** described as the CX-team surface for inspecting calls, tracking performance and updating the agent, alongside AgentOS [3p]. https://dheryajalan.substack.com/p/sierra-ai-redefining-customer-experience . No public screen-level docs exist (n/f). Sierra is sold through implementation engagements with no self-serve signup [3p]. https://alatirok.com/sierra-agentos-review/
- **Handoffs** carry "full context and history" [vendor]. https://sierra.ai/voice

### 1.5 Decagon
- **Product menu:** Build (AOPs, Integrations), Optimize (Experiments, Testing & QA), Scale (Insights & reporting, Watchtower, **Suggestions**). The training modules cover Platform, Knowledge base, AOPs, Debugging, Testing, Versions, Watchtower QA, Insights and Duet [vendor]. https://decagon.ai/modules/testing
- **Testing has two levels:**
  - **Message Replays:** unit tests on a single response, used to check a bug fix.
  - **Simulations:** AI personas run full conversations.

  Recommended coverage: brand and tone, escalation guardrails, knowledge retrieval, and AOP logic. Run tests several times because results are non-deterministic, and rerun before every deploy. Tests can be built from real conversations, keeping their metadata and tool outputs. Assertions check, for example, that the right AOP fired or a tool was called, and tool outputs can be mocked [vendor]. https://decagon.ai/modules/testing , https://decagon.ai/resources/decagon-simulations
- **Next-generation simulations (Jun 2026):**
  - Duet auto-generates a golden set from AOPs and production conversations.
  - Results show a **stage-by-stage conversation arc** with a **severity on each issue**.
  - Assertions guide the score instead of a pure checklist.
  - **Stale tests are updated or removed automatically** when the agent changes.
  - Tests are gated in CI from branch to staging to production.

  Source [vendor]: https://decagon.ai/blog/the-next-generation-of-simulations
- Watchtower, Experiments and Insights are covered in the earlier file.

### 1.6 Zendesk AI agents (Advanced)
- **AI agents home:** totals for conversations, automated resolutions and escalations, plus a list of agents with status and channel [doc]. https://support.zendesk.com/hc/en-us/articles/10346309894938
- **Reporting has four tabs** [doc]. https://support.zendesk.com/hc/en-us/articles/9510024609178
  1. **Overview:** Total, Understood, Escalated, Assisted and Handled conversations; Automated resolutions; Rated conversations; BSAT; "Total vs automation".
  2. **Contact reasons:** use-case and knowledge-source performance.
  3. **Custom resolutions:** KPIs per custom resolution state.
  4. **Conversation journey:** the path customers take. Not exportable.
- **Filters:** time frame, agent, **conversation source (AI agent vs Testing)**, channel, reply type (use case, knowledge, hybrid), intent, language and label. Views by channel, agent or language, aggregated daily, weekly, monthly or quarterly.
- **Navigation change:** Instructions and Persona moved to *Content > Personalization*. Persona is now split into **Identity, Tone of voice, and Pronoun formality**. Procedures are for custom agents (EAP) [doc]. https://support.zendesk.com/hc/en-us/articles/9971473425434 . Legacy settings (Identity, Persona, Language, Brand & channels) end on 31 Dec 2026.

### 1.7 Retell, Vapi and Synthflow (voice builders)

**Retell agent configuration: global settings panel** [doc]. https://docs.retellai.com/build/conversation-flow/global-setting.md

| Section | Settings |
|---|---|
| Agent | Voice & language (speed, volume), model and temperature, global prompt with presets, transition flexibility |
| Knowledge base & memory | Sources, retrieval controls, contact memory |
| Speech | Background sound, response wait, interruption sensitivity, backchannel, reminder frequency, pronunciation |
| Realtime transcription | Denoise, mode, vocabulary, boosted keywords |
| Call | Voicemail/IVR detection, screening, DTMF, end on silence, maximum duration, ring duration |
| Post-call extraction | e.g. "appointment booked" |
| Post-call memory | Saving to contact memory |
| Security & fallback | Storage and retention, guardrails, secure URLs, fallback voices, default variables |
| Webhook | Event endpoint |

**Synthflow Agent Editor** [doc]. https://docs.synthflow.ai/the-agent-editor
- **Header:**
  - Identity: name (renamable), **version badge**, type and phone number, copyable ID.
  - Drawers: **Actions** (booking, transfer, API, SMS) and **Variables**.
  - Icons: **Version history** (clock: compare and restore) and **Deployment** (globe: numbers and channels).
  - Buttons: **Test** (green: phone, chat or web call, plus simulations) and **Publish** (purple; flow agents must pass an issue checklist first).
- **Main area:** Prompt Builder (greeting and prompt, with tabs for variables and actions) or Flow Designer (a canvas).
- **Right Global Settings panel:** General (language, model, timezone), Voice, Call Configuration (maximum duration, silence, recording, noise), **Business Hours** (weekly hours and after-hours handling), Knowledge & Memory, Security & Compliance (PII redaction), and Additional (STT, interruption, vocabulary).

**Synthflow Analytics** [doc]. https://docs.synthflow.ai/about-the-agent-dashboard
- Time range plus an **All accounts** selector, which shows a table of subaccounts with minutes, calls and average duration.
- Cards: duration metrics, assistant performance (minutes, calls, success rate, prompt reuse), status overview, end reasons, a **Failed calls list** (contact, date, status, duration, agent), executed actions over time, and sentiment over time.
- Data refreshes hourly.

**Synthflow Test Center** [doc]. https://docs.synthflow.ai/simulations
- Suites are tied to one agent and one language. Each suite has 4 base cases plus one per selected scenario, up to 25.
- Each case is a scenario prompt plus success criteria, with "all" or "any" pass logic.
- An auto-created persona plays the caller. Each criterion gets **Passed/Failed with an AI explanation**, and each run has a transcript and audio. A Run History tab is included.
- Transfers and bookings are *simulated* during tests, not executed.

**Synthflow roles** [doc]: Super Admin, Admin (billing, keys, SSO, 2FA enforcement) and Member (core features only). https://docs.synthflow.ai/user-management

**Synthflow agency mode (relevant to the Wyrm staff console)** [doc]. https://docs.synthflow.ai/subaccounts , https://docs.synthflow.ai/llms.txt
- Navigation: *Settings > Partner > Subaccounts*. Search by name or ID, **+ Create** (batch), and import from GoHighLevel.
- New subaccounts inherit **Limits & Capabilities**: included minutes, auto-overage, concurrency, agent allowances and a workflow cap. **Permissions** control which features the client sees.
- **Bulk actions** on selected rows: import a product (an agent, workflow or number template), set permissions, edit limits.
- One analytics view compares subaccounts. White-label custom domain, branding, and **Stripe rebilling** of usage.

**Vapi:** Dashboard 2.0 reorganised the sidebar around frequently used features and added an overview of usage and assistant performance. The editor tab list is not documented publicly (n/f). https://vapi.ai/blog/vapi-dashboard-2-0

### 1.8 SMB receptionists

**My AI Front Desk** [doc]. https://www.myaifrontdesk.com/help/getting-started/dashboard

*Sidebar:*
- Dashboard and **Ask Frontdesk** (an AI helper)
- **AI Workers:** Receptionist, Chatbot, Web Forms
- **Customer Hub:** Call Log Inbox, CRM, Outbound, Calendar, Tickets, Notify Me, Analytics
- Bottom: Settings and **Get Live Help**

*Home:*
- Three 7-day stat cards, each with a daily sparkline: Calls Answered, Texts Sent, and **Revenue Impact** (assumes $25 per call).
- **My AI Agents** cards (inbound and outbound suites).
- **Recent Activity:** the 3 latest items, with View All.
- A right-hand widget showing the **named Customer Success Manager** with photo, a Calendly link, and "Request an Integration".

*Per-agent overview:* "Welcome back", the phone number, **Estimated Time Saved** (7 minutes per call), Calls, Voicemails and Texts cards, and quick links (Edit, Notifications, referral).

*Receptionist page* has two tabs [doc]. https://www.myaifrontdesk.com/help/getting-started/setup-wizard
- **Configure:**
  - A **"Completed X/Y" tracker** (Advanced settings are excluded from the count).
  - Collapsible sections, each badged **Required, Recommended, Optional, Advanced or Enabled**.
  - Sections: Basic (greeting, prompts, business info as text, URL or documents, common questions, languages and voice), In-Call Actions (transfer, text the caller, intake forms, live booking), After-Call Actions (follow-up text, AI summary), Developer Automations (API, Zapier, webhooks), and Advanced.
- **Notifications** (badged Recommended).

*Advanced settings* are cards with **On/Off badges** that open modals [doc]. https://www.myaifrontdesk.com/help/ai-receptionist/advanced-settings
- Model, extension digits, time control rules (start, end, number), recording, call memory, auto-hangup, maximum duration, pronunciation guide, **max usage limit**.
- Spam controls: blocked numbers, bot block phrases, robocall detection.
- **Bypass-to-human numbers** and **Temporary Disable**.

*Inbox* [doc]. https://www.myaifrontdesk.com/help/calls-and-logs/call-logs
- **All Inbox** (calls, voicemails, texts and chats combined) and a Calls tab with a count badge. Search by number, name or content, a date filter, a **"Hide empty calls"** toggle, Refresh, **Mark All Read**, and Download (choose columns; runs in the background and notifies you).
- Rows show name or "Unknown Caller", number, time in your timezone, an In/Out badge, and a **red unread dot**.
- The detail panel has these tabs:
  - **Recording & Transcript:** chat-style; system events such as "text sent" appear centred.
  - **Summary & Analysis:** AI summary, **a 1–5 call score with an explanation**, and Positive/Neutral/Negative sentiment.
  - **Smart Call Analysis:** up to 3 custom classifiers.
  - **Pricing:** call cost and free minutes.
  - **Tickets.**
- Detail actions: Share link and Delete (with confirmation). Infinite scroll, with depth limited by plan.

**Goodcall** [vendor]. https://www.goodcall.com/
- Example panels:
  - "Analytics": Booked 42 (+8), New leads 118 (+15), Handed to you 9 (−3).
  - "Today's calls": each call carries a stage chip (Triage, Qualify, Capture) and a status such as "New caller, buying".
- **Flag and tell**, e.g. "Always offer Sunday too".
- Practice calls during build, and roll back to the last version.
- Lead texts and emails ("New lead from your phone agent: Dana M."), and a booking text to everyone involved.

**Rosie** [vendor]. https://heyrosie.com/features/mobile-app
- A mobile **single inbox** of calls and texts with AI summaries.
- A **push alert for every lead** containing the summary and caller details. **Tapping the alert calls the lead back.**

### 1.9 Cross-cutting gaps (n/f)
- **Mobile apps:** only Rosie is documented as mobile-first. MAFD, Goodcall, Retell, Vapi and Synthflow document web only. MAFD notifications are email toggles (voicemail, text sent, new call). https://myaifrontdesk.com/tutorials/how-to-turn-on-notifications-for-my-ai-front-desk
- **Role matrices:** public only for Ada (Team plus Owner/Admin gates), Synthflow, Retell, and Lindy (earlier file). Fin, Sierra and Decagon: n/f.

---

## 2. Patterns worth copying (evidence to rule)

| # | Pattern | Seen in | Wyrm rule |
|---|---|---|---|
| P1 | Nav follows the improvement loop: Analyze, Train, Test, Deploy | Fin, Ada (Home, Analytics, Convos, Testing, Config), Agentforce (Builder, Testing Center, Observability) | Group navigation by the owner's job, not by data object |
| P2 | Every score has a one-line AI "why" | Fin CX drill-in, MAFD score, Synthflow criterion explanation, Ada AR reasoning | No unexplained number anywhere |
| P3 | Rank by opportunity, not volume | Ada AR opportunity, Fin treemap colour | Sort "Top reasons" by unresolved × share |
| P4 | Correct from inside the transcript | Ada hover-to-coach, Goodcall flag-and-tell, Bland Flag | A "Fix this" button on every agent turn |
| P5 | Reasoning trace placed inline, errors where they happened | Ada tool rows with latency, Agentforce error-in-flow, Sierra Auditing | Show "What Wyrm did" steps collapsed under each reply |
| P6 | Draft, diff, test, release, revert | Ada change sets (word-level diff, % rollout, 90-day revert), Agentforce Commit Version, Synthflow version badge and publish checklist | A plain-English diff before publishing |
| P7 | Exclude test traffic by default | Ada "Include test user" off, Zendesk "source: Testing" | Never count test calls in KPIs |
| P8 | Setup completeness meter with Required/Recommended badges | MAFD Completed X/Y | Use it for onboarding and as the home empty state |
| P9 | Tests assert outcome, action and response separately | Agentforce three pass rates, Synthflow criteria, Decagon assertions | Test result = said the right thing / did the right action / handed off correctly |
| P10 | Side effects simulated in tests | Agentforce Simulate mode, Synthflow simulated bookings | Test runs never create real bookings |
| P11 | A human face on SMB home | MAFD CSM card and Get Live Help | Show the named Wyrm contact on Home |
| P12 | Agency subaccounts: limits and permissions templates, bulk actions, cross-client analytics | Synthflow Partner | The core of the staff console |

---

## 3. Recommended IA: Wyrm customer portal (SMB owners, 1–200 staff)

These recommendations are inferred from the evidence above. They are built around the earlier MUST list, with which they are consistent.

### 3.1 Global shell
- **Left navigation (desktop) or bottom tabs (mobile):**
  1. **Home**
  2. **Conversations**
  3. **To-do** (with a badge count)
  4. **Insights**
  5. **Teach**
  6. **Test & Publish**

  **Settings** sits at the bottom of the nav, with the **"Talk to Wyrm" help link always in the same place** (WCAG 3.2.6).
- **Top bar:**
  - An agent switcher, shown only if the account has more than one agent or location.
  - A **live status pill**: "Live · v12 · answering" in green, "Paused" in grey, or "Problem: phone not connected" in red with an icon and text, not colour alone.
  - A date-range control that persists in the URL.
  - Notifications bell and user menu.
- **Persistent "Try your agent" button** (as in Ada's Test AI Agent). It opens a side panel with chat or a browser call against the *draft*.
- **Shell rules:** one page title plus a one-line "what this page is for" subtitle. A last-updated timestamp on data pages. Skeleton loaders, not spinners.

### 3.2 Home
**Layout, top to bottom:**
1. **Greeting line** plus a plain status sentence, for example: "Your receptionist answered 38 calls this week and booked 11 appointments. 3 things need you."
2. **KPI row, 4–5 tiles:** Calls answered, Bookings (confirmed / awaiting confirmation), Leads and callbacks, Handed to staff, and Plan usage as a meter.
   - Each tile shows a value, a change vs the previous period, an anomaly chip when outside the normal range, and an ⓘ with the exact definition.
   - **Clicking a tile opens Conversations with that filter.**
3. **Needs you** (top 5 To-do items, inline actions) next to a **Recent conversations** list (the 5 latest: outcome chip, summary line, time).
4. **Suggested improvements** (up to 3 cards), e.g. "6 callers asked about parking. Add an answer?", with one action each.
5. **Setup completeness** card (until 100%): "Completed 7/9", with Required and Recommended items.
6. **Your Wyrm contact** card (name, photo, book a call) and a **busiest-hours** mini heatmap.

**Empty states:**
- *Before going live:* the setup checklist takes the whole page, with "Make a test call" as the primary action, and KPIs hidden.
- *Live, no calls yet:* "Your number +44… is live. Calls will appear here within seconds." Offer a "Call it now" action, a sample conversation clearly labelled **Example**, and a link to the forwarding instructions.
- *Quiet week:* "No calls since Tue 14:02." If this happens during business hours it becomes an alert, not a neutral message.

### 3.3 Conversations (list and detail)
**List:**
- A dense table, about 44 px rows:
  - Time
  - Caller (name or number, plus a repeat-caller badge)
  - Channel icon
  - **Outcome chip:** Booked, Lead, Answered, Handed off, Missed / hung up, Spam
  - One-line AI summary
  - Duration
  - Flags such as "upset" or "unanswered question", with icon and text
  - An unread dot
- **Saved views as tabs:** All, Needs review, Bookings, Handoffs, Unanswered questions.
- Filters (date, outcome, flag, staff, agent version), a search box, "Hide empty / spam" (on by default), and CSV export. **Every filter is stored in the URL.** Test calls are excluded unless the "Include tests" toggle is on.

**Detail** (a right-hand drawer at 600 px or wider, otherwise a full page):
- **Header:** caller, time, outcome chip, previous and next arrows.
- **Summary card:** 3 bullets, plus "What Wyrm did" (booked Tue 10:00 for a boiler service and texted confirmation), each action with its status (pending / confirmed / failed).
- **Score with reason:** "Good call: answered pricing and booked" or "Needs review: caller asked twice for weekend hours."
- **Transcript** synced to an audio player (click a timestamp to seek). System events appear centred, e.g. "SMS sent" or "Transfer attempted to 07… (no answer)".
- **"Why it answered" expander** on each agent turn: the sources used (business fact, FAQ, opening hours rule) and the tool called with its result and time. Slow or failed steps are shown inline, as in Ada's "Slow API response 4.3 s". Collapsed by default.
- **Hover actions** on each agent turn:
  - **Fix this answer:** opens Teach with the question pre-filled.
  - **Save as test:** captures the caller's turns and the expected outcome.
- **Sidebar:** contact card (previous calls) and booking card (confirm, reschedule, cancel; never automatic).
- **Footer:** Mark reviewed, Assign to staff, Share link (signed, expiring).
- **Role gating:** recordings are hidden for the Staff role unless allowed (Retell's scrubbed-member model).

### 3.4 To-do (human-in-the-loop queue)
- **Tabs:** Bookings to confirm · Callbacks · Handoffs · Failed actions · Unanswered questions.
- **Each card:** what happened, who, when, the summary, a **primary action** (Confirm / Call back / Mark done), a secondary action (open conversation), and an SLA age chip ("waiting 2 h").
- **Bulk actions** with a confirmation that shows the count (Relevance pattern).
- **Empty state:** "All clear. New items appear here and in your alerts." Show a check icon, with no celebratory animation.

### 3.5 Insights
1. **Top reasons people called:** a table, not a treemap, for SMB readers. Columns: Topic, Calls, % handled fully, % handed off, change vs previous period, plus a sparkline. **Sort by opportunity** (Ada's formula). Expand a row for subtopics and example calls.
2. **Unanswered and knowledge gaps:** grouped questions the agent could not answer, each with a count, sample quotes, and **"Add an answer"**, which opens Teach pre-filled (pattern from Fin Optimize add/edit).
3. **Trends:** a line chart of calls, bookings and handoffs by day, plus a busiest-hours heatmap with a table alternative.
4. **Caller sentiment:** % positive, with reason categories modelled on Fin's six reasons but simplified: answer quality, effort (repeated questions), strong emotion, price objection.

**Empty state** (fewer than about 15 calls, mirroring Fin's threshold): "Insights appear after about 15 calls. You have 6." Show a progress bar.

### 3.6 Teach (knowledge and behaviour)
Sections are collapsible cards with **Required / Recommended / Optional** badges and a completion counter (MAFD pattern):
1. **Business basics:** name, address, service area, phone, website import.
2. **Opening hours and holidays:** a day grid (the repo already has `day-hours.tsx`) and an after-hours behaviour selector.
3. **Services and prices:** a table of name, duration, price or "quote only", and bookable yes or no.
4. **FAQs:** Q and A pairs, plus an "added from conversation" chip linking to the source call.
5. **Rules and guidance:** plain-English rules, for example "Never quote for emergency callouts; take details and hand off." Each rule has a title, an "applies when" field, and "Used in N calls this week". In-place feedback asks "Should this rule have applied here?" (Ada pattern).
6. **Handoff and transfer:** who to transfer to, when, a fallback if no answer, and a voicemail or message-taking script.
7. **Voice and greeting:** greeting text, voice picker with preview, and language.
8. **Suggestions inbox:** AI-proposed additions linked to evidence calls. Accept, edit or dismiss.

Every edit saves to a **draft**, and a sticky banner says "3 unpublished changes · Review & publish".

### 3.7 Test & Publish
- **Try it:** chat, or a browser call against the draft, with a trace panel. Side effects are **simulated**: "Would book Tue 10:00 (not created)".
- **Test set:**
  - List: name, source (manual / from a call / starter pack), and the last result shown as three checks (**said the right thing · took the right action · handed off correctly**).
  - Run all. Each failure explanation is one sentence.
  - The starter pack is required and covers rejected dates and times, corrections, side remarks, and booking confirmation.
- **Review & publish:**
  - A plain-English **diff** of the changes ("Opening hours: Sat 9–13 → 9–14"), the test-run result, then Publish.
  - Publishing is blocked if a Required test fails, with an owner override that asks for confirmation.
- **History:** version, who, when, summary, and a **Restore** button that creates a new version.
- **Agent switch:** Live / Paused, with a reason and an auto-resume time option (MAFD Temporary Disable).

### 3.8 Settings
- **Phone and channels:** number, forwarding status with a live check, and website widget snippet.
- **Team:** invite; roles Owner (billing, delete), Manager (Teach, Publish), Staff (Conversations, To-do; recordings optional); last active date.
- **Notifications:** an event × channel matrix (email / SMS / push), covering new lead, booking awaiting confirmation, handoff, missed during business hours, usage 80% and 100%, and weekly digest. Includes quiet hours.
- **Plan and usage:**
  - A meter of included vs used, the projected month end, and a spam-calls-excluded note.
  - Invoices and a usage cap.
- **Privacy:** recording on/off, retention period, redaction.
- **Audit log:** who changed what and when, read-only.

### 3.9 Mobile
A PWA first, not a native app. The mobile tabs are Home, Conversations, To-do and Alerts. Push notifications for leads and handoffs **with a tap-to-call action** (Rosie pattern). Teach and Test stay desktop-first but remain usable at 320 px.

### 3.10 What makes it feel professional
- **Density:** 13–14 px table text and 44 px rows. Spacing on a 4/8 px scale. Tabular numbers in KPIs and tables. No more than about 6 tiles above the fold.
- **Consistency:**
  - One outcome vocabulary and one colour-plus-icon chip set used everywhere: list, detail, Home, alerts and emails.
  - Identical filter bars on every list.
  - Every metric has the same ⓘ definition pattern.
- **Real-time:** new calls stream in with a subtle highlight. The "Live" pill comes from a real heartbeat. The "Updated 12 s ago" label shows how fresh the data is. No full-page reloads.
- **Explanations:** every score has a reason, every suggestion has evidence, every number can be clicked through, and every destructive action states what will happen.
- **Honesty:** no assumed resolutions (see the earlier Fin trust lesson). Test traffic is excluded, and spam is shown separately from usage.

---

## 4. Recommended IA: Wyrm staff (admin) console

These recommendations are inferred, mainly from Synthflow agency mode and the earlier Retell, Bland and Relevance findings.

**Left navigation:**
1. **Fleet** (home)
2. **Clients**
3. **Conversations** (cross-client)
4. **Quality**
5. **Releases**
6. **Templates**
7. **Billing & usage**
8. **Incidents & alerts**
9. **Staff & access**
10. **Audit**

| Screen | Layout and components |
|---|---|
| **Fleet** | Health table, one row per client agent: client, plan, status (Live / Paused / Setup x/y / Error), calls in 24 h, booking rate, handoff rate, **anomaly chip**, last call, failed actions in 24 h, open To-do age, usage %, and the assigned success manager. Sorted by "needs attention" score. Above the table: tiles for active agents, agents with errors, agents silent during business hours, and clients over 80% usage. Saved views: My clients, Onboarding, At risk. |
| **Clients > Client** | Tabs: Overview (the customer's Home, read-only), Agent config (same Teach UI, with "editing as Wyrm staff" banner), Conversations, Tests, Versions, Usage, Contacts & notes, Settings (limits, permissions/feature flags). **"View as client"** impersonation is read-only by default; write access is time-boxed with a reason, and is audited. |
| **Conversations (cross-client)** | Same table as the portal plus a Client column. Filters: client, flag, failed action, latency > X, version. Defaults to redacted view. |
| **Quality** | Plain-English QA rules (Watchtower-style) run on all calls; review queue with severity, assignee, "turn into test" and "fix in client config"; QA pass rate per client and per template. |
| **Releases** | Templates and platform prompt changes as change sets. Show the diff, run every affected client's test set (results matrix: client × pass/fail), roll out in stages (pilot clients → %), and revert. Mirrors Ada change sets and Decagon CI gating. |
| **Templates** | Vertical starter agents (plumber, salon, clinic): default Teach content, starter test pack, limits/permissions template; "import into client" in bulk (Synthflow Import Product). |
| **Billing & usage** | Per-client minutes vs included, overage, spam excluded, provider cost vs revenue margin, projected month end; bulk edit limits. |
| **Incidents & alerts** | Rules (threshold/relative/plain-language), deliveries (email/Slack/SMS), open incidents with acknowledge/resolve, provider status (telephony, LLM, TTS) and error/latency charts. |
| **Staff & access** | Roles: Admin, Success manager (assigned clients), Engineer (raw logs/traces), Viewer; per-client assignment. |
| **Audit** | Every staff edit, impersonation, publish, export, with reason. |

**Staff-console principles:**
- Exceptions come first.
- Every row links into the same client screens that the customer sees, so staff and client share one vocabulary.
- Tenant isolation is visible: show which client you are acting in at all times, with a coloured client banner.
- Bulk operations are always previewed with a count and diff before they run.
