# Customer-facing dashboards of AI-agent products (2025-2026)

Researched 2026-10-21 using public docs, help-center articles, changelogs and vendor pages. Every claim has a URL. Labels used below: **[vendor]** means marketing copy, **[3p]** means a third-party blog or review, **[forum]** means community or user posts, and **n/f** means no public source was found. Undated docs pages describe the product as of the research date. Treat [vendor] and [3p] claims as unverified.

---

## 1. Per-product notes

### Intercom Fin (support AI agent, mid-market and SMB)
- **Navigation:** The Fin AI Agent area is organised as Train, Test, Deploy and Analyze. The Performance Report sits at *Fin AI Agent > Analyze > Performance Report*, and Recommendations sits at *Analyze > Recommendations* (needs the Pro add-on). https://fin.ai/help/en/articles/13560797-fin-ai-agent-automation-rate , https://www.intercom.com/help/en/articles/11394959-use-ai-powered-suggestions-to-improve-fin-s-content . Tone is set under *Train > Guidance > Basics* [forum]: https://www.intercom.com/help/en/articles/10560969-fin-guidance-best-practices-writing-effective-ai-prompts
- **Overview numbers:**
  - Headline metrics are **Automation rate = Involvement rate x Resolution rate** (example: 50% x 60% = 30%). https://fin.ai/help/en/articles/13560797-fin-ai-agent-automation-rate
  - A 2026 metric update redefined involvement and resolution so that they exclude "Fin Constrained" conversations. Legacy definitions can be toggled on until 3 Aug 2026, and the **weekly digest email** uses the new definitions. https://www.intercom.com/help/en/articles/15599377-update-to-fin-performance-metrics
  - The report template has a top row of **Deflection rate, Resolution rate and CX Score**, plus charts for involvement, answer/escalation/pending rate, assumed vs confirmed resolution, outcomes, a content-performance table and CX ratings with explanations. https://www.intercom.com/help/en/articles/7837533-fin-ai-agent-reporting
- **Conversations:** The content-performance counts are not clickable. To find the underlying conversations, Intercom says to ask its AI ("Operator"). https://www.intercom.com/help/en/articles/7837533-fin-ai-agent-reporting . Topics Explorer, a Pro add-on, groups conversations by topic and shows automation rate per topic. https://fin.ai/help/en/articles/13560797-fin-ai-agent-automation-rate , https://community.intercom.com/customer-success-stories-104/stop-guessing-use-topics-explorer-to-upgrade-fin-fast-13313
- **Teaching:**
  - **Guidance** is written in natural language, and Intercom recommends a descriptive title for each item. Guidance can be targeted to audiences. https://www.intercom.com/help/en/articles/10560969-fin-guidance-best-practices-writing-effective-ai-prompts , https://www.intercom.com/changes/en/90847-target-fin-guidance-using-audiences
  - **AI suggestions (Optimize/Recommendations)** compare Fin's failed answers with human replies and flag missing, duplicate or contradictory content. Each suggestion links to the conversations that triggered it, and the user accepts, edits or rejects it. Suggestions appear only after Fin is live. https://www.intercom.com/help/en/articles/11394959-use-ai-powered-suggestions-to-improve-fin-s-content , https://www.intercom.com/help/en/articles/11390088-optimize-fin-instantly-with-the-help-of-ai
- **Handoff:** Escalation is driven by default behaviour plus Escalation Rules (data-driven), Escalation Guidance (natural language) and Workflows. Fin never offers escalation twice in a row, and a custom handover message can be set. https://www.intercom.com/help/en/articles/12396892-how-to-automatically-escalate-conversations
- **Testing:**
  - **Previews** are manual chats. They appear in the inbox but are excluded from reports.
  - **Batch tests** cover up to 50 questions, each rated Good, Acceptable or Poor, with CSV export. Questions can come from past conversations, by topic.
  - **Simulations** use an AI customer to test a Procedure end to end against success criteria. Intercom recommends running them before every Procedure launch.
  - Sources: https://www.intercom.com/help/en/articles/14077180-simulations-vs-batch-tests-vs-previews , https://www.intercom.com/help/en/articles/10521711-test-fin-ai-agent
