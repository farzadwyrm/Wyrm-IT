# Agent suitability, risk tiers and human-in-the-loop guardrails for SMB workflows

Research date: 2026-10-20. Every claim has a source. Items marked "secondary" come from summaries, not primary documents.

## 1. LLM agents vs RPA / deterministic automation: which suits which task?

### Takeaway
Use agents only where deterministic rules fail: nuanced judgement or exceptions, rule sets too complex to maintain, or heavy unstructured input (email, documents, conversation). For stable, structured, repetitive steps, RPA or plain code is still faster, more reliable and auditable. The practical pattern is a hybrid: the LLM interprets and decides, deterministic code executes.

### Cited Findings
- OpenAI says agents suit "workflows where traditional deterministic and rule-based approaches fall short". It names three criteria: (1) complex decision-making (nuanced judgement, exceptions, context-sensitive decisions, e.g. refund approval), (2) difficult-to-maintain rules (e.g. vendor security reviews), (3) heavy reliance on unstructured data (interpreting natural language, extracting meaning from documents, talking with users, e.g. a home insurance claim). The guide adds: "validate that your use case can meet these criteria clearly. Otherwise, a deterministic solution may suffice." — [OpenAI, A practical guide to building agents (PDF, 2025)](https://cdn.openai.com/business-guides-and-resources/a-practical-guide-to-building-agents.pdf)
- OpenAI contrasts a rules engine that "works like a checklist" with an LLM agent that acts like an investigator weighing context (payment fraud example). — [OpenAI guide](https://cdn.openai.com/business-guides-and-resources/a-practical-guide-to-building-agents.pdf)
- Anthropic separates workflows ("LLMs and tools are orchestrated through predefined code paths") from agents (LLMs that "dynamically direct their own processes and tool usage"). Its guidance:
  - Find "the simplest solution possible", adding complexity only when it demonstrably improves outcomes.
  - Many applications need only a single LLM call with retrieval and examples.
  - Workflows suit well-defined tasks; agents suit open-ended problems where the number of steps can't be predicted.
  - Agents trade higher cost and latency for performance, and errors can compound.
  — [Anthropic, Building effective agents](https://www.anthropic.com/engineering/building-effective-agents)
- One controlled study (Průcha et al., arXiv 2509.04198, Sept 2025) tested three enterprise tasks: data entry, monitoring, document extraction. It compared UiPath RPA with Anthropic's computer-use agent:
  - RPA beat the agent on speed and reliability, especially in repetitive, stable environments.
  - The agent cut development time and adapted better to changing interfaces.
  - The authors judged agents not yet production-ready and proposed hybrid RPA+agent architectures.
  - The sample is small: one RPA tool and one agent.
  — [arXiv 2509.04198](https://arxiv.org/abs/2509.04198v1)
- Practitioner view (secondary/opinion): RPA is deterministic and auditable but brittle when interfaces change, and it can't handle off-script cases. Hybrids use agents for reading unstructured email, classifying documents, routing and exceptions, and RPA for fixed-form execution. — [TechTarget, AI agents vs RPA](https://www.techtarget.com/ai/tip/Compare-AI-agents-vs-RPA-Key-differences-and-overlap)
- Anthropic's Economic Index suggests context, not model capability, may limit enterprise automation of complex work. Complex tasks need long inputs, and firms may need to centralise their data first. — [Anthropic Economic Index, Sept 2025](https://www.anthropic.com/research/anthropic-economic-index-september-2025-report)

### Inferences
- Per-step decision rule for SMBs:
  - Structured input + fixed rules + must be exact (sums, calendar writes, invoice posting, data sync) → deterministic code, RPA or an integration platform.
  - Unstructured input or judgement + low impact → an AI agent or an LLM step inside a fixed workflow.
  - Unstructured input + high impact → an LLM drafts or proposes, and a human or deterministic validator approves.
- "Workflow with an LLM step" (Anthropic's term) is likely right for most SMB processes. A free-roaming agent is warranted only when step order truly can't be predicted.
- A reliability or determinism requirement should push a step toward code even when the input is unstructured. For example, the LLM extracts fields, then code validates them against a schema.

### Gaps
- No rigorous SMB-specific comparison of RPA vs agents was found. The evidence base is one small academic study plus vendor and practitioner opinion.
- Google Cloud's agent guidance was not reviewed here, because of the tool-call budget.

## 2. Task-level decomposition rubrics (exposure, automation vs augmentation)

### Takeaway
The established method breaks jobs into O*NET tasks and rates each one. Examples:
- OpenAI "GPTs are GPTs": exposure tiers E0–E3 with a 50% time-saving threshold.
- Stanford WORKBank: worker desire, AI capability and a Human Agency Scale from H1 to H5.
- Anthropic Economic Index: observed automation vs augmentation modes.

These map naturally onto a per-step "automate / agent + check / assist / human" label.

### Cited Findings
- **GPTs are GPTs (Eloundou et al., arXiv 2303.10130)** rates O*NET tasks and detailed work activities:
  - E0: no exposure. The LLM can't cut time by at least 50% at equal quality, or the task needs in-person or physical work.
  - E1: direct exposure. The LLM alone halves the time.
  - E2: exposure via LLM-powered software, e.g. long documents, retrieving current facts.
  - E3: exposure given image capabilities.
  - Aggregates: α = E1 (lower bound), β = E1 + 0.5×E2 (preferred), ζ = E1 + E2 (upper bound). Core tasks are weighted twice as heavily as supplemental ones.
  - Labels came from humans and from GPT-4 given the rubric. The authors call the 50% threshold somewhat arbitrary.
  — [arXiv 2303.10130 (HTML v5)](https://arxiv.org/html/2303.10130v5)
- Headline results from the same paper:
  - About 80% of US workers could have at least 10% of their tasks affected, and about 19% at least 50%.
  - About 15% of tasks could be done significantly faster at equal quality with LLM access, rising to 47–56% with LLM-powered software.
  — [arXiv 2303.10130](https://arxiv.org/abs/2303.10130)
- **WORKBank (Shao et al., Stanford, arXiv 2506.06576)**: 844 tasks, 104 occupations, 1,500 workers, plus AI-expert capability ratings.
  - Human Agency Scale:
    - H1: the AI handles the task entirely.
    - H2: the AI needs minimal human input.
    - H3: equal partnership.
    - H4: the AI needs human input to succeed.
    - H5: continuous human involvement is required.
  - Zones: Automation "Green Light" (high desire, high capability), "Red Light" (high capability, low desire), R&D Opportunity (high desire, low capability), Low Priority.
  - 46.1% of tasks got a positive automation-desire rating.
  - H3 was the dominant desired level in 47 of 104 occupations.
  - Top reason for wanting automation: freeing time for higher-value work (69.4%).
  - Top concern among those negative about AI: distrust of accuracy or reliability (45%).
  — [arXiv 2506.06576 (HTML)](https://arxiv.org/html/2506.06576)
- **Anthropic Economic Index** classifies conversations into five modes:
  - Automation: directive (a task completed with little back-and-forth) and feedback loop.
  - Augmentation: task iteration, learning, validation.
  - On Claude.ai, directive share rose from 27% (late 2024) to 39% (Aug 2025).
  - Enterprise API traffic is 77% automation; 97% of API tasks are automation-dominant.
  — [Anthropic Economic Index, Sept 2025 report](https://www.anthropic.com/research/anthropic-economic-index-september-2025-report)
  - Later data (secondary, Nov 2025) reportedly showed Claude.ai back at 52% augmentation vs 45% automation. — [Dror Poleg tracker (secondary)](https://www.drorpoleg.com/charts/ai-at-work/); figures not verified against the primary source.
- **Microsoft Work Trend Index 2025** proposes a "human-agent ratio": how many agents a role needs and how many humans should guide them. It calls the right ratio task-specific, and introduces the "agent boss" role. — [Microsoft WTI 2025 news release](https://news.microsoft.com/source/asia/2025/04/24/the-2025-annual-work-trend-index-the-frontier-firm-is-born/)

### Inferences
- A workable SMB rubric per workflow step could combine three scores:
  1. Exposure: can an LLM or tool cut time by 50% at equal quality? Adapted from E0–E2.
  2. Desired human agency (H1–H5), asked of the owner or staff.
  3. Impact or risk tier (see section 4).
- Rough mapping from those scores to an action:
  - H1–H2, low risk → automate fully (deterministic if structured, agent if unstructured).
  - H2–H3, medium risk → AI agent with a human check.
  - H3–H4 → AI-assist (drafts, summaries, validation).
  - H5 or E0 (physical, in-person, relationship-critical) → keep human.
- WORKBank's "Red Light" zone is a reminder to ask staff and owners about desire, not just capability, before automating.

### Gaps
- None of these studies is SMB-specific. All use US O*NET occupations, not business-process steps.
- The primary Microsoft report's numeric details were not verified (only the news release).

## 3. Agent design guidance, autonomy levels and human-in-the-loop patterns

### Takeaway
Vendor guidance converges on several practices:
- Start simple.
- Rate each tool's risk by write access, reversibility, permissions and financial impact.
- Layer guardrails.
- Escalate to a human on repeated failure or on high-risk, irreversible actions.
- Limit iterations.
- Test in sandboxes.

Autonomy frameworks (Feng et al.'s L1–L5, AWS Scopes 1–4) give a vocabulary for setting how much an agent may do without approval.

### Cited Findings
- **OpenAI on tool risk:** assign each tool a low, medium or high rating "based on factors like read-only vs. write access, reversibility, required account permissions, and financial impact". Use the ratings to trigger guardrail checks before high-risk functions or to escalate to a human. — [OpenAI guide](https://cdn.openai.com/business-guides-and-resources/a-practical-guide-to-building-agents.pdf)
- **OpenAI guardrail layers:** relevance classifier, safety classifier (jailbreaks and prompt injection), PII filter, moderation, tool safeguards, rules-based protections (blocklists, input limits, regex) and output validation. — [OpenAI guide](https://cdn.openai.com/business-guides-and-resources/a-practical-guide-to-building-agents.pdf)
- **OpenAI human-intervention triggers:**
  - Exceeding failure thresholds, e.g. failing to understand intent after multiple attempts.
  - High-risk actions: "sensitive, irreversible, or have high stakes" actions, such as cancelling orders, large refunds or payments, until confidence in the agent's reliability grows.
  - Human intervention is especially important early in deployment, to build an evaluation cycle.
  — [OpenAI guide](https://cdn.openai.com/business-guides-and-resources/a-practical-guide-to-building-agents.pdf)
- **Anthropic** recommends:
  - Agents pause for human feedback at checkpoints or blockers.
  - Stopping conditions such as a maximum number of iterations.
  - Checking ground truth from the environment at each step.
  - Extensive testing in sandboxed environments.
  - A separate model instance to screen inputs.
  — [Anthropic, Building effective agents](https://www.anthropic.com/engineering/building-effective-agents)
- **Autonomy levels (Feng, McDonald, Zhang, arXiv 2506.12469, 2025)** are defined by the user's role:
  - L1 Operator: the user decides and the agent executes.
  - L2 Collaborator: shared planning and execution.
  - L3 Consultant: the agent leads and asks for expertise or preferences.
  - L4 Approver: the agent asks only for risky or pre-specified situations.
  - L5 Observer: full autonomy, with the user monitoring.
  - The authors treat autonomy as a design choice separate from capability, and propose "autonomy certificates".
  — [arXiv 2506.12469](https://arxiv.org/abs/2506.12469v1); also used by the [2025 AI Agent Index](https://arxiv.org/pdf/2602.17753)
- **AWS Agentic AI Security Scoping Matrix (21 Nov 2025)** separates agency (what the agent may do) from autonomy (how independently it acts):
  - Scope 1, no agency: read-only, human-triggered, humans approve outputs.
  - Scope 2, prescribed agency: human approval required for all consequential actions. Controls include MFA for approvers, signed and time-limited approvals, and approval logs.
  - Scope 3, supervised agency: the agent plans and acts toward a human goal, and per-action approval is optional. Controls include execution boundaries, real-time monitoring, kill switches and sandboxed tools.
  - Scope 4, full agency: self-initiated and continuous. Controls include anomaly detection, tamper-proof override, and halting when confidence drops. "The agent must not be able to disable its own oversight."
  — [AWS Security Blog](https://aws.amazon.com/blogs/security/the-agentic-ai-security-scoping-matrix-a-framework-for-securing-autonomous-ai-systems/)
- **NIST AI 600-1** lists "Human-AI Configuration" as a GenAI risk. That covers automation bias, over-reliance and emotional entanglement, which matters for rubber-stamp approvals. — [NIST AI 600-1 PDF](https://nvlpubs.nist.gov/nistpubs/ai/NIST.AI.600-1.pdf)

### Inferences
- HITL pattern menu for SMB steps:
  - Pre-approval: the agent proposes and a human clicks approve. Use for money, irreversible actions, external messages in high-stakes contexts.
  - Escalate on low confidence or failure threshold, with a handoff to staff.
  - Post-hoc sample review: audit N% of outputs, rising after incidents. Use for low-risk, reversible, high-volume steps.
  - Monitor and kill switch: for autonomous low-risk steps.
- Rough mapping: "keep human" = L1; "AI-assist" = L1–L2 / AWS Scope 1; "agent with human check" = L3–L4 / Scope 2; "automate fully" = L5 / Scope 3, used only for low-risk, reversible steps. AWS Scope 4 is rarely appropriate for SMBs.
- Approval UIs must fight automation bias (NIST's Human-AI Configuration risk). Ideas: show the reason and source data, require approvers to edit or confirm key fields, and track approval rates.

### Gaps
- No primary data was found on accuracy thresholds (e.g. "automate when accuracy ≥ X%"). Thresholds must be set per task from evaluations.
- Google Cloud/Gemini agent guidance was not retrieved.

## 4. Risk tiering: EU AI Act, NIST AI RMF, ISO/IEC 42001 and mapping a step's impact to a tier

### Takeaway
For most SMB agents (reception, scheduling, customer email, admin), the EU AI Act's main duty is Article 50 transparency: tell people they are dealing with AI. It applies from 2 Aug 2026. Steps touching employment (hiring, task allocation by personal traits, performance monitoring) or credit and life/health-insurance decisions are Annex III high-risk. Since the Digital Omnibus, those obligations apply from 2 Dec 2027.

NIST AI RMF (Govern/Map/Measure/Manage) and ISO/IEC 42001 (impact assessment controls A.5) give the process for a per-step impact-based tiering.

### Cited Findings
- **EU AI Act timeline after the Digital Omnibus** (per law-firm summaries):
  - Prohibitions and AI literacy have applied since 2 Feb 2025.
  - GPAI obligations since 2 Aug 2025.
  - Article 50 transparency from 2 Aug 2026, with a grace period for machine-readable marking until 2 Dec 2026 for systems already on the market.
  - Annex III high-risk obligations deferred from 2 Aug 2026 to 2 Dec 2027.
  - Annex I (AI in regulated products) deferred to 2 Aug 2028.
  - Sandbox deadline moved to Aug 2027.
  - New ban on AI generating non-consensual intimate imagery and CSAM, with a transition to 2 Dec 2026.
  - The Omnibus proposal softened Article 4 AI literacy toward providers and deployers "supporting" staff literacy.
  — [Gibson Dunn](https://www.gibsondunn.com/eu-ai-act-omnibus-agreement-postponed-high-risk-deadlines-and-other-key-changes/); [Orrick, July 2026](https://www.orrick.com/en/Insights/2026/07/EU-AI-Act-Update-Digital-Omnibus-Finalizes-8-Compliance-Changes)
  - Search summaries report the Omnibus was adopted as Regulation (EU) 2026/1744, published in the OJ 24 July 2026 and in force 27 July 2026. I did not verify this directly on EUR-Lex. The Gibson Dunn page I fetched was written before adoption (provisional deal of 6–7 May 2026). Some older pages (DLA Piper, Usercentrics) predate adoption and say the delay was not agreed; disregard those.
- **Article 50 duties:**
  - Providers must ensure people know they are interacting with an AI system unless obvious.
  - Providers must machine-readably mark synthetic audio, image, video and text.
  - Deployers must disclose deepfakes and AI-generated public-interest text (unless human editorial review).
  - Deployers must inform people exposed to emotion recognition or biometric categorisation.
  - Information must be given at the latest at first interaction.
  — [AI Act Art. 50 (artificialintelligenceact.eu)](https://artificialintelligenceact.eu/article/50/)
- **Annex III high-risk areas relevant to SMBs:**
  - Employment: recruitment, filtering and evaluating applications, task allocation based on behaviour or personal traits, promotion and termination decisions, performance monitoring.
  - Essential private services: creditworthiness and credit scoring (excluding fraud detection), and life/health insurance risk and pricing.
  - Also: biometrics including emotion recognition, education, critical infrastructure, emergency call triage.
  — [AI Act Annex III](https://artificialintelligenceact.eu/annex/3/)
- **Article 6(3) exception:** an Annex III system is not high-risk if it doesn't materially influence decisions and does one of the following:
  - a narrow procedural task;
  - improving the result of a completed human activity;
  - detecting patterns without replacing human assessment;
  - a preparatory task.
  Systems that profile natural persons are always high-risk. Providers relying on the exception must document the assessment and register (Art. 6(4), 49(2)). — [AI Act Art. 6](https://artificialintelligenceact.eu/article/6/)
- **NIST AI RMF 1.0** (26 Jan 2023, voluntary) is being revised under the White House AI Action Plan. The GenAI Profile, NIST AI 600-1, came out 26 Jul 2024. — [NIST AI RMF page](https://www.nist.gov/itl/ai-risk-management-framework)
  - The four functions: Govern (policies, accountability, culture), Map (context and risks), Measure (assess and track), Manage (prioritise and respond). These descriptions are standard but were not re-verified on the page in this session.
  - The 12 GenAI risks are verified from the PDF: CBRN; Confabulation; Dangerous/Violent/Hateful content; Data Privacy; Environmental; Harmful Bias/Homogenization; Human-AI Configuration; Information Integrity; Information Security; Intellectual Property; Obscene/Abusive content; Value Chain and Component Integration. — [NIST AI 600-1](https://nvlpubs.nist.gov/nistpubs/ai/NIST.AI.600-1.pdf)
- **ISO/IEC 42001:2023** is an AI management system standard. Mandatory clauses 4–10 plus Annex A (38 controls, A.2–A.10), selected through a Statement of Applicability. A.5 requires AI system impact assessment: a process (A.5.2), documentation (A.5.3), impacts on individuals and groups (A.5.4), and societal impacts (A.5.5). Assessments may cover fairness, privacy, safety, financial effects and human oversight. These sources are vendor and consultancy summaries, and they disagree on whether Annex A is "normative". — [SureCloud](https://www.surecloud.com/resource-hub/iso-42001-annex-controls); [CertPro](https://certpro.com/hub/iso-42001/controls/iso-42001-controls-list/)
- **Agent-specific tiering:** the TrustX Agent Risk Classification framework (arXiv 2607.09586) maps autonomy levels to governance, with higher autonomy requiring more rigorous controls. Seen only via search snippet; not read in full. — [arXiv 2607.09586](https://arxiv.org/pdf/2607.09586)

### Inferences
- Proposed SMB per-step risk tier. Score each step on: money, customer impact, legal/regulatory, safety, personal data, reversibility, external visibility. The highest dimension sets the tier.
  - **Tier 1, low:** internal, read-only or easily reversible; no personal or sensitive data; no money. Examples: summarising internal notes, tagging emails, drafting internal docs.
    - Guardrails: automate fully; logging; periodic sample review; iteration limits.
  - **Tier 2, moderate:** customer-facing but reversible; routine personal data; small or no money. Examples: answering FAQs, proposing appointment slots, a reply draft sent under a template.
    - Guardrails: Article 50 AI disclosure; scoped tool permissions; output validation; confidence or failure-threshold escalation; sample review; PII filtering.
  - **Tier 3, high:** money movement, refunds, contracts or commitments; irreversible writes such as deletion, cancellation or booking confirmation; sensitive personal data (health, etc.); legal or regulatory statements.
    - Guardrails: human pre-approval per action, or deterministic validation plus explicit customer confirmation; audit trail; least privilege; spend caps.
  - **Tier 4, restricted / keep human or regulated:** Annex III-type decisions (hiring and screening, staff performance evaluation, credit or insurance eligibility), safety-critical or emergency triage, prohibited practices.
    - Keep human as the decision-maker, with AI only for preparation (Art. 6(3) style) and documented. If the system is high-risk, plan for the Dec 2027 obligations.
- The tier caps the classification: Tier 1 may be automated fully, Tier 2 at most "agent + human check or sampling", Tier 3 at most "agent proposes, human approves", Tier 4 "keep human / AI-assist only".
- NIST functions can frame the SMB method:
  - Govern: owner, policy, logging.
  - Map: per-step inventory and impact scoring.
  - Measure: evaluation set, error rates, override rates.
  - Manage: guardrails, escalation, incident review.
- ISO 42001 A.5 impact assessment is the auditable version of the same exercise.

### Gaps
- I did not read the Omnibus final text on EUR-Lex. The regulation number and dates come from secondary legal summaries.
- No authoritative SMB-specific EU guidance on Article 50 implementation (Commission guidelines or code of practice on transparency) was retrieved.
- GDPR Art. 22 (automated decision-making) is highly relevant to customer-affecting automated decisions but was outside the sources gathered here.
- ISO/IEC 42001 text is paywalled; only secondary summaries were used.
