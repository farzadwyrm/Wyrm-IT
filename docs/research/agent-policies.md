# How AI customer-agent products let BUSINESS users define policies, rules and procedures (2025-2026)

Researched 2026-10-21 from public docs, help centres, changelogs and vendor pages. Companion to `agent-dashboard-products.md`, which covers dashboards, metrics, testing UIs and versioning at a high level. This file adds depth on the **policy-authoring model** and does not repeat those notes. Labels: **[docs]** official help or docs, **[vendor]** marketing copy, **[3p]** third-party, **[forum]** user posts, **n/f** no public source found. Quotes are short paraphrases unless they appear in quotation marks.

---

## 1. Per-product notes

### Intercom Fin. The most complete published model for business users

Fin has four separate editable objects: **Guidance**, **Escalation rules and guidance**, **Procedures** (which replaced "Fin Tasks"), and **Data connectors**. Audiences are a reusable scope object shared across all of them.

**Guidance (plain-language rules)** [docs] https://www.intercom.com/help/en/articles/10560969-fin-guidance-best-practices-writing-effective-ai-prompts
- **Categories:** Communication style, Context and clarification, Content, Escalation (now its own page under *Train > Escalation*), and Other.
- **Limits:** At most **100 active guidance items** per workspace. Intercom suggests merging related rules. No per-rule character limit is stated.
- **Evaluation:** Each rule is evaluated separately at every turn. Guidance **cannot chain or trigger other guidance**, and guidance checks run *before* Fin searches content. Guidance cannot control UI elements such as buttons.
- **Scope:** Rules are targeted by **Audience**. Non-matching guidance is hidden from Fin entirely, which avoids conflicts. Channel-specific rules (for example, a length cap for social channels) are done through an audience built on channel. User attributes can be interpolated, for example "Address the user by name: `{user_name}`".
- **Conflict handling:** Manual. Intercom says to "review active guidance to remove contradictory or redundant rules". Per-turn debugging shows how Fin evaluated each rule, in the conversation events panel opened with Cmd/Ctrl+E.
- **Guidance vs Procedures:** Guidance is for single-turn behaviour. Multi-step processes that must be followed precisely, such as refunds, belong in Procedures.
- **Example rule text:** "Never mention that a competitor may have higher conversion rates…" and "Escalate when a customer mentions refunds."
- **Versioning (Apr 2026):** Each saved change records its author and timestamp, plus an optional note on why it changed. A past version can be loaded back into the editor before re-saving. Snapshots keep the **channel and audience settings in force at the time**. https://www.intercom.com/changes/en/141617-version-history-for-fin-guidance , https://fin.ai/updates/guidance-versioning
- **Audience targeting:** Added May 2025. https://www.intercom.com/changes/en/90847-target-fin-guidance-using-audiences . Since Oct 2025, Audiences are defined once and reused across Content, Guidance and Data connectors, and filters plus batch tests preview what each audience sees. https://www.intercom.com/changes/en/page/10

**Escalation** [docs] https://www.intercom.com/help/en/articles/12396892-how-to-automatically-escalate-conversations

Escalation runs on three layers.
1. **Default behaviour.** Fin always escalates on an explicit request for a human, strong frustration, or a loop.
2. **Escalation Rules.** These are structured conditions on data:
   - Fin attributes such as Sentiment and Issue Type.
   - User and company data, conversation data such as order total, or custom attributes such as VIP.
   - Each rule has an **Audience** and **Channels** setting. No channels selected means all channels, including voice.
   - "Ask for input" (human-in-the-loop, beta): Fin holds its answer and asks a teammate, with a threshold, an assignee and a time limit.
3. **Escalation Guidance.** Natural language that can escalate, offer escalation, ask questions first, or *prevent* escalation. Examples: escalate on frustration words such as "ridiculous"; offer a human when the same question is asked twice; escalate when a competitor is mentioned. Only **one applied guidance item is used per response**.

Rules and guidance override the defaults. Rules and guidance decide *when* to escalate, and Workflows decide *where* the conversation goes. Workflow branches can condition on which guidance applied. Intercom does not document which wins when a rule and a guidance item conflict (n/f).