- **On/off and versioning:** Fin is deployed through Workflows that are set live or paused. A user reported that pausing takes effect with a lag [forum]: https://community.intercom.com/fin-product-area-5/index62.html . No public Fin version history or rollback was found (n/f).
- **Roles:** Batch tests require a full seat with "All conversations" access. https://www.intercom.com/help/en/articles/10521711-test-fin-ai-agent . No full role matrix was found (n/f).
- **Notifications:** Weekly digest email. https://www.intercom.com/help/en/articles/15599377-update-to-fin-performance-metrics . QA Monitors and scorecards now live in the inbox [3p]: https://releases.sh/intercom.md
- **Billing:** About $0.99 per outcome, with a 50-outcome monthly minimum on standalone plans [3p]. https://www.getmacha.com/blog/intercom-pricing-explained , https://dev.to/omar_bni_f6856a8bb0e021e9/intercom-fin-pricing-in-2026-the-real-math-behind-099-62j
- **Confusion signal:** The "assumed resolution" rule (no customer reply for 24 hours counts as resolved) is widely distrusted. One user re-audited a reported 40% resolution rate and found it closer to 12.5% [forum]. https://community.intercom.com/fin-product-feedback-member-group-49/fin-s-flawed-resolution-assumption-10516 , https://community.intercom.com/ask-the-intercom-team-about-fin-54/fin-s-flawed-assumed-resolved-pricing-design-8929

### Sierra (enterprise)
- **Product areas:** Agent Studio (Journeys, Knowledge, Simulations) and Insights (Reporting, Explorer, automated tagging, Monitoring, Auditing, Alerting). Ghostwriter is an agent that builds agents from plain English. https://sierra.ai/product/agent-studio , https://sierra.ai/product/insights , https://sierra.ai/jp/product/ghostwriter
- **Overview numbers:** Reporting tracks CSAT and case resolution, and clicking any data point opens Explorer on that trend. https://sierra.ai/product/insights
- **Conversations and insight:** **Explorer** answers natural-language questions with analytics, sample conversations and recommendations. **Auditing** shows the reasoning behind each agent action, including the knowledge and systems it used. https://sierra.ai/product/insights
- **Teaching:** Knowledge flags gaps and can draft articles from how human reps resolved edge cases. https://sierra.ai/product/agent-studio
- **Testing:** AI simulations, regression suites run before releases, and Voice Sims that test noise and different speakers. https://sierra.ai/product/agent-studio
- **Versioning:** Workspaces give each person a private editing space. Changes are auto-versioned, bundled into numbered snapshots, and promoted through QA, staging and production, with rollback available. Merge conflicts are surfaced, and simulations or Dev Chat can be run before merging. Sierra says complex workflows and release management still need code. https://sierra.ai/blog/workspaces , https://sierra.ai/blog/agent-studio-2-0
- **Alerts:** Always-on review and alerting for abuse attempts and performance drops. https://sierra.ai/product/insights
- **Roles and billing:** n/f. Pricing is outcome-based "agents as a service". https://sierra.ai/de/blog/agents-as-a-service

### Decagon (enterprise)
- **Product areas:** AOPs (Agent Operating Procedures), Testing & QA, Versions, Watchtower, Insights & Reporting, Experiments. https://decagon.ai/modules/decagon-platform
- **Overview numbers:** CSAT and deflection broken down by AOP and subtopic, knowledge-article performance (top references, click-through), and voice-of-customer themes over time. https://decagon.ai/product/insights-and-reporting
- **Insights tools:**
  - Heatmaps highlight metric spikes and dips, with adjustable sensitivity.
  - Journey diagrams show where conversations drop off.
  - Filters cover channel, escalation flag and CSAT.
  - **Duet** answers natural-language questions such as "Why are customers requesting refunds?"
  - Diagnostics offer "prescriptive insights" for revisions.
  - Source: https://decagon.ai/product/insights-and-reporting
  - Generative Analytics (Sept 2026) lets teams ask any analytics question. https://decagon.ai/blog/generative-analytics
