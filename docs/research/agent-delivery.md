# How AI-agent vendors deliver a working agent to a business customer (2025-2026)

Researched 2026-10-21. This complements `agent-dashboard-products.md`, which already covers dashboards, analytics, testing UIs, versioning, roles, alerts and billing screens. This note covers only **delivery**: onboarding, who does the work, knowledge ingestion, integrations and auth, channels, pre-launch testing, rollout, go-live, the post-launch loop, pricing model and support. Where the earlier note already covers a point, it is cross-referenced, not repeated.

Source labels: **[doc]** is official docs or help center, **[vendor]** is marketing or a job posting, **[3p]** is a third-party blog (often a competitor, so biased), **[forum]** is a community post, and **n/f** means no public source was found. Prices from [3p] sources conflict often; verify them before quoting.

---

## 1. Per-vendor delivery notes

### Intercom Fin (self-serve, mid-market and SMB)
- **Onboarding steps** [doc] (https://intercom.com/help/en/articles/8286630-set-fin-ai-agent-live-for-chat):
  1. Install the Messenger. Prerequisite: at least 10 public Help Center articles live.
  2. Set audience rules (users, leads, visitors, or attributes such as email domain).
  3. Pick channels: Web, iOS, Android, WhatsApp, Slack, Facebook, Instagram, SMS. Each must first be connected under Settings > Channels. Email deploys separately.
  4. Enable "Let Fin introduce itself".
  5. Enable content under Train > Content. Guidance is optional.
  6. Configure handoff (team or inbox, optional info collection, or close with a message).
  7. Set auto-close and CSAT, then click "Set Fin Live". The same toggle pauses Fin.
  - "Simple setup" overrides live Workflows if both exist. https://intercom.com/help/en/articles/8286630-set-up-fin-using-workflows
- **Who does the work:** Self-serve. There is no published time-to-live; third-party guides talk in days [3p]. https://www.eesel.ai/blog/how-to-use-fin-ai
- **Knowledge:** Sources are public articles, snippets, PDFs, URLs and past conversations. Website sync is public URLs only. https://www.intercom.com/help/en/articles/9357945-sync-and-manage-websites
  - URL sources re-sync **weekly**. To refresh immediately you remove and re-add the source [forum]. https://community.intercom.com/questions/5520
  - There is no per-URL incremental sync yet (feature request, June 2026) [forum]. https://community.intercom.com/ideas/incremental-url-level-sync-for-website-sources-14828
  - Reported caps: 4,000 pages per source, and large or JavaScript-heavy sites sync every 14 days [3p]. https://www.getmacha.com/blog/intercom-fin-not-answering-from-content
  - A Freshdesk importer re-syncs automatically [doc]. https://www.intercom.com/changes/en/114321-content-importers-knowledge-integrations
- **Integrations and auth:** Data connectors live under Settings > Integrations > Data connectors. https://www.intercom.com/help/en/articles/9909996-use-data-connector-templates
  - Templates exist for Stripe, Shopify and Linear, plus "Custom MCP" (URL plus auth). Custom MCP is US-hosted workspaces only.
  - Auth is OAuth or an access token. Fixed or dynamic tokens go in headers and are encrypted at rest. "Restricted data access" whitelists the fields Fin may use. https://www.intercom.com/help/en/articles/9916507-data-and-actions-faqs
  - Connectors can be called by Fin directly or from Workflows and Tasks.
- **Testing:** The Messenger preview and "Preview user" impersonation are not billed. A live internal test means restricting the audience to `email contains yourco.com`, which **is billed**. Batch tests and simulations are covered in the dashboard note.
- **Rollout:** Audience rules and Workflow branches are the documented way to limit who sees Fin. There is no documented percentage-of-traffic or office-hours control (n/f in the article above). Third-party advice is to start with one subset and read the first week of transcripts [3p]. https://www.lorikeetcx.ai/articles/how-to-add-ai-agent-to-intercom-2026
- **Pricing:** $0.99 per outcome, with at most one outcome per conversation. An outcome is a confirmed fix, the customer not asking further after Fin's reply, or a completed Procedure (handoffs from a Procedure count). https://www.intercom.com/pricing
  - Standalone Fin has a minimum of about 50 outcomes per month [3p]. Intercom helpdesk seats cost extra [3p]. https://pluno.ai/blog/intercom-fin-ai-pricing
  - The trust problem with "assumed resolution" is covered in the dashboard note.

### Sierra (enterprise, white-glove)
- **Who does the work:** Sierra's forward-deployed engineers are called "Agent Engineers" and own the agent development life cycle end to end [vendor/job]. https://www.tryexponent.com/jobs/fde/sierra
  - Ghostwriter (March 2026) lets non-technical staff describe agents in plain English, to reduce hand-built work. https://sierra.ai/jp/product/ghostwriter
- **Time-to-live:** Not published. Reported examples: a partner deployment went live about 4 weeks after kickoff; Singtel reached over 70% resolution in 10 weeks [3p]. https://zerogtalent.com/blog/sierra-ai-s-15b-valuation-is-fueling-a-hidden-hiring-blitz-in-enterprise-ai-agents-and-the-roles-reveal-a-new-class-of-agent-operator-jobs
- **Release process:** Workspaces, snapshots, then QA, staging and production with rollback (see dashboard note). https://sierra.ai/blog/workspaces
- **Pricing:** Outcome-based. Customers pay when an agreed outcome happens, such as a resolution, a saved cancellation or an upsell. https://sierra.ai/de/blog/agents-as-a-service
  - Escalations are usually not charged.
  - Estimates [3p]: platform fee plus about $1-2.50 per outcome plus setup; year-one cost $200k-350k or more. https://www.cloudtalk.io/blog/sierra-ai-pricing/

### Decagon (enterprise, white-glove)
- **Who does the work:** A customer team of Agent Product Managers ("part PM, part AI consultant", taking a brand from idea to live agent), Implementation Managers who own a standard implementation playbook, CSMs, and Agent Software Engineers [vendor].
  - https://decagon.ai/blog/agent-product-manager
  - https://www.builtinnyc.com/job/implementation-manager/8271072
- **Process (from job postings):** Workflow discovery, then configure and test, then project plan through launch, then maintain. No public timeline (n/f).
- **Rollout:** Experiments allow traffic ramp-ups against a control group (see dashboard note).
- **Pricing** [doc]: either per conversation (fixed rate for each incoming conversation, with volume discounts) or per resolution (higher rate, escalations not charged). https://decagon.ai/resources/pricing-ai-agents
  - Most customers reportedly choose per conversation [3p]. Estimates of about $0.99 per conversation plus about $50k per year platform fee are a competitor's guess [3p]. https://quiq.com/blog/decagon-pricing/

### Ada (enterprise, self-serve platform plus CSM)
- **Knowledge:** Connect under Training > Knowledge (for Zendesk, enter the subdomain). The help center must not be behind a paywall. Syncs **automatically every 15 minutes** for Zendesk and Salesforce [doc]. https://docs.ada.cx/docs/knowledge/content-ingestion/knowledge-integration
  - March 2026 added article tags, private-article sync and multiple help centers. https://docs.ada.cx/release-notes/2026/3/25
- **Pre-launch:** Knowledge, Actions (API lookups), Processes and Playbooks should be in place before testing. Testing is interactive plus simulations. Teammates are invited to test and give feedback, then the team adjusts and launches [doc]. https://docs.ada.cx/docs/welcome/getting-started/enhance-your-ai-agent-with-automation
  - Coaching applied in a **simulation** carries over into production (May 2026). https://docs.ada.cx/release-notes/2026/5/7
- **Pricing:** Sales-led. Mostly per conversation, with per resolution for some enterprises. Ada's illustrative figures: $0.35 per conversation vs $1.50 per resolution. Ada targets companies with about 300k or more conversations a year [3p]. https://myaskai.com/blog/ada-ai-pricing-explained

### Zendesk AI agents
- **Setup:** Requires the AI agents admin role. Create an agent for messaging and the brand's help center connects **automatically**. Web crawlers can add external content. https://support.zendesk.com/hc/en-us/articles/10488757995034-Creating-an-AI-agent-to-automatically-resolve-customer-issues
  - Advanced agents connect Zendesk help centers plus external sources. Zendesk warns that too many sources reduce accuracy and add latency. https://support.zendesk.com/hc/en-us/articles/8357749301658-Importing-knowledge-sources-for-an-advanced-AI-agent
  - The AI agent cannot browse the web; it only uses the connected sources [3p]. https://eesel.ai/blog/zendesk-ai-agent-review
- **Steps per guides** [3p]: improve help-center content, pick channels (messaging or email), set the persona, test, then go live. https://www.eesel.ai/blog/zendesk-ai-agents
- **Pricing:** Suite seats ($55-169 per agent per month) include a small automated-resolution allowance. Extra resolutions cost about $1.50-2.00 each. The advanced AI add-on is about $50 per agent or by quote [3p, conflicting]. https://www.eesel.ai/blog/zendesk-ai-agents-in-email-channels

### Salesforce Agentforce
- **Testing Center** (also called "Agentforce Studio Tests"):
  - Generates **hundreds of synthetic test cases** from topics and actions, or from Data Library knowledge, and runs them in parallel. You can also upload a CSV.
  - Evaluates whether the right topic and the right action were chosen.
  - Salesforce warns that tests can modify CRM data, so run them **only in a sandbox** [doc].
  - https://trailhead.salesforce.com/content/learn/modules/agentforce-agent-testing/use-ai-to-generate-tests
  - https://developer.salesforce.com/blogs/2025/11/auto-generate-agent-test-cases-from-agentforce-data-libraries
  - https://admin.salesforce.com/blog/2025/ensuring-ai-accuracy-5-steps-to-test-agentforce
- **Deploy:** Activate the agent, add an Enhanced Chat v2 connection, create a Messaging channel routed to the agent **with a fallback queue**, then create an Embedded Service Deployment (web snippet or mobile SDK).
  - The agent must be active before a channel can route to it.
  - Voice goes through a Telephony connection or Enhanced Chat v2. Only the Enhanced Chat path supports human escalation and transcripts [doc]. https://developer.salesforce.com/docs/ai/agentforce/guide/headless-examples-enhanced-chat-agent.html , https://developer.salesforce.com/docs/ai/agentforce-mobile-sdk/guide/agentforce-mobile-sdk-android-voice.html
- **Pricing:** Flex Credits at $500 per 100k credits. A standard action is 20 credits ($0.10) and a voice action is 30 ($0.15). Salesforce's example is three actions = $0.30. Data 360 and other usage are extra, and credits don't roll over. https://www.salesforce.com/agentforce/pricing/ , https://www.getmacha.com/blog/agentforce-pricing-explained
- **Who does the work:** Large deployments rely heavily on SI partners and admins (general knowledge; not separately sourced here).

### Retell AI (voice platform, developer self-serve)
- **Phone numbers:** Buy a number in Retell, or bring your own number (BYO) via **SIP trunk**.
  - With Twilio, you create an Elastic SIP trunk, set termination for outbound, and point origination at Retell's SIP server for inbound. Auth is by credentials, or by IP using an allowlist because Retell has no static IP. Toll-free numbers need TCP. Import from the dashboard or with the Import Number API, then press "Test SIP Connection" (an OPTIONS ping only).
  - **The number is not ported, and the carrier keeps billing it** [doc].
  - https://docs.retellai.com/deploy/twilio , https://docs.retellai.com/make-calls/custom-telephony , https://www.retellai.com/learn/how-to-keep-your-existing-phone-number-using-a-sip-connection
- **Testing and versions:** See the dashboard note (simulations, batch tests, version tags for rollback).
- **Pricing:** Pay as you go at about $0.07-0.31 per minute depending on the stack. 20 concurrent calls are included, then $8 per extra slot per month. Add-ons per minute: knowledge base +$0.005, PII removal +$0.01. Pay-as-you-go support is community and email; Enterprise has custom terms. **No published SLA** [3p]. https://quiq.com/blog/retell-ai-pricing/ , https://krispcall.com/general/retell-ai-pricing/
- **Agencies:** No native white-label offering. Agencies are advised to use one workspace per client, created by hand with no API. Portals come from partners such as Vapify [3p competitor + vendor]. https://ainora.lt/md/white-label-ai-voice-alternatives/retell.md , https://www.retellai.com/partner/vapify

### Vapi (voice platform, developer)
- **Numbers:** Dashboard: Phone Numbers > Import, using a Twilio SID and auth token, or a Telnyx API v2 key (Telnyx recommends import over a BYO SIP trunk). Other carriers go through SIP or `byo-phone-number` [doc/forum].
  - https://docs.vapi.ai/phone-numbers/import-twilio
  - https://docs.vapi.ai/telnyx
  - https://support.telnyx.com/en/articles/12538402-telnyx-vapi-integration
- **Testing and rollout:** Chat-mode then voice-mode simulations, and traffic splitting across versions for canary releases (see dashboard note).
- **Pricing:** Build tier is $0.05 per minute for hosting, with model, speech-to-text, text-to-speech and telephony costs passed through. 10 concurrent calls, then $10 per line per month. Support is by email and Discord. Scale tier is annual, with a platform fee, committed volume, a support SLA and an account team. https://vapi.ai/pricing
  - All-in cost estimates range from $0.08-0.33 per minute [3p]. Third-party SLA figures conflict (99.9% vs 99.99%) [3p]. https://www.getmacha.com/blog/vapi-ai-pricing-explained
- **White label:** Not native; enterprise only, otherwise Vapi points agencies to **Vapify** [forum/doc]. https://support.vapi.ai/t/28926377/is-it-possible-to-use-vapi-as-whitelabel , https://docs.vapi.ai/providers/vapify

### Bland AI (voice, developer to enterprise)
- **Who does the work:** Forward Deployed Engineers own "end-to-end delivery from discovery to production and adoption", from presales to post-sales, including integrations [vendor/job]. https://startup.jobs/forward-deployed-engineer-bland-8124659
- **Post-launch loop:** Flag a call, create an issue, then "Norm Fix" patches the draft and verifies it in a testbed (see dashboard note). https://docs.bland.ai/changelog/04_30_2026
- **Pricing:** $0.11-0.14 per minute by plan (see dashboard note). https://docs.bland.ai/platform/billing.md

### Synthflow (voice, no-code plus agencies)
- **Enterprise delivery:** Forward-deployed engineers, "deploy in 2-3 weeks rather than months", and measurable ROI promised in the first 60 days [vendor]. Enterprise includes a dedicated onboarding team and CSM, with annual commitments from about $30k and about 3 weeks to deploy [vendor]. Solutions engineers lead technical onboarding (prompting, APIs) [job].
  - https://synthflow.ai/news/synthflow-ai-and-avant-partner-to-accelerate-enterprise-adoption-of-agentic-voice-ai
  - https://synthflow.ai/synthflow-vs-retell-ai
- **Agency white label** [doc] (https://docs.synthflow.ai/docs/new-agency-whitelabel-overview , https://docs.synthflow.ai/agency-whitelabel-dashboard.md):
  - Branded app on a **custom domain**.
  - **Subaccounts** with permissions and limits.
  - Agency-defined **pricing plans**, minutes allocated per subaccount, and optional usage-based billing for subaccounts (reportedly Stripe rebilling [3p]).
  - The Growth tier is about 25 subaccounts plus rebilling. https://synthflow.ai/ghl

### SMB AI receptionists (self-serve, minutes to set up)
- **Goodcall** [vendor/3p]:
  - Setup "in minutes" from a website, Google listing or business details.
  - Each agent gets **its own local number**, which you publish or forward your existing line to. A competitor says forwarding must stay on and the number cannot be kept [3p, biased].
  - Booking is either native or an SMS link via Zapier; sources conflict.
  - Billing is by **unique callers** (about $79/$129/$299 for 100/500/2,000 callers) with no per-minute charge.
  - https://www.goodcall.com/ , https://www.usecarly.com/blog/goodcall/ , https://trycentral.com/versus/central-vs.-goodcall
- **Smith.ai:**
  - An **AI plus human hybrid**: AI handles calls, with North America-based live agents as backup.
  - Spam blocking and lead qualification on all plans. Billed **per call**, not per minute; reports range from $95/month to "Pro $150" [3p conflict].
  - Dedicated onboarding only on higher tiers, and "full-service setup and ongoing optimization" only on the top tier. Reviews complain about a lack of onboarding help on lower tiers.
  - https://getvoip.com/blog/smith-ai-receptionist/ , https://www.quo.com/blog/smith-ai-pricing/ , https://www.clutch.co/profile/smithai
- **Rosie:**
  - Trains itself from the **Google Business Profile plus website**; you review, then **forward calls** and it answers immediately. https://heyrosie.com/partnerships/home-depot , https://www.cloudtalk.io/blog/rosie-ai-review/
  - Tiers by minutes: about $49/250, $149/1,000, $299/2,000. Booking and live transfer from $149. Overage terms are disputed (auto-upgrade vs $0.25/min) [3p]. https://cloudtalk.io/blog/rosie-ai-answering-service-pricing
- **My AI Front Desk:**
  - Vendor onboarding checklist: define after-hours behaviour, build the knowledge base from common questions, **map services to calendar durations and buffers**, then connect apps via Zapier. https://llms.myaifrontdesk.com/ai-front-desk-onboarding-setup-checklist
  - Native Google Calendar sync or Zapier. Confirms and reminds by SMS, and texts back after missed calls. https://llms.myaifrontdesk.com/google-calendar-integration
  - Starter about $79/month annual, $0.12 per minute overage [vendor]. https://llms.myaifrontdesk.com/google-calendar-zapier-one-step-booking
  - **White-label reseller program:** partners sell under their own brand and own the client relationship. Includes Zapier, API workflows and post-call webhooks. https://frontdesk-ai-lq0.myaifrontdesk.com/services/index.html , https://frontdesk-ai-lq0.myaifrontdesk.com/faq/index.html

### Lindy and Relevance AI (general agent builders)
- **Lindy:**
  - Integrations are added on the workflow canvas as triggers or actions, then "add account" (OAuth) and pick which calendar. Calendar triggers fire on new or changed events (with old and new values); actions include finding times and updating events [doc]. https://docs.lindy.ai/skills/popular-integrations/google-calendar
  - Template library [vendor]. "Confirm before sending" approvals are covered in the dashboard note.
- **Relevance AI:**
  - Agent Chat can be embedded as a website widget with custom colours and icons. Every interaction spends credits. https://relevanceai.com/posts/2024-12-12-introducing-agent-chat
  - Managed OAuth and API-key flows with automatic token refresh, a credential vault per org and project, and a connected account chosen per tool. https://relevanceai.com/features
  - Premium triggers cost +5,000 credits per month per connected account. https://relevanceai.com/docs/agent/build-your-agent/agent-triggers/integrations
  - Credit plans: Free 100/day, Pro $19, Team $199, Business $599 (from an "old" pricing page, so may be outdated). https://relevanceai.com/pricing-old

---

## 2. Agencies delivering to SMBs

- **Platforms used:**
  - **Synthflow agency** (native white label, subaccounts, rebilling, custom domain; see above).
  - **Vapify** on Vapi or Retell: branded dashboard, domain, email, custom monthly pricing and markup, an isolated subaccount per client, GoHighLevel integration on the top tier; about $29-399/month [3p]. https://docs.vapi.ai/providers/vapify , https://www.retellai.com/partner/vapify
  - **Getflowetic:** Vapi/Retell/n8n client dashboards with Stripe billing [3p]. https://www.g2.com/sellers/getflowetic
- **GoHighLevel "AI Employee"** [3p, verify]:
  - Usage pricing: about $0.13-0.26 per Voice AI minute and $0.02-0.03 per Conversation AI message, **or** a bundle of about $97 per subaccount per month for unlimited use.
  - In SaaS Mode ($497), agencies **rebill** per subaccount at their own price; typical resale is $197-397/month as an "AI receptionist".
  - https://ecosire.com/blog/gohighlevel-ai-employee-guide
- **My AI Front Desk white label** (above). The agency owns the client relationship.
- **Typical agency delivery** [3p, self-promotional]:
  - Discovery or onboarding call to collect access, FAQs, calendar link and voice/tone.
  - Build with weekly updates.
  - **1-2 weeks of client-involved test calls**.
  - Handoff call, which doubles as an upsell.
  - Some quote **6 days** from kickoff to launch.
  - Sources: https://growwstacks.com/blog/how-to-start-your-voice-ai-agency-in-2026/ , https://contra.com/community/r5jgjdis-automate-call-handling-with-custom-247 , https://p0stman.com/industries/saas/
- **Agency pricing seen** [3p]:
  - Setup fee $300-1,000 (used partly to filter out tyre-kickers), £500-2,000 with calendar and CRM integration, or $3k setup + $297/month.
  - Retainers of about £70-350/month by volume.
  - Sources: https://autocalls.ai/article/how-to-start-ai-calling-agency , https://www.lilachbullock.com/ai-voice-agents-small-business-cost/
- **Takeaway:** Agencies win on done-for-you setup, local trust and owning the client. Their weak spots are per-client manual workspaces (Retell has no workspace-creation API) and stitching billing together.

---

## 3. Cross-cutting delivery facts

- **Phone numbers, three options:**
  1. A new number from the vendor (fastest; Goodcall, Retell, Lindy).
  2. **Call forwarding** from the existing line (Rosie, Goodcall). Lowest friction for SMBs, but the forwarding must stay on.
  3. **SIP trunk or import** keeping the number at the carrier (Retell, Vapi).
  - Porting is rarely the default.
- **Conditional forwarding enables an "overflow/after-hours first" rollout.** Codes: `*61` no answer, `*67` busy, `*62` unreachable; disable with `##61#`. Comcast Business uses `*71`/`*90` and Verizon differs; Boost supports only all-calls forwarding (`*72`). iPhone Live Voicemail can intercept calls before they forward. **Test each condition per carrier.**
  - https://support.google.com/voice/answer/165656?hl=en
  - https://support.800.com/en-us/hc/articles/47188674381325-call-forwarding-codes-by-mobile-carrier
  - https://wiki.seasalt.ai/seachat/inbound-voice-agent/call-forwarding-setup/business/
- **US SMS needs A2P 10DLC registration.**
  - Sole-proprietor route (businesses with no EIN): $4 brand + $15 campaign vetting + $2/month. Limits: 1 campaign, 1 number, 1 message per second, and verification needs a US/CA mobile number.
  - Businesses with an EIN use Standard registration ($44 brand).
  - Approval time n/f; plan for days to weeks (inference).
  - Sources: https://support.twilio.com/hc/en-us/articles/1260803965530 , https://support.twilio.com/hc/en-us/articles/4407882914971-Comparison-between-Starter-Low-Volume-Standard-and-Standard-registration-for-A2P-10DLC
- **WhatsApp** requires being a Tech Provider or Solution Partner and using **Embedded Signup**.
  - The customer logs into Meta, grants access, picks or creates a WABA, verifies a number that has never been on WhatsApp, and sets a display name.
  - Your server exchanges the code for a business token, registers the number, and subscribes to webhooks.
  - Limit: 10 new customers per 7 days, or 200 after verification and app review.
  - The display name is approved after Business Verification, and strict-match rejections are common.
  - Sources: https://developers.facebook.com/documentation/business-messaging/whatsapp/embedded-signup/overview/ , https://docs.360dialog.com/docs/waba-management/embedded-signup/signup-step-by-step
- **Rollout patterns:**
  - Audience or segment rules (Fin).
  - Traffic split or canary releases (Vapi, Decagon).
  - **Shadow mode** for specific groups (Freshworks email agent). https://crmsupport.freshworks.com/support/solutions/articles/50000014350-deploy-email-ai-agent-in-shadow-mode
  - Copilot or draft mode before autonomy, and one channel at a time with strict escalation [3p]. https://www.eesel.ai/blog/ai-agent-coaching-for-support
  - No standard percentage schedule is published (n/f).
  - For SMB voice the natural ramp is **after-hours, then overflow (no answer or busy), then all calls** (inference from the forwarding codes above).
- **Pricing models in the market:**
  - Per outcome or resolution: Fin, Sierra, Decagon option, Zendesk.
  - Per conversation: Decagon, Ada.
  - Per action or credit: Agentforce, Relevance, Lindy.
  - Per minute: Retell, Vapi, Bland, Rosie tiers, GoHighLevel.
  - Per unique caller: Goodcall. Per call: Smith.ai.
  - Bundled flat fee: GoHighLevel at $97.
  - SMB receptionists favour **flat tiers with allowances**. Enterprises favour a platform fee plus outcomes.
- **Who does the work:**
  - Enterprise vendors (Sierra, Decagon, Bland, Synthflow enterprise) sell **forward-deployed engineers or agent PMs** with weeks-long launches.
  - SMB products are **self-serve in minutes**, with done-for-you setup gated to top tiers (Smith.ai) or provided by **agencies**.
- **SLAs:** Rarely public. Vapi lists SLAs only on enterprise; Retell has none published; pay-as-you-go support is email or community. This leaves room for a small company to offer a **human response promise** as a differentiator (inference).

---

## 4. Recommended delivery lifecycle for Wyrm AI

**Constraints:** a tiny team on free tiers; a Next.js + Supabase portal; Groq/Claude models; SMB clients. The ReceptionAI rules apply: tenant isolation, explicit booking confirmation, and no customer data in fixtures. The model is a **"done-with-you" hybrid**: the portal is self-serve for facts, and Wyrm owns the risky steps (phone, integrations, go-live sign-off). This sits between Rosie (self-serve) and agencies (done-for-you).

### Stage 0: Qualify and sign (Day 0)
- **Customer, in the portal or on the website:** signup, business name, industry template, main phone, website URL, and goal (bookings, leads or FAQ). Accept terms.
- **Wyrm:** a 20-minute discovery call that confirms scope. Use a written "what the agent will not do" list.
- **Checklist:**
  - Plan chosen.
  - Billing owner named.
  - Data-processing and recording-consent stance agreed (recording disclosure).

### Stage 1: Auto-draft (Day 0-1)
- **Wyrm (automated):** crawl the website plus Google Business Profile (the Rosie and Goodcall pattern) into a **draft** set of facts: hours, services with durations and prices, location, policies and FAQs. Every fact is labelled with its source, and nothing goes live without the owner's confirmation.
- **Customer:** reviews and edits each draft fact and marks it confirmed. Adds services, durations and buffers (the My AI Front Desk checklist), and the handoff contacts.
- **Checklist:**
  - All required facts confirmed: hours, services, address, handoff number or email, booking rules.
  - "Unknown" questions get a fallback answer.

### Stage 2: Connect (Day 1-3)
- **Customer:** one-click OAuth for Google or Microsoft calendar (the Lindy and Relevance pattern). Wyrm stores the token per tenant in Supabase, encrypted, with refresh handled.
- **Wyrm:** provision a test number, or have the client use the web chat widget snippet first. Configure the notification email.
- **Checklist:**
  - Calendar connected; a test read of free/busy succeeds.
  - Notification email verified.
  - Field whitelist set (Fin "restricted data access").

### Stage 3: Test (Day 2-5)
- **Wyrm:** run a **standard test pack** for the industry template (about 30 scripted caller scenarios), plus owner-specific cases. Use Groq for cheap text-mode runs and a few real voice calls, and grade against criteria (the Fin, Vapi, Retell and Agentforce pattern).
  - Must include rejected dates and times, corrections, asides, a booking that needs explicit confirmation, and a handoff.
  - Use fictional callers only.
- **Customer:** "Try it" chat or call in the portal (unbilled, like the Fin preview). Make 3-5 practice calls; each issue is flagged with "fix this".
- **Checklist (go-live gate):**
  - All critical scenarios pass.
  - The owner has made at least 3 test calls.
  - Handoff reaches a human.
  - Booking appears on the calendar only after the caller confirms.
  - Recording disclosure plays.
  - Published version saved (rollback point).

### Stage 4: Phased go-live (Week 1-2)
- **Phase A, after-hours only:** the owner sets all-calls or time-based forwarding outside opening hours, or Wyrm schedules it.
- **Phase B, overflow:** `*61`/`*67` no-answer or busy forwarding during the day.
- **Phase C, primary line:** all calls, or a new published number.
- For web chat: start on one page or audience, then go site-wide.
- **Wyrm** gives the owner carrier-specific forwarding instructions in the portal and **verifies each condition with a real test call**.
- **Checklist:**
  - Forwarding verified per condition.
  - Owner knows the pause switch and the `##` disable code.
  - Alert set if no calls are answered for X hours in business hours.

### Stage 5: Hypercare and optimise (Weeks 1-4, then monthly)
- **Wyrm:** read every transcript in week 1, then a daily needs-attention sweep. Turn each failure into a regression test (the Bland and Vapi pattern). Send a weekly email digest with the top 3 suggested fixes (the Fin pattern).
- **Customer:** works the needs-attention queue, accepts or rejects suggested fact edits, and answers "unknown question" prompts.
- **Exit criteria** to move from hypercare to steady state: two weeks with no critical failures and a booking or handoff accuracy target met.
- After that, a 15-minute monthly review call or async report.

### Stage 6: Expand
- Add SMS and WhatsApp only when needed: A2P 10DLC (sole-prop $4 + $15 + $2/month) and Meta Embedded Signup involve approval lead times and Tech Provider status, so these are paid-tier add-ons. Add CRM via webhook or Zapier before building native integrations.

### Pricing and support recommendation (inference)
- **Pricing:** a flat monthly tier with a call or conversation allowance (like Goodcall and Rosie), plus an optional one-off setup fee (the agency norm of $300-1,000).
  - Avoid "assumed resolution" style billing.
  - Show usage vs allowance with an 80% warning (dashboard note).
- **Support:** publish a plain promise, for example "a human reply within 1 business day; critical (agent down) same day in business hours". No uptime SLA until the infrastructure is off free tiers.

### What to build first (in order)
1. **Onboarding checklist page in the portal**, with a per-tenant row of stage and items (Supabase table) that both the customer and Wyrm see, plus the go-live gate. This makes delivery repeatable.
2. **Website/GBP crawl to draft facts, then a confirm UI** (draft vs confirmed, with source URL). Re-crawl weekly and surface diffs as suggestions, never auto-publish (Intercom's weekly sync is the bar; Ada's 15 minutes is overkill for SMB).
3. **Test pack runner:** scripted scenarios per industry template, run in text mode against a draft version, with a pass/fail report stored per version. Gate "Publish" on it.
4. **Draft/publish/rollback** of the agent config, and a pause switch.
5. **Calendar OAuth connect** with a health check, plus a token-expiry alert.
6. **Forwarding wizard:** pick the carrier, see the codes for after-hours or overflow, then "call me to verify" and record the result.
7. **Needs-attention queue, weekly digest, and "turn this call into a test".**
8. Later: SMS (10DLC), WhatsApp (Embedded Signup), CRM webhooks, and an agency/subaccount mode (the Synthflow/Vapify pattern) if partners resell Wyrm.

### Open gaps (n/f)
- Published time-to-live numbers for Fin, Decagon, Ada and Zendesk.
- Standard percentage-ramp schedules.
- 10DLC approval times.
- Retell and Vapi SLA terms.
- Goodcall's current booking mechanics.