**Procedures** [docs] https://intercom.com/help/en/articles/13449439-building-fin-procedures , https://www.intercom.com/help/en/articles/12599460-practical-examples-of-fin-procedures
- **Trigger.** A "When to use this procedure" description of up to 256 characters, with inclusion and exclusion criteria plus "When to use" and "When NOT to use" example conversations. Fin starts a procedure only when it is confident the intent matches.
  - Example: include when the customer "describes a specific technical problem or error"; exclude when "requesting a new feature".
  - "Agentic Switch" uses trigger descriptions to move a customer between live procedures.
- **Step types:**
  - Instruction (natural language, the default).
  - Condition (IF/ELSE IF/ELSE).
    - A condition is either *natural language* or *code* (Python), never both in one step.
    - Conditions cannot be nested.
    - Date and decimal attributes cannot be referenced in conditions.
  - Run sub-procedure (local to its parent procedure).
  - Handoff to workflow (does not return to the procedure).
  - End (with an end message and options).
  - Ask Teammate (pauses for a human; escalates on timeout).
  - Inside steps, via the `@` menu: Call data connector, Read attribute, Update attribute, Handoff to team, Handoff to ticket, Wait for webhook (beta).
- **Sections** organise steps. Fin runs steps top to bottom unless told "Go to section". Steps can also carry per-procedure Guidance. **Workspace guidance does not apply inside a procedure unless selected.**
- **Required info.** What Fin asks the customer for (for example an Order ID) comes from the **data connector's input schema, not the prose**. Intercom recommends a Condition after *every* connector call to handle errors and empty results.
- **Examples:**
  - Refund: a code condition checks eligibility. If eligible, Fin offers a pause as an alternative, then refunds on confirmation, with funds arriving in 7–14 days. If ineligible, Fin tags the conversation, offers cancellation, and escalates.
  - **Limit-based approval:** "If refund > 500, Ask Teammate; otherwise process automatically."
  - Cancellation: a natural-language condition checks whether the order was fulfilled.
- **Authoring aids:** "Let AI draft" from a description of up to 5,000 characters. An "AI-powered procedure review" before going live flags instructions Fin may not reliably follow. The writing heuristic is "Think of Fin as a new teammate with no prior context."
- **Testing.** Preview shows the customer view; using it on a live procedure can expose real customers. **Simulations** run with mock connector data and success criteria, and the user then clicks "Set live".
- **Lifecycle** [docs] https://fin.ai/help/en/articles/14324571-manage-procedure-versions-and-publishing
  - States: Unsaved, Draft, Live, Live with draft, Paused, Paused with draft.
  - Setting live takes a "What changed?" note of 50–500 characters.
  - Version history lists only versions that were set live. Restoring creates a new draft and overwrites the current draft. "Discard changes" reverts to the live version.
  - Editing locks, and showing who made each change, are not documented (n/f).
- **Permissions and billing.** Creating procedures needs "can manage workspace data". From 12 Mar 2026, configured procedure handoffs are billed as outcomes; default escalations are not.
- **Fin Tasks.** New Tasks were disabled from 12 Mar 2026. Single-block Tasks auto-migrate to Procedures. Procedures was in "managed availability" (contracted customers only) at launch. https://fin.ai/help/en/articles/13703341-transitioning-from-fin-tasks-to-procedures
- **Data connectors.** Return values persist for the rest of the procedure. Code blocks can transform responses before Fin sees them. Outputs are *not* conversation attributes unless saved through a workflow handoff. https://www.intercom.com/help/en/articles/13459820-how-to-use-data-connectors-in-fin-procedures , https://www.intercom.com/help/en/articles/13704396-troubleshooting-fin-procedures-and-data-connectors