- **Teaching:** AOPs are natural-language procedures that CX teams edit directly, with code guardrails behind them. https://decagon.ai/blog/from-sops-to-agent-operating-procedures , https://decagon.ai/modules/decagon-platform
- **QA:** **Watchtower** reviews every conversation, AI or human, against flag criteria written in plain English (for example "mentions of frustration"). Flags include abandoned chats, upsell chances, regulated complaints and negative sentiment. https://decagon.ai/blog/decagon-watchtower , https://decagon.ai/product/watchtower , https://decagon.ai/modules/watchtower-qa
- **Testing and rollout:** **Experiments** run A/B tests on AOP logic, tone, knowledge or tools against a control group, with traffic ramped up gradually, measured on CSAT and deflection. https://decagon.ai/blog/introducing-experiments-ab-testing , https://decagon.ai/product/experiments
- **Roles, billing, notifications:** n/f. Developer docs are gated [3p]: https://providers.apievangelist.com/providers/decagon/

### Retell AI (voice platform, developer-leaning)
- **Analytics dashboard:**
  - The default view shows call counts, duration, latency, concurrency, call-successful, disconnection reason, user sentiment, and inbound vs outbound.
  - Up to 10 custom dashboards per workspace, with column, bar, line, donut and number charts.
  - Charts can be broken down by agent or agent *version* and compared with the previous period.
  - Combined cost is available as a metric.
  - Source: https://docs.retellai.com/features/analytics-dashboard.md
- **Call history:**
  - Columns are configurable. Filters cover agent and version, outcome, sentiment, disconnection reason, latency, cost and extracted fields.
  - **Filters persist in the URL**, so a filtered view can be shared.
  - The detail panel shows analysis, summary, and a transcript where clicking a timestamp seeks the recording. It also shows the contact's previous calls and an "open in playground" option.
  - CSV export runs in the background and is kept for one week.
  - Source: https://docs.retellai.com/features/session-history.md
- **Post-call analysis:** Sentiment, success, summary and custom extracted fields. https://community.retellai.com/t/lesson-21-call-analysis-post-call-insights/2939
- **AI QA:**
  - Cohorts plus resolution criteria. Tracks hallucination rate, sentiment shifts and tool accuracy.
  - The first 100 minutes are free.
  - Sources: https://www.retellai.com/nl/changelog/ai-qa-analyst-custom-alert-notifications-node-search-and-everything-else-from-this-month , https://docs.retellai.com/ai-qa/overview.md
- **Testing:** LLM Playground (manual or AI-simulated user), simulation tests graded against criteria, and batch runs for regression. Its "Conductor" agent drafts test cases from real calls. https://docs.retellai.com/test/test-overview.md
- **Versioning:**
  - A draft becomes a read-only published version (V0, V1 and so on).
  - Environment tags point phone numbers at a version. "Rollback" means moving the tag back to an earlier version.
  - Source: https://docs.retellai.com/agent/version.md
- **Roles:** Admin (billing, members), Developer (build, raw logs, API keys), and Member (read-only, *scrubbed* history, no raw recordings). https://docs.retellai.com/accounts/access-control.md
- **Alerts:**
  - Metrics: call volume, success rate, negative-sentiment rate, function latency and failures, transfer failures, QA not passed, cost, and API errors.
  - Thresholds can be absolute or relative ("vs last cycle").
  - Delivery by email with a matching "resolved" email, or by signed webhook.
  - Limit of 10 rules per workspace.
  - Source: https://docs.retellai.com/features/alerting-overview.md
- **Billing:**
  - Shows credit balance, buy credits and auto-recharge. The Usage tab shows total cost, minutes, average cost per minute, and cost by provider.
  - Monthly budget cap with emails at 80% and 100%. At 100%, calls pause.
  - Source: https://docs.retellai.com/accounts/billing.md

### Vapi (voice platform, developer)
- **Dashboard 2.0:** Overview shows "essential usage data and assistant performance metrics", alongside the Call Logs page with CSV export. https://vapi.ai/blog/vapi-dashboard-2-0
- **Call logs:**
  - Columns: assistant, version, numbers, type, ended reason, duration and cost.
  - Per-call tabs: Transcript (click to seek), Logs (download as JSONL), Analysis (summary and success evaluation), Structured Outputs, Messages, Cost breakdown and Latency.
  - Source: https://docs.vapi.ai/observability/logs/call-logs.md
  - Sharing a view-only call log with clients is not possible [forum]: https://support.vapi.ai/t/27550183/call-logs
- **Boards:** Drag-and-drop KPI tiles plus bar, line and pie charts. Formula mode builds metrics such as success rate and cost per call. https://docs.vapi.ai/observability/boards-quickstart
- **Testing:** Simulation suites pair scenarios with personalities. Chat mode is cheaper and faster, and voice mode is meant for final validation. A fixed bug should get its own regression simulation. https://docs.vapi.ai/observability/simulations-overview , https://docs.vapi.ai/observability/simulations-manage
- **Versioning:** Each user edits a draft. Publishing creates a version, history is kept, and restore creates a new current version. Traffic can be split across versions for canary releases. Inbound calls always use the published version. https://docs.vapi.ai/assistants/versioning/llms.txt
- **Roles:** Editor and Admin [forum, inconsistent]. https://support.vapi.ai/t/23431872/members

### Bland AI (voice, developer to enterprise)
- **Call logs:**
  - Quick filters: Full Conversations, Voicemails, Assigned to Me, Warm Transfers, Unassigned. Time range goes up to 30 days.
  - Filters can be saved, are shared org-wide, and live in the URL.
  - Detail view has three modes: Transcript, per-turn Detail, and Logs.
  - The waveform marks decisions and extractions, and there is auto-play-next.
  - Hovering over a message offers **Flag**, **Edit node** and **Testbed**.
  - CSV export (up to 180 days) is emailed.
  - Source: https://docs.bland.ai/tutorials/call-logs
- **Issues and triage (Apr 2026):**
  - Flagging a call opens an issue with severity and assignee. Evidence is attached automatically.
  - "Norm Fix" finds the root cause, patches a *draft* pathway, and verifies it in a testbed.
  - Source: https://docs.bland.ai/changelog/04_30_2026
- **Natural-language analytics:** The Norm assistant answers questions such as "Transfer rate by pathway over the last 30 days, as a bar chart". Norm edits drafts only, and a change goes live when the version is linked. https://docs.bland.ai/tutorials/norm
- **Dashboards and alerts (Apr 2026):**
  - AI panel generation from a text description.
  - Alerts use thresholds or **plain-language conditions**, with severity levels and lookback windows from 10 minutes to 24 hours.
  - Delivery by email, phone or custom tool.
  - Source: https://docs.bland.ai/changelog/04_30_2026
- **Other:** A version column in logs, GitHub sync for pathways, and knowledge-base gap detection. https://docs.bland.ai/changelog/11_10_2024.md , https://docs.bland.ai/changelog/11_17_2025.md
- **Billing:** Per-minute rates by plan (Start $0.14, Build $0.12, Scale $0.11), with a billing dashboard. https://docs.bland.ai/platform/billing.md

### Lindy (SMB and prosumer agents)
- **Teaching and approvals:**
  - An "Ask for confirmation" toggle on actions with side effects (send email, update record, create event). The agent waits, and the user approves by email or in the task menu.
  - Source (search snippet; the page has since been reorganised): https://docs.lindy.ai/testing/human-in-the-loop.md
  - Users can now give plain-language feedback such as "don't flag X", and Lindy learns from it. https://docs.lindy.ai/testing/human-in-the-loop.md
- **Usage:**
  - Credits are spent per task. Hovering over a task step shows its credits, and a gauge shows usage for the billing cycle. Agents pause when credits run out. https://docs.lindy.ai/account-billing/credits
  - Per-member credit column and admin-set limits. Lindy pauses and asks in Slack when a task draws "significantly more than usual". https://docs.lindy.ai/account-billing/usage.md