### Decagon. AOPs ("natural language compiled to validated workflows")
- **Authoring.** CX teams write AOPs in everyday language "as they would to a new hire", with extra detail on edge cases. **Engineers** maintain the tools and integrations, the code-level controls and the guardrails. This is an explicit split of who owns what. https://decagon.ai/blog/from-sops-to-agent-operating-procedures [vendor]
- **Components:**
  - Name and **entry conditions** (the trigger).
  - Steps or nodes, and required **data points** per step (customer ID, order number, account status).
  - Conditions or branches, and **tools** (API calls, lookups, calculations).
  - **Metadata** (location, role, product tier) that adapts the workflow to the customer.
  - **Guardrails** (validation for sensitive actions such as refunds and account changes, plus escalation rules).
  - "Content blocks" that add conditional logic to follow precisely.
  - Sources: https://decagon.ai/modules/aops , https://decagon.ai/blog/from-sops-to-agent-operating-procedures
- **Drafting.** Duet or AOP Copilot drafts an AOP from plain English or an existing SOP.
- **Quality and versioning.** Versioning with rollback, simulations, unit tests for brand and policy compliance, scheduled regression runs, and A/B Experiments (see the dashboard notes). [vendor]
- **Not public.** No public AOP text sample was found, and the docs are gated (n/f). No public detail on the approval workflow or audit log was found (n/f).