- **Roles:** Member, Admin and Owner. Only the Owner handles payment and can delete the workspace. https://docs.lindy.ai/start-here/team-setup.md
- **Phone:** Get a number, preview voices, and set rules for "when others call" (take a message, book a meeting, require a PIN). Test by calling it. https://docs.lindy.ai/features/phone-line.md

### Relevance AI (agent workforce)
- **Analytics** (Enterprise):
  - KPIs: **Tasks, Tasks to Review, Actions Used, Credits Used**, each with % change vs the previous period.
  - Breakdowns by agent, workforce and action, including error rate and credits per task.
  - Source: https://relevanceai.com/docs/enterprise/analytics
- **Task Operations page:**
  - Tabs: **Approvals, Escalated, Errors, All tasks**.
  - Bulk approve, reject or rerun, with a confirmation modal that shows the count affected.
  - Source: https://relevanceai.com/docs/build/agents/give-your-agent-tasks/tasks-page
- **Approval rules:** Written in plain English. Supports cost-based pauses and autonomy step limits. https://relevanceai.com/approvals-escalations , https://relevanceai.com/features
- **Escalations:** The user gets a notification, reads the agent's reason, then gives guidance or takes over. https://relevanceai.com/docs/build/workforces/workforce-features/workforce-task-view.md

### Voiceflow (builder platform)
- **Analytics widgets:** Resolved conversations, unique users, latency, credits, cost breakdown, cost per conversation, usage of playbooks, workflows, tools and KB docs, a card per evaluation, and (voice) total calls and minutes. Filters cover environment and date, with drill-down. https://www.voiceflow.com/docs/documentation/measure/analytics.md
- **Transcripts:** Recordings, logs and evaluation scores. Filters include evaluation result, credits and duration, and evaluation results can be added as columns. https://www.voiceflow.com/docs/documentation/measure/transcripts.md
- **Evaluations:** LLM-scored criteria. CSAT, deflection and resolution are included by default. https://www.voiceflow.com/docs/documentation/measure/evaluations.md
- **Versioning:** Each environment has an auto-saving draft. Publish promotes it. Version history records the number, description, author and time. Revert adds a new entry and affects only that environment. Only admins and owners can publish a protected environment. https://www.voiceflow.com/docs/documentation/deploy/environments/version-history , https://www.voiceflow.com/docs/documentation/deploy/environments/publishing

### Zendesk AI agents
- **Dashboard tabs:**
  - **Conversations:** total, understood, assisted and unassisted escalations, automated resolutions, verified and contained resolution rate.
  - **Satisfaction:** BSAT, rating requested, rating given.
  - **Use cases** and **Knowledge:** performance of each.
  - Filters include agent, channel, language, use case and stage.
  - Source: https://support.zendesk.com/hc/en-us/articles/11046706190746-Understanding-the-AI-agents-dashboard-in-analyst-copilot-EAP , https://support.zendesk.com/hc/en-us/articles/10346309894938-Analyzing-activity-for-AI-agents-Essential
- **Agents list:** Shows name, status, channel, volume and automated resolutions per agent, with a Reporting link. The legacy Essential bot builder ends on 10 Dec 2026. https://support.zendesk.com/hc/en-us/articles/6970583409690-About-AI-agents
- **Billing:** Per automated resolution [3p]. https://www.eesel.ai/blog/zendesk-ai-agent-review

### SMB AI receptionists
- **Goodcall:**
  - The dashboard tracks owner-defined outcomes such as "booked", "new leads" and "handed to you". Each call has a recording and transcript, and owners can **flag a call and tell the agent what to change**.
  - Lead details are sent by SMS and email after each call.
  - Before changes go live, the agent runs **practice calls**, and owners can **roll back to the last version**.
  - Priced per customer helped, not per minute, from $79/month.
  - Source [vendor]: https://www.goodcall.com/
- **Smith.ai:** The call dashboard shows call history, caller type, disposition, contact, summary and actions taken (for example, an appointment booked), with suggested next steps. Summaries can sync to HubSpot. Sources [3p/vendor]: https://ecosystem.hubspot.com/marketplace/apps/smith-ai , https://techpoint.africa/guide/smith-ai-review/ . One complaint: robocall spikes pushed a customer to a higher tier [review]. https://g2.com/products/smith-ai-ai-receptionist/reviews?page=2
- **Rosie:**
  - Mobile-first. A **unified inbox** of calls and texts, an AI summary and transcript for each, and push alerts for every lead with one-tap callback. https://heyrosie.com/features/mobile-app
  - Text and email alerts are included on all plans. https://heyrosie.com/partnerships/home-depot
  - From $49/month [3p]: https://www.capterra.com/p/10034390/Rosie/
- **My AI Front Desk** (comparable): Weekly call volume, busiest-hour heatmap, average duration, and link clicks from texts. https://www.myaifrontdesk.com/tutorials/analytics-dashboard

---

## 2. Synthesis

### Common patterns
1. **The outcome rate is the hero number.** Each product puts one outcome rate first: resolution or automation (Fin, Zendesk), deflection or CSAT (Decagon, Sierra), call success (Retell, Vapi), or tasks (Relevance). SMB receptionists use business outcomes instead (booked, leads, handed to you; Goodcall). Sources: the Fin, Zendesk, Retell and Goodcall links above.
2. **A conversation list with a filtered table, a detail drawer, and a transcript synced to the recording** is universal (Retell, Vapi, Bland, Voiceflow). Filters live in the URL so views can be shared (Retell, Bland).
3. **Teaching happens in plain language:** Guidance (Fin), AOPs (Decagon), Journeys (Sierra), "tell Gabi what to change" (Goodcall). This is paired with **AI-suggested fixes linked to the conversations that triggered them** (Fin Recommendations, Sierra Knowledge gaps, Bland Norm Fix, Decagon diagnostics).
4. **The workflow is draft, test, publish, then restore.** Every builder separates a draft from a live version (Retell, Vapi, Voiceflow, Sierra, Bland). Tests escalate from a manual preview, to a batch of questions, to an AI-simulated caller graded against criteria (Fin, Retell, Vapi, Sierra).
5. **Human-in-the-loop queues:** Approvals, Escalated and Errors tabs (Relevance), plus confirm-before-side-effect toggles (Lindy).
6. **Alerts are threshold- or plain-language-based.** Delivery is by email, webhook or phone, and Retell also sends a "resolved" message (Retell, Bland).
7. **Cost visibility:** credit or balance gauges, cost per call, budget caps with 80%/100% emails (Retell, Lindy, Voiceflow).

### What confuses non-technical SMB owners (evidence plus inference)
- **Opaque success definitions.** "Assumed resolution" inflates numbers, and owners discover this by auditing conversations themselves [forum, Intercom links above]. Changing the denominators confused even mid-market admins (Intercom ran a legacy toggle for months).
- **Developer vocabulary:** latency p90, concurrency, disconnection reasons, pathways, nodes, environment tags (Retell, Vapi, Bland). These products target builders. *Inference:* an SMB owner asks "did it book the job?", not "what was end-to-end latency?"
- **Setup and integrations are the top pain point in reviews**, for example "Not a do it yourself system" for Zapier-based setups. https://www.capterra.co.za/software/1058492/my-ai-front-desk . Wrong CRM record matching and confused older callers also come up. https://community.getjobber.com/discussions/operations-forum/ai-receptionist-vs-outsourced-vs-owners/7842/replies/7887
- **Surprise costs** from robocalls and overage tiers. https://g2.com/products/smith-ai-ai-receptionist/reviews?page=2 , https://www.g2.com/products/ringcentral-ai-receptionist-air/reviews
- **Dead ends.** Report numbers that cannot be clicked through to conversations (Fin content table, cited above).
- **Gated features.** Key insight tools sit behind add-ons (Fin Topics Explorer and Recommendations need Pro).