### Sierra. No-code Journeys vs code-first Agent SDK
- **Agent Studio 2.0 Journeys.** A natural-language interface to "define the goals and guardrails" of the experience. Sierra claims Journeys gives "the same control developers currently have with Sierra's Agent SDK". The **Integration Library** lets non-engineers pick an integration, add credentials and endpoints, and publish, which exposes tools such as process return or update order. https://sierra.ai/blog/agent-studio-2-0 [vendor]
- **Agent SDK (code).** Goals and guardrails "while adhering to policy guidelines and maintaining brand tone". Composable skills (triage, respond, confirm) with tunable "levels of creativity and determinism". A customer (Ramp) wrote "customer journeys as code, track changes". Policies and FAQs live in the knowledge engine. https://sierra.ai/product/agent-sdk [vendor]
- **Third-party description.** Journeys turns plain-English goals into generated "instructions, guardrails, tone, and integrations". https://www.eesel.ai/blog/sierra-ai [3p]
- **Governance.** Private Workspaces, auto-versioning, snapshots promoted through QA, staging and production, and merge-conflict detection (see the dashboard notes, https://sierra.ai/blog/workspaces). Ghostwriter builds agents from plain English.
- **Lesson.** Even Sierra keeps complex release management in code, so no-code governs content while engineers govern integrations.

### Zendesk AI agents (Advanced)
- **Persona** [docs] https://support.zendesk.com/hc/en-us/articles/8357758773658-Customizing-the-identity-tone-of-voice-and-pronoun-formality-for-an-AI-agent
  - Name and business profile. **"Make sure not to add instructions … to the business profile"**, because Zendesk says doing so causes errors.
  - Tone presets: Professional (default), Informal, Enthusiastic. Reply length: Short (50–60 words) or Long (up to 80 words) for messaging. Pronoun formality.
  - Changes reach customers only after the agent is **published**.
- **Custom tone and instructions.** Be descriptive and include example phrases. Zendesk warns that a cheerful persona can fail with a distressed customer. https://support.zendesk.com/hc/en-us/articles/8719119396506
- **Use cases and generative procedures** [docs] https://support.zendesk.com/hc/en-us/articles/8979864563610-Creating-generative-procedures-to-shape-flexible-conversation-flows-for-AI-agents
  - The **use case** (an intent) is the trigger, with the reply method "Use procedure when use case is triggered". *Dialogues* remain the rigid, scripted alternative.
  - A procedure is free text with ordered steps. Typing `/` or `+` inserts actions, API integrations, parameters, search rules and links to other procedures. Search rules can be written in plain language, for example "Search only in the English help center". A placeholder can be inserted, for example "Always include {{brandName}}".
  - The builder generates a **summary and a procedure map**. The user refines it by describing a targeted change ("add a step…") rather than rewriting it.
  - Publishing is a "Publish procedure" button. **Every change goes to version history and can be restored.** No rich content such as buttons.
- **Writing advice** [docs] https://support.zendesk.com/hc/en-us/articles/9424547622298-Best-practices-for-writing-generative-procedures-for-AI-agents
  - Use plain, imperative language, split tasks into steps, keep terminology consistent, and state error handling.
  - Example: write "Ask the customer to provide their 10-digit account number", not "Request account info from the user".
  - Rolled out to all Suite and Support plans between May and June 2026.
- **Legacy.** The Essential bot builder ends on 10 Dec 2026 (dashboard notes).

### Ada
- **Custom Instructions (global rules)** [docs] https://docs.ada.cx/docs/automation/custom-instructions
  - At most **10 active** instructions of **300 characters each**, English only. Legacy "Guidance" allowed 40.
  - Availability is "Everyone" or variable-based rules with AND/OR groups. Operators depend on the variable type. Variables collected by Actions cannot be used for targeting.
  - Drafts are inactive until toggled Active. "Convert to draft" switches a rule off without deleting it.
  - A **Test** chat runs against drafts.
  - **Automatic conflict detection** checks new instructions against active *and* inactive ones and notifies the user (the docs' example is overlapping spring and summer sales).
  - Conversation logs show "Custom instruction considered".
  - Intended uses: formal tone, avoiding phrases, current promotions, VIP-only messaging.
- **Coaching.** Contextual fixes created while reviewing past conversations. Ada recommends moving contextual instructions to Coaching. Coaching affects *which* Playbook gets selected but **does not apply inside a running Playbook**. https://docs.ada.cx/docs/optimization/coaching.md
- **Playbooks** [docs] https://docs.ada.cx/docs/automation/playbooks/configure.md
  - Name up to 128 characters. A **"When to use this Playbook"** description of up to 512 characters is the main routing signal. A Playbook can instead be triggered by a conversation-start event per channel, with one event per Playbook.
  - **Sections** are journey stages such as verify identity or process refund. Steps use typed verbs:
    - `SEND` sends a message.
    - `SET` sets a variable silently.
    - `ASK` collects a value.
    - `RUN` runs an API tool, Handoff, linked Playbook or Exit.
    - `IF/ELSE` branches.
    - `GO TO` jumps.
  - **General Guidelines** are stateless rules that hold throughout the Playbook and cannot run actions or set variables.
    - Examples: "Always verify the end user's identity before sharing account-specific information." and "Never offer a refund greater than the original order value."
  - Availability rules use variable conditions. A Playbook can be marked "Only available within other Playbooks" so it runs only as a child of another Playbook.
  - **Deviation behaviour.** For a request for a human, an off-topic message, or a Q&A question, the user chooses the default behaviour or "Stay in this Playbook". This can be overridden on individual ASK steps.
  - Parent and child Playbooks use call-and-return. Linked Playbooks must share a version.
  - The agent **cannot search knowledge while inside a Playbook**, so needed facts must be pasted into the Playbook. Playbooks are Messaging and Email only, not Voice.
  - Sources: https://docs.ada.cx/docs/automation/playbooks/configure.md ; https://docs.ada.cx/docs/automation/playbooks/playbooks-classic

### Salesforce Agentforce. Topics (now "subagents"), instructions, actions, and Agent Script
- **Classic model.** A **Topic** has a classification description (routing), a **scope** (the job boundary), **instructions** (natural language) and **actions** (Flow, Apex, prompt templates, API). Topics "define the range of capabilities". https://trailhead.salesforce.com/content/learn/modules/agentforce-agents-quick-look/discover-agentforce-agents [docs]
  - Example scope: "Resend reservation confirmations only; do not create new reservations." https://www.grazitti.com/blog/want-smarter-ai-agents-it-all-starts-with-better-instructions-in-agentforce/ [3p]
  - Example instruction: "If no order number is provided, escalate the case to a live agent." [3p, same URL]
  - Salesforce advises starting with a minimal set of instructions, ideally one, and growing it through simulations. Cited in https://www.scribd.com/document/877889154/Agentforce-Implementation-Guide-PDF [3p copy of Salesforce guide]
  - A partner guide reports least confusion with **8–13 topics**, and fixes misrouting with out-of-scope statements in the topic scope. https://kb.bullhorn.com/bh4sf/Content/BH4SF/Topics/agentforceTroubleshootingResponses.htm [3p]
- **Trust layer.** The Einstein Trust Layer masks PII, screens outputs and logs generations for audit. https://trailhead.salesforce.com/content/learn/modules/trusted-agentic-ai/explore-agentforce-guardrails-and-trust-patterns [docs]
- **2025-26 shift to hybrid reasoning** [docs] https://architect.salesforce.com/docs/architect/fundamentals/guide/hybrid-reasoning-agentforce-builder-agent-script
  - "Agent Script" separates *deterministic logic instructions* (run as code, no LLM) from *prompt instructions* (interpreted by the LLM).
  - Each subagent has `before_reasoning` (auth, entitlement checks), `reasoning`, and `after_reasoning` (the guardrail layer: enforces business rules after the LLM replies).
  - **Action gating:** `available when @variables.interest != ""` hides a tool from the LLM until the condition holds. The guide says **never let the LLM set the gate variable**, and to close the gate after use (`has_run`) to avoid loops.
  - Typed variables default to closed gates. A Preview/Simulate mode emulates action responses.
  - The stated motivation is that the old all-LLM routing was hard to reproduce for testing or audit. Salesforce reports one customer (Datasite) rose from the low 60s to 82% deflection after a rebuild [vendor]. https://www.salesforce.com/agentforce/agent-builder/migration/
- **Testing.** Manual testing in Builder (the plan canvas shows the chosen topic, actions and instructions used) plus **Testing Center** batch CSV tests. Empty expected fields count as failures. https://trailhead.salesforce.com/content/learn/modules/agentforce-testing-tools-and-strategies/explore-agent-testing-tools-and-considerations . The new builder has a Tests tab with `AiTestingDefinition` scorers. https://developer.salesforce.com/blogs/2026/08/migrate-legacy-agents-to-the-new-agentforce-builder
- **Versioning and audit specifics for agents:** n/f in public sources found here. Agents are Salesforce metadata, so the usual sandbox and deploy pipeline applies (inference).

### Voiceflow. Playbooks inside a builder
- **Global prompt.** The agent-level global prompt handles routing only. **Once a playbook is active, agent-level instructions leave the context**, so each tool's trigger must carry its own "when". https://www.voiceflow.com/docs/documentation/build/playbooks [docs]
- **Playbook fields:**
  - A literal name ("Lookup Order", not "Order tool").
  - A trigger or description covering what it does and when to route.
  - Instructions using headings and numbered steps.
  - Tools: integrations, API, MCP, function and system tools.
  - `{variables}`.
  - Model, temperature and max tokens per playbook.
  - **Entry conditions** (deterministic) and **required entry variables**.
  - **Exit conditions** with required exit variables. Example: exit when "User is qualified" requires `{company_size}`, `{use_case}` and `{email}`.
- **Exit wiring.** Exit conditions become ports on the Playbook step, for example "Speak to human" connected to Call forward. Crew-level exits override playbook-level exits. https://www.voiceflow.com/docs/documentation/build/steps/playbook , https://www.voiceflow.com/docs/documentation/build/steps/crew.md
- **Versioning.** Per-environment drafts and publishing; only admins can publish protected environments (dashboard notes).

### Retell AI and Vapi. Developer voice platforms
- **Retell conversation flow** [docs] https://docs.retellai.com/build/conversation-flow/transition-condition
  - Nodes connect through transition conditions. **Equation conditions** are deterministic comparisons over variables and are evaluated *first*. **Prompt conditions** are evaluated by the LLM, together with global-node entry conditions, and the single best match wins. Otherwise an else edge fires, or the agent stays on the node.
  - **Global nodes** can be entered from anywhere (for example "caller asks for a human"). They have positive and negative examples, a "go back" condition, and "prevent immediate re-trigger" for N steps (default 3). https://docs.retellai.com/build/conversation-flow/global-node
  - Forum reports of loops and stalls around global nodes. https://community.retellai.com/t/conversation-flow-gets-stuck/833 [forum]
- **Vapi.** Workflows (the node builder) **retire on 18 Aug 2026**. Users move to single Assistants (prompt plus tools) or **Squads**, specialised assistants that hand off to each other.
  - Vapi's guidance is to bundle as much as possible into one assistant and avoid cyclical handoffs, because long prompts raise hallucination, cost and latency.
  - Source: https://docs.vapi.ai/workflows/legacy-migration , https://docs.vapi.ai/docs/squads
  - **Signal:** a major platform abandoned its visual node-flow builder.

### Lindy. Prompt-level rules plus confirmation toggles
- **Agent-level instructions** are "added as a prefix to every LLM call". https://docs.lindy.ai/fundamentals/lindy-101/prompt-guide [docs]
- **Phone agent.** Behaviour is set by the prompt (role, goal, guidelines). Post-call logging goes on an "After Call Ends" path. https://docs.lindy.ai/skills/by-lindy/lindy-phone
- **Phone-line rules** for "when others call": take a message, book, require a PIN. An "Ask for confirmation" toggle on side-effect actions, and plain-language feedback learning (dashboard notes).

### SMB AI receptionists. Form-first, scenario-based
- **My AI Front Desk** [docs] https://www.myaifrontdesk.com/help/getting-started/setup-wizard , https://www.myaifrontdesk.com/tutorials/what-are-workflows-in-my-ai-front-desk , https://www.myaifrontdesk.com/help/ai-receptionist/intake-forms
  - Objects the owner fills in:
    - Greeting.
    - "Custom Commands" prompts, separate for voice and text.
    - Business info: text, website URL, or uploaded docs.
    - FAQ question-and-answer pairs.
    - **Intake forms.** A trigger scenario plus a question list. There is one "Beginning of Call" form, plus custom-scenario forms such as "anytime the user mentions they are a new customer".
    - **Transfer rules.** A plain-English scenario plus a destination number, for example "caller asks for the manager" or refund requests to billing.
    - **Texting workflows.** Send a menu when prices are asked, or a booking link.
    - Post-call text toggle, calendar connection, voice, and languages.
  - Every **workflow trigger is a plain-English scenario the AI judges**. There is no separate conditions system; the docs' example is "Execute this if they are from Florida". Unlimited workflows. Testing means placing a test call.
- **Goodcall** [vendor] https://goodcall.com/how-it-works
  - Setup steps: connect CRM, calendar and knowledge base; then **Skills** ("tell it how to schedule appointments, answer FAQs, route complex support tickets, or capture new leads"); then **call flow logic** (routing rules, fallbacks); then the phone number.
  - Practice calls before going live, and rollback to the last version (dashboard notes).
- **Smith.ai** [3p] https://techpoint.africa/guide/smith-ai-review/
  - Setup covers greeting, FAQs, call-routing instructions, scheduling links, CRM, customisable lead-qualification questions, and screening by urgency and topic.
  - No official help docs were found (n/f).
- **Rosie** [vendor/3p] https://heyrosie.com/./pricing , https://aiindigo.com/tutorials/getting-started-with-rosie-automate-call-handling-for-busy-professionals
  - Availability: business hours, forwarding outside them, and contact whitelisting.
  - FAQ file upload and concise persona instructions.
  - **Transfers and warm handoff are tier-gated.**
- **Synthflow** [docs] https://docs.synthflow.ai/flow-designer , https://docs.synthflow.ai/about-custom-actions.md
  - Global settings: system prompt, fallback logic, objection handling.
  - A node-based Flow Designer (beta).
  - Actions: Real-Time Booking, Call Transfer, and custom HTTP GET/POST that can chain.
- **No SMB receptionist publishes** policy versioning, per-change audit, conflict detection or priority rules (n/f). Governance is essentially "edit the prompt or form and save".

---

## 2. Cross-product comparison

| Concern | Enterprise pattern | SMB receptionist pattern |
|---|---|---|
| Global behaviour | Guidance or Custom Instructions: a short plain-language rule with a title, capped in count (Fin 100, Ada 10×300 chars) | One prompt or "custom commands" box |
| Tone and brand | Presets plus custom text (Zendesk), Guidance category (Fin) | Voice picker plus greeting |
| Multi-step processes | Procedure, Playbook or AOP: a trigger description, ordered steps, typed verbs, conditions, tools, end or handoff | "Skills" or scenario workflows (intake form, transfer, text) |
| Trigger | A "When to use / when NOT to use" description plus examples (Fin 256 chars, Ada 512 chars); Zendesk uses intents | A plain-English scenario |
| Scope | Audiences or variable rules with AND/OR, plus channels (Fin, Ada); `available when` gates (Agentforce); entry conditions (Voiceflow) | Business hours, sometimes language |
| Required info | Connector input schema (Fin), ASK steps (Ada), required variables (Voiceflow), data points (Decagon) | Intake form fields |
| Risk limits | Code or deterministic conditions for money (Fin refund > 500 → Ask Teammate; Ada "never refund > order value"; Agentforce after_reasoning guard) | Not exposed |
| Escalation | Defaults, then structured rules (attributes, audience, channel), then NL guidance, then a routing workflow (Fin) | Transfer scenario plus number |
| Conflicts | Manual review (Fin); **auto conflict detection** (Ada); one guidance item per response for escalation (Fin); audience targeting to avoid overlap | None |
| Priority | Procedure-local guidance replaces workspace guidance (Fin); Playbook isolates from Coaching (Ada); deterministic equations before LLM prompt conditions (Retell) | None |
| Test | Preview, then simulation with mock tool data and success criteria, then set live (Fin, Agentforce, Decagon) | Test call |
| Versioning | Draft/live/paused, a "what changed" note, restore-as-draft (Fin); author and time per change (Fin Guidance); history and restore (Zendesk); environments (Sierra, Voiceflow) | Rollback to last version (Goodcall only) |
| Pre-publish review | AI review of procedures for unreliable instructions (Fin); AI-generated map (Zendesk) | None |

**Industry direction (2025-26).** Every major vendor converged on **"plain-language steps plus deterministic islands"**:
- Fin added code conditions.
- Agentforce added Agent Script with deterministic blocks.
- Retell evaluates equations before prompts.
- Decagon backs natural language with code.
- Voiceflow added deterministic entry conditions.

At the same time, pure node-graph builders are retreating (Vapi Workflows retire Aug 2026; Zendesk dialogues are now the "rigid" option). Vendors keep the money and identity checks deterministic and leave tone and phrasing to the LLM.

---

## 3. Recommended policy model for an SMB-friendly portal (Wyrm / ReceptionAI)

This section is inference built on the evidence above.

### 3.1 Objects

```
BusinessProfile    { facts only: name, services, prices, hours, address, staff }
                   -- Zendesk lesson: never mix instructions into the profile

Rule (Guidance)    { id, title, kind: tone | content | escalation | forbidden_topic | other,
                     instruction (<= 300 chars, plain language),
                     scope { channels[], languages[], hours: open|closed|any, caller: new|returning|any },
                     priority: safety > business_hard > business_soft > style,
                     status: draft | live | paused, version, author, changed_at, change_note }

Procedure (Playbook) {
                     id, name (literal),
                     when_to_use (<= 256 chars), when_not_to_use, example_utterances[],
                     scope (as Rule),
                     required_info[] { field, type, validation, ask_text }   -- typed, not prose
                     steps[] { kind: say | ask | check | action | handoff | end,
                               text, condition (structured preferred) }
                     actions[] { tool: book|reschedule|cancel|transfer|sms|create_lead,
                                 confirmation: always_read_back,
                                 approval: none | owner_before | owner_after }
                     limits { max_discount_pct, max_refund, max_booking_days_ahead, deposit_required }
                     exit { success_outcome, escalate_when[], fallback: take_message }
                     local_rules[]  (override global rules inside the procedure)
                     status, version, change_note, test_set_id }

Limit (hard guardrail, deterministic, NOT prompt text)
                   { key, value, enforced_in: backend } e.g. no booking outside opening hours,
                     no price not in catalogue, refund/discount cap, confirmation required

TestCase           { caller_turns[], expected_outcome, must_say[], must_not_say[], source_call_id? }
ChangeLog          { object, version, author, at, diff, note, test_run_id, restored_from? }
```

### 3.2 Resolution order (make it explicit and visible)

1. **Platform safety and hard limits.** Enforced in code; the owner cannot disable them. Examples: explicit booking confirmation, tenant isolation, no data outside the catalogue.
2. **Owner hard limits.** Structured fields such as maximum discount or "never book same-day". Enforced in the backend, as Agentforce does with `after_reasoning` and Fin with code conditions.
3. **The active Procedure's local rules.** These replace overlapping global rules, as in Fin and Ada.
4. **Global rules by scope specificity.** A narrower scope wins: channel plus hours beats channel beats everyone. On a tie, the higher `priority` wins, and on a further tie the newest wins. Show the owner a warning instead of resolving silently.
5. Tone and style.
6. Default escalation (a human was asked for, frustration, a loop), which always applies, as in Fin.

### 3.3 What non-technical owners can realistically manage

These are drawn from the SMB products and from the enterprise limits.
- **Yes:**
  - Business facts and FAQs as forms.
  - 5–15 short rules (Ada caps at 10 for a reason).
  - Picking templates for 3–6 procedures (book, reschedule, cancel, quote request, message for staff, urgent issue) and editing their wording and limits.
  - Transfer and "take a message" scenarios with a phone number.
  - Business-hours scope.
  - Test call or chat.
  - "Restore previous".
- **With help (wizard or AI draft):** writing `when_to_use`, required-info lists, and example utterances. "Let AI draft" from a description (Fin, Decagon, Zendesk) followed by an AI-generated map or summary to confirm (Zendesk).
- **No:** code conditions, nested branches, node graphs, tool schemas, model settings, or environments. Keep these internal, as Decagon and Sierra keep integrations with engineers.

### 3.4 Pitfalls (with evidence)

- **Conflicting rules → unpredictable behaviour.** Fin says so explicitly; Ada built auto-detection. Run an LLM conflict check on save against active and draft rules.
- **Instructions in the wrong place.** Zendesk warns that instructions placed in the business profile cause errors. Voiceflow and Ada drop global or coaching context inside playbooks, and Ada Playbooks cannot search knowledge. Owners must be told what applies where; show "rules active in this procedure".
- **Numbers and money in prose.** The LLM may ignore them. Fin uses code conditions, Ada's guideline is "never refund > order value", and Agentforce says never let the LLM set the gate variable. Put caps in structured fields that the backend enforces.
- **Over-broad triggers or too many intents.** Agentforce reports confusion beyond about 8–13 topics. Fin requires "when NOT to use" plus examples.
- **Tone that fits one scenario only.** Zendesk's example is a cheerful persona with a distressed caller.
- **Untested live edits.** Fin Preview on a live procedure can reach real customers. Require draft, then test set, then publish, and record a "what changed" note (Fin requires 50–500 characters).
- **Error paths ignored.** Fin says to add a condition after *every* tool call. A failed booking must say so and take a message, not claim success.
- **Node-graph complexity.** Retell forum loops and Vapi retiring Workflows both point away from flow builders for SMB owners.
- **Audit gaps.** Fin's procedure history shows only live versions and no authors; Fin Guidance added authors only in Apr 2026. Log every change with author, diff and test result from day one.
- **Tier-gating essentials.** Rosie gates transfers to higher tiers and reviewers complain. Keep handoff and safety features in the free tier.

### 3.5 Minimum viable for a free tier
1. Structured hard limits plus business profile forms, enforced in the backend.
2. Up to 10 plain-language rules with scope (channel, hours, new or returning caller), conflict check on save, and draft or live status.
3. Template procedures (booking, reschedule, cancel, message, transfer) with editable wording, required info, limits and exit.
4. A test set: 10 fixed caller scripts plus any "turn this call into a test", run automatically before publish, with pass/fail shown.
5. A change log with author, time, note, diff, test result, and one-click restore as a draft.