### What makes a dashboard feel "smart"
- **Proactive suggested fixes linked to evidence** (Fin Recommendations, Bland Norm Fix, Sierra knowledge-gap drafts, Decagon diagnostics).
- **Natural-language questions about the data** (Sierra Explorer, Decagon Duet, Bland Norm, Intercom asking Operator to find conversations).
- **Anomaly and threshold alerts** (Retell relative "vs last cycle", Bland trend-based plain-language conditions, Decagon heatmap spikes, Lindy "more than usual" pauses).
- **Always-on QA against plain-English criteria** (Decagon Watchtower, Retell AI QA, Voiceflow evaluations).
- **Click a number to see why** (Sierra: any data point opens Explorer; Retell/Bland URL-encoded filters).
- **Turning a real failure into a regression test** (Bland scenario from call log, Retell Conductor, Vapi regression simulation, Fin batch from past conversations).

### Accessibility basics (WCAG 2.2 AA) for dashboards
- **New in 2.2 at A/AA** (https://www.w3.org/WAI/standards-guidelines/wcag/new-in-22/):
  - 2.4.11 Focus Not Obscured: sticky headers and drawers must not hide focus.
  - 2.5.7 Dragging Movements: drag-to-reorder widgets needs buttons as an alternative.
  - 2.5.8 Target Size: at least 24x24 CSS px. Table row actions and chart toggles often fail this.
  - 3.2.6 Consistent Help: help or contact links stay in the same place on every page.
  - 3.3.7 Redundant Entry: don't make users re-type business details during onboarding.
  - 3.3.8 Accessible Authentication: no cognitive puzzles; allow paste and password managers and magic links.
  - 4.1.1 Parsing was removed.
- **Charts:** Give each chart a short text alternative plus the long data, ideally as a real data table next to the chart. https://www.w3.org/WAI/tutorials/images/complex/ , https://clemson.edu/accessibility/digital/concepts/complex-images.html
- **Carried over from 2.0/2.1 (general WCAG knowledge, not separately sourced here; https://www.w3.org/TR/WCAG22/):**
  - 1.4.1 Use of Color: don't show good/bad with red/green alone; add an icon or text.
  - 1.4.3 and 1.4.11 contrast: 4.5:1 for text and 3:1 for chart lines and focus rings.
  - 1.4.10 Reflow at 320 px wide.
  - 2.1.1 Keyboard: the transcript player, filters and drawers must be fully keyboard-operable.
  - 4.1.3 Status Messages: announce "Saved", "Test passed" and new-alert messages through `role="status"` or `aria-live`.
  - 1.2.x: call recordings need a transcript, which you already have.
  - 2.2.1 Timing Adjustable for auto-refresh; 2.3 avoid flashing.
- **Glanceability (design, not WCAG):** One primary KPI visible within about 5 seconds; plain bar and line charts rather than exotic ones; related metrics grouped together. https://www.aufaitux.com/blog/good-dashboard-design/ , https://echai.ventures/startingup/product-design-ux/how-do-i-make-a-data-heavy-dashboard-readable-instead-of-an-overwhelming-wall-of-numbers

---

## Recommendation for Wyrm AI customer portal

These recommendations are for SMB owners with 1-200 staff who are not technical, on a free tier, and with the receptionist/booking agent at the core. They are inference built on the evidence above.

### MUST HAVE (ranked)
1. **Calls and conversations list** with search, filters (date, outcome, needs-attention) kept in the URL, and a detail drawer showing the AI summary, outcome, transcript synced to the recording, and actions taken such as a booking created (Retell, Bland, Smith.ai, Rosie).
2. **Honest outcome numbers with plain definitions.** Each tile has an "i" with the exact rule and links to the filtered list behind it. No hidden "assumed" counting (the Intercom trust lesson).
3. **"Fix this answer" on any transcript turn.** It turns into a business fact, FAQ or rule in plain language, which the owner previews before saving (Goodcall flag-and-tell, Fin guidance, Bland Flag).
4. **Needs-attention queue:** handoffs, callback requests, unconfirmed bookings and failed actions, with clear owner actions (Relevance Approvals/Escalated/Errors). This respects explicit booking confirmation.
5. **Instant lead and handoff notifications** by email (and SMS later) after each call (Goodcall, Rosie).
6. **Test before going live.** A "Try it" chat or call plus a saved set of test questions rerun after every change (Fin preview and batch, Goodcall practice calls).
7. **Agent on/off switch, with publish and restore of the previous version** (Goodcall rollback, Vapi restore, Voiceflow revert).
8. **Usage and plan meter** showing minutes or calls used vs included, the projected month-end, and an 80% warning (Retell, Lindy).
9. **Roles:** Owner (billing), Manager (edit agent), Staff (view calls; recordings optional) (Retell's scrubbed Member, Lindy's Owner-only billing).
10. **WCAG 2.2 AA basics** as listed above.

### NICE TO HAVE
- A weekly digest email with the top numbers and the top 3 suggested fixes (Fin digest).
- Natural-language "Ask your data" for simple questions (Bland Norm, Sierra Explorer).
- Plain-English QA flags such as "caller sounded upset" or "asked for a price we don't list" (Decagon Watchtower).
- Topic clusters ("Top reasons people called").
- Repeat-caller and contact history in the detail drawer (Retell contact panel).
- Saving a bad call as a regression test (Bland, Vapi).
- CSV export.
- Busiest-hours heatmap (My AI Front Desk).

### SKIP FOR NOW
- Custom drag-and-drop dashboard builders (Vapi Boards, Retell custom dashboards).
- Latency, concurrency and p90 charts and per-provider cost breakdowns.
- A/B experiments and traffic splitting (Decagon, Vapi).
- GitHub sync and multi-environment staging.
- Flow or node editors.
- Per-turn debug logs and packet capture.
- Enterprise analytics tiers.

### Recommended navigation (6)
1. **Home:** today, this week, needs attention.
2. **Calls:** conversations and transcripts.
3. **Inbox / To-do:** handoffs, callbacks, bookings to confirm.
4. **Teach:** business info, FAQs, rules, suggested fixes.
5. **Test & Publish:** try it, test questions, on/off, history and restore.
6. **Settings:** team and roles, notifications, phone number, plan and usage.

### Overview page: top numbers (pick 5-6)
1. **Calls answered** (with % of all inbound and missed/after-hours captured).
2. **Bookings made** (confirmed vs pending confirmation).
3. **Leads captured / callbacks requested**.
4. **Handed to a person** (count and rate, with a link to the reasons).
5. **Needs your attention** (open items, clickable).
6. **Plan usage** (minutes or calls used vs included, plus month-end projection). Optional: estimated time or cost saved, with the assumptions stated.

### 5 cheap "smart" features for a free tier
1. **Week-over-week change chips with simple anomaly flags.** Compare to the trailing 4-week mean and flag if outside about 2 SD or ±30%, for example "Calls up 45% vs usual Tuesday". This is SQL only, with no LLM needed (pattern from Retell's relative alerts and Decagon's heatmaps).
2. **Unanswered-question detector.** Tag turns where the agent said "I'm not sure" or handed off, group them by keyword or embedding, and show "5 callers asked about parking. Add an answer?" with one-click into Teach. This needs one small LLM call per call at post-processing time (pattern from Fin Recommendations and Sierra knowledge gaps).
3. **Post-call summary, outcome label and plain-English flags** generated once per call by the LLM you already use and stored for search, such as "upset caller" or "price question". Show the reason, not only the score (pattern from Decagon Watchtower and Retell analysis).
4. **"Turn this call into a test."** Save a transcript's caller turns plus the expected outcome to the test set, and rerun the set before publish (pattern from Bland, Vapi and Fin batch).
5. **Threshold alerts and weekly digest by email:** no calls answered in X hours during business hours, 80% of plan used, handoff rate spike. Run them from a cron or scheduled function with a free email tier (pattern from Retell alerts and budget emails, and the Fin weekly digest).

Deliberately not on the free-tier list: free-form natural-language Q&A over data. It is higher cost and higher risk; ship it later, constrained to pre-defined query templates.
