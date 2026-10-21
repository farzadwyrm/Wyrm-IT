# Main-brain orchestration for SMB business agents — research notes

Date: 2026-10-21. Scope: how production AI systems (2025–2026) use a central orchestrator/supervisor to manage receptionist/phone, booking, follow-up, quotes/invoices and FAQ/support agents, and what Wyrm AI should build. Every claim carries its source URL. Vendor numbers are vendor-reported unless stated otherwise. Where only secondary summaries were available, this is flagged.

---

## 1. Orchestration patterns

### 1.1 Workflows vs agents, and "start simple"
- Anthropic separates **workflows** (LLMs and tools orchestrated "through predefined code paths") from **agents** (the LLM directs its own process and tool use). https://www.anthropic.com/engineering/building-effective-agents
- Core advice: find "the simplest solution possible, and only [increase] complexity when needed"; for many apps a single optimised LLM call with retrieval and examples is enough. Agentic systems trade latency and cost for performance. https://www.anthropic.com/engineering/building-effective-agents
- Workflows suit well-defined tasks; agents suit open-ended problems where step count cannot be predicted, at the price of higher cost and compounding errors. https://www.anthropic.com/engineering/building-effective-agents
- Frameworks can "obscure the underlying prompts"; start with direct API calls. https://www.anthropic.com/engineering/building-effective-agents
- OpenAI Agents SDK: **orchestration via code** (structured outputs, chaining, evaluator loops) is "more deterministic and predictable" in speed, cost and performance; orchestration via LLM suits open-ended tasks; both can be mixed. https://openai.github.io/openai-agents-python/multi_agent/
- LangChain: a single agent with the right tools and prompt can often match a multi-agent system; multi-agent pays off for context management, independent team development, parallelism, too many tools for one agent, or gated steps. https://docs.langchain.com/oss/python/langchain/multi-agent
- OpenAI's practical guide (as summarised by third parties; primary PDF at https://cdn.openai.com/business-guides-and-resources/a-practical-guide-to-building-agents.pdf, not machine-readable in this session) recommends maximising a single agent first and splitting only for complex logic or tool overload. https://www.maginative.com/article/how-to-build-ai-agents-a-detailed-practical-guide-from-openai/

### 1.2 The named patterns
| Pattern | What it is | Source |
|---|---|---|
| Prompt chaining | Sequential calls with programmatic "gates" between steps | https://www.anthropic.com/engineering/building-effective-agents |
| Router | Classify input, send to a specialised follow-up (e.g. cheap model for simple questions) | https://www.anthropic.com/engineering/building-effective-agents ; https://docs.langchain.com/oss/python/langchain/multi-agent |
| Parallelisation | Sectioning or voting | https://www.anthropic.com/engineering/building-effective-agents |
| Orchestrator–workers (supervisor/worker) | Central LLM decomposes task dynamically, delegates, synthesises | https://www.anthropic.com/engineering/building-effective-agents ; https://www.anthropic.com/engineering/multi-agent-research-system |
| Evaluator–optimizer | One model generates, another critiques in a loop | https://www.anthropic.com/engineering/building-effective-agents |
| Handoffs | Triage agent transfers the conversation to a specialist that then owns the turn; handoff is exposed as a tool (`transfer_to_refund_agent`) | https://openai.github.io/openai-agents-python/handoffs/ ; https://openai.github.io/openai-agents-python/multi_agent/ |
| Agents-as-tools | Manager keeps control and owns the final answer; enforces shared guardrails in one place | https://openai.github.io/openai-agents-python/multi_agent/ |
| Skills | One agent loads specialised prompts on demand | https://docs.langchain.com/oss/python/langchain/multi-agent |
| Planner–executor with ledgers | Magentic-One Orchestrator keeps a Task Ledger (facts, guesses, plan) and a Progress Ledger; re-plans when progress stalls (stall count > 2) | https://www.microsoft.com/en-us/research/articles/magentic-one-a-generalist-multi-agent-system-for-solving-complex-tasks/ |
| Custom/event-driven workflow | Deterministic graph with agentic nodes (LangGraph) | https://docs.langchain.com/oss/python/langchain/multi-agent |

### 1.3 Production customer-service vendors
- **Sierra**: Agent SDK built because function calling and ReAct "don't perform sufficiently" for production workflows; agents are stacks of composable declarative skills; SDK enforces deterministic API interactions and can bypass the LLM for exact regulated wording; higher determinism for actions like cancelling an account. https://sierra.ai/blog/meet-the-ai-agent-engineer
- Sierra **supervisors**: a second model checks and can revise the first; illustrative (not measured) maths: 90% agent + 90% verifier "can skyrocket to 99%". https://sierra.ai/blog/meet-the-ai-agent-engineer
- **Decagon AOPs**: natural-language procedures that "compile into validated workflows", letting agents take actions such as refunds and identity checks — i.e. NL authoring over a deterministic executor. https://decagon.ai/blog/from-sops-to-agent-operating-procedures
- **Intercom Fin**: pipeline of query refinement → retrieval (fin-cx-retrieval) → rerank → generation → accuracy validation (vendor page). https://fin.ai/learn/what-is-fin-ai-agent . Escalates when out of scope or below confidence threshold (third-party index). https://theaiagentindex.com/agents/intercom-fin . Grew from a single LLM call into an agentic system (Honeycomb case study). https://honeycomb.io/resources/case-studies/how-honeycomb-helped-intercom-observe-and-operate-fin-ai
- Pattern across vendors: an LLM for language understanding, **deterministic code for actions and ordering**, and a verifier/supervisor layer.

### 1.4 When one brain wins, when it is overkill
- Multi-agent cost: agents use ~4x chat tokens, multi-agent ~15x; only worth it for high-value tasks. https://www.anthropic.com/engineering/multi-agent-research-system
- Poor fit: tasks needing shared context, many inter-agent dependencies, few parallelisable parts, and **real-time coordination/delegation**, which LLM agents "don't yet handle well". https://www.anthropic.com/engineering/multi-agent-research-system — a live phone call is exactly real-time.
- Early research agents spawned too many subagents for simple queries; explicit effort-scaling rules were needed. https://www.anthropic.com/engineering/multi-agent-research-system
- LangChain cost comparison (illustrative): handoffs 3 calls vs subagents 4 calls for a one-shot request; subagents add a call per request for central control. https://docs.langchain.com/oss/python/langchain/multi-agent
- **Conclusion for SMB**: the "brain" should be a **deterministic router + policy gate in code**, not an LLM supervisor that re-thinks every turn. A single brain beats independent agents for: one customer identity across channels, one approval/permission choke point, one budget meter, one audit trail. An LLM orchestrator is overkill for single-intent turns (most SMB traffic: "book me", "what are your hours").

---

## 2. Routing

- Routing = classify then dispatch; well suited to sending easy inputs to cheaper models. https://www.anthropic.com/engineering/building-effective-agents
- Deterministic routing beats LLM routing when predictability matters. https://openai.github.io/openai-agents-python/multi_agent/
- Sierra bypasses the LLM where exact behaviour is required. https://sierra.ai/blog/meet-the-ai-agent-engineer
- **Structured outputs**: Claude's `output_config.format` (JSON schema) and `strict: true` tools guarantee schema-valid output; caveats: refusals and `max_tokens` can still break schema, enum casing may change (compare case-insensitively), no numeric/length constraints, max 20 strict tools/request, first-use grammar compile latency (cached 24 h). https://platform.claude.com/docs/en/build-with-claude/structured-outputs
- OWASP: validate output formats with deterministic code. https://genai.owasp.org/llmrisk/llm01-prompt-injection/
- Handoff arguments can be typed (`input_type`: reason, priority) and validated; authorisation must be re-checked in `on_handoff` because `is_enabled` is evaluated before arguments exist. https://openai.github.io/openai-agents-python/handoffs/
- Confidence/fallback: Fin escalates below a confidence threshold (third-party). https://theaiagentindex.com/agents/intercom-fin . OpenAI guide: escalate after exceeding failure thresholds such as repeated failure to understand intent (via summary). https://www.maginative.com/article/how-to-build-ai-agents-a-detailed-practical-guide-from-openai/
- Note: LLM self-reported confidence is not calibrated by any source above; treat it as one signal combined with deterministic checks (schema valid, entity resolved, intent allowed for tenant).

---

## 3. Memory and context

- **Context rot**: recall degrades as the window fills; context is finite with diminishing returns. https://www.anthropic.com/engineering/effective-context-engineering-for-ai-agents
- **Compaction**: summarise near the limit and continue with a high-fidelity distillation; **tool-result clearing** is "one of the safest lightest touch forms of compaction". https://www.anthropic.com/engineering/effective-context-engineering-for-ai-agents
- **Structured notes** stored outside the window; **just-in-time retrieval** via lightweight references. https://www.anthropic.com/engineering/effective-context-engineering-for-ai-agents
- Subagents work in clean windows and return condensed summaries; outputs can go to external storage with references passed back. https://www.anthropic.com/engineering/effective-context-engineering-for-ai-agents ; https://www.anthropic.com/engineering/multi-agent-research-system
- Subagents are stateless; the main agent keeps conversation context; each subagent sees only what its task needs. https://docs.langchain.com/oss/python/langchain/multi-agent
- Handoff `input_filter` controls how much history the receiving agent sees (default: full history); the nested-history summariser "does not redact sensitive data". https://openai.github.io/openai-agents-python/handoffs/
- Minimal, non-overlapping tool sets; tool outputs paginated/truncated (Claude Code caps tool responses at 25,000 tokens). https://www.anthropic.com/engineering/effective-context-engineering-for-ai-agents ; https://www.anthropic.com/engineering/writing-tools-for-agents
- Magentic-One's Task Ledger is a concrete shared-memory structure (facts, guesses, plan). https://www.microsoft.com/en-us/research/articles/magentic-one-a-generalist-multi-agent-system-for-solving-complex-tasks/

**Shared vs private (synthesis)**: shared = tenant business settings (versioned), customer profile (minimal fields), rolling conversation summary, open tasks/approvals. Private per agent = its system prompt, tool set, scratch/tool results (cleared after use). Agents receive references (customer_id, booking_id) and fetch just-in-time.

---

## 4. Safety

### 4.1 Human-in-the-loop and risk tiers
- Prompt injection has no fool-proof prevention; mitigate impact via least privilege, privileged functions in application code, human approval for high-risk actions, segregation/labelling of untrusted content, output validation, adversarial testing. https://genai.owasp.org/llmrisk/llm01-prompt-injection/
- **Excessive agency** = excessive functionality, permissions, or autonomy. Mitigations: minimise tools and their operations, avoid open-ended tools, least-privilege credentials, execute in the user's context, require approval for high-impact actions, **complete mediation** (authorise in downstream systems, not in the LLM); logging and rate limiting limit damage. https://genai.owasp.org/llmrisk/llm062025-excessive-agency/
- OpenAI SDK HITL: `needs_approval` (static or per-call callable that **fails closed** when arguments can't be inspected); run pauses with interruptions; state serialised to DB and resumed after approve/reject; serialised state is unauthenticated, so store server-side, authorise reviewers, prevent replay. https://openai.github.io/openai-agents-python/human_in_the_loop/
- OpenAI guide (via summary): tool risk ratings low/medium/high; high-risk/irreversible actions such as cancelling orders, large refunds, payments need human oversight until reliability is proven. https://www.maginative.com/article/how-to-build-ai-agents-a-detailed-practical-guide-from-openai/
- Magentic-One observed agents repeatedly failing logins (account suspended) and trying to email/post to recruit humans; future direction: pause before hard-to-reverse actions like sending emails. https://www.microsoft.com/en-us/research/articles/magentic-one-a-generalist-multi-agent-system-for-solving-complex-tasks/
- Anthropic: agents need stopping conditions (max iterations) and can pause for human feedback at checkpoints. https://www.anthropic.com/engineering/building-effective-agents
- Guardrails: input guardrails cover only the first agent and output guardrails only the last in a handoff chain; use **tool guardrails** around each tool call in multi-agent flows; blocking mode (`run_in_parallel=False`) prevents spend before a tripwire. https://openai.github.io/openai-agents-python/guardrails/

### 4.2 Prompt injection specifics
- "Prompt injection is far from a solved problem"; Anthropic's layered defences (RL training, classifiers on untrusted content, red teaming) reduced browser-agent attack success to 1.4% (Opus 4.5) and 2.4% (Haiku 4.5) under an adaptive attacker — non-zero. https://www.anthropic.com/research/prompt-injection-defenses
- Implication: any agent that reads inbound email/SMS/web forms/call transcripts treats them as untrusted data; the tool layer, not the model, decides what is permitted.

### 4.3 Regulation
- **EU AI Act Art. 50(1)**: providers of systems interacting directly with people must ensure they are "informed that they are interacting with an AI system" unless obvious; information at the latest at first interaction, clear and accessible (50(5)). Art. 50(2): machine-readable marking of synthetic audio/text. https://ai-act-service-desk.ec.europa.eu/en/ai-act/article-50
- Article 50 applies from 2 Aug 2026 regardless of risk class; the Digital Omnibus (Reg. (EU) 2026/1744, in force 27 Jul 2026) left it unchanged, gave pre-existing generative systems until 2 Dec 2026 for marking, and delayed high-risk rules to 2 Dec 2027 / 2 Aug 2028. Fines up to €15m or 3% turnover. https://www.goodwinlaw.com/en/insights/publications/2026/08/alerts-technology-dpc-eu-ai-act-transparency-obligations-now-in-force
- A receptionist/booking agent is not Annex III high-risk on its face; the binding duty is disclosure (synthesis — confirm with counsel for specific verticals such as healthcare).
- **NIST AI RMF**: voluntary (released 26 Jan 2023); Generative AI Profile NIST AI 600-1 (26 Jul 2024); RMF 1.0 is being revised under the White House AI Action Plan. https://www.nist.gov/itl/ai-risk-management-framework . (Four functions Govern/Map/Measure/Manage are from the RMF 1.0 document, not restated on that page.)

### 4.4 Cost controls / kill switch
- OWASP LLM10 Unbounded Consumption / "Denial of Wallet": rate limits and quotas per source, timeouts and throttling, input size validation, limits on queued actions, monitoring, graceful degradation. https://genai.owasp.org/llmrisk/llm102025-unbounded-consumption/
- Groq returns `429` with `retry-after`; `x-ratelimit-*` headers on every response; example base limits ~30 RPM / 1K RPD / 8K TPM / 200K TPD on small open models (check account page; free-tier figures not shown). https://console.groq.com/docs/rate-limits

---

## 5. Observability and quality

- Tracing: one trace per workflow, spans for agent runs, LLM generations, tool calls, guardrails, handoffs; `group_id` links traces in one conversation; a flag to exclude sensitive inputs/outputs (default includes them); audio spans include base64 audio by default. https://openai.github.io/openai-agents-python/tracing/
- Anthropic traced decision patterns and interaction structures **without reading conversation contents** to protect privacy. https://www.anthropic.com/engineering/multi-agent-research-system
- Evals: combine code graders (cheap, brittle), model graders (flexible, need calibration), human graders (gold standard, calibrate judges); start with 20–50 tasks from real failures; read transcripts before trusting grades; **pass^k** matters for customer-facing consistency (75% per-trial → ~42% pass^3); let judges answer "Unknown"; one judge per dimension. https://www.anthropic.com/engineering/demystifying-evals-for-ai-agents
- LLM-as-judge with single 0.0–1.0 rubric + pass/fail matched human judgment best; humans caught edge cases automation missed; end-state evaluation for stateful tasks (did the booking exist correctly?). https://www.anthropic.com/engineering/multi-agent-research-system
- Production monitoring is reactive; pair with automated evals and user feedback. https://www.anthropic.com/engineering/demystifying-evals-for-ai-agents
- Agent Ops (DevOps+MLOps with automated and HITL evaluation) — Google "Agents Companion" (via summary only). https://ibl.ai/blog/google-agents-companion
- **Resolution metric pitfalls**: Intercom counts confirmed resolutions (affirmative reply) and assumed resolutions (customer leaves without asking for more help). https://intercom.help/fin4all/en/articles/10772642-fin-ai-agent-resolutions . Customers complain silent exits are counted as resolved even when a human then answers. https://community.intercom.com/fin-product-feedback-member-group-49/fin-s-flawed-resolution-assumption-10516 → report confirmed and assumed separately.
- Fin's reported average resolution ~56% within 30 days (AWS case study). https://aws.amazon.com/solutions/case-studies/intercom-anthropic/ ; resolution improved ~1 point/month post-launch via iteration (Honeycomb). https://honeycomb.io/resources/case-studies/how-honeycomb-helped-intercom-observe-and-operate-fin-ai
- Feedback loop: turn production failures and customer corrections into eval tasks (Anthropic's "start from real failures"). https://www.anthropic.com/engineering/demystifying-evals-for-ai-agents

---

## 6. Failure handling

- Errors compound; resume from last state rather than restart; tell the agent when a tool is failing; deterministic retries and checkpoints; rainbow deployments so in-flight runs aren't broken by updates. https://www.anthropic.com/engineering/multi-agent-research-system
- Stalled progress → re-plan (Magentic-One). https://www.microsoft.com/en-us/research/articles/magentic-one-a-generalist-multi-agent-system-for-solving-complex-tasks/
- Tool errors should be actionable, not opaque codes. https://www.anthropic.com/engineering/writing-tools-for-agents
- Escalate after failure thresholds (OpenAI guide via summary). https://www.maginative.com/article/how-to-build-ai-agents-a-detailed-practical-guide-from-openai/
- Rate-limit fallbacks: honour `retry-after`; fall through to next provider. https://console.groq.com/docs/rate-limits
- Structured output failure modes to handle: `stop_reason: refusal` and `max_tokens`. https://platform.claude.com/docs/en/build-with-claude/structured-outputs
- Graceful degradation under load. https://genai.owasp.org/llmrisk/llm102025-unbounded-consumption/

---

## 7. Multi-tenant SaaS concerns

- Supabase: enable RLS on every table in exposed schemas; grants and policies are separate checks (revoke default grants); one policy per operation; authorise on `app_metadata` never `user_metadata`; views need `security_invoker = true`; `service_role` bypasses RLS — keep server-side; index policy columns; wrap `auth.uid()` in `select`; security-definer helpers with `search_path = ''` outside exposed schemas; pgTAP allow/deny tests. https://supabase.com/docs/guides/database/postgres/row-level-security
- OWASP "complete mediation" — the tenant/permission check lives in the backend (`can()` + RLS), never in the prompt. https://genai.owasp.org/llmrisk/llm062025-excessive-agency/
- Per-tenant config: Sierra notes configurability for region/plan-specific rules and integration with version control/CI. https://sierra.ai/blog/meet-the-ai-agent-engineer ; https://sierra.ai/blog/serving-customer-experience-and-engineering-teams-all-from-one-platform
- Per-tenant quotas / dynamic per-user resource allocation. https://genai.owasp.org/llmrisk/llm102025-unbounded-consumption/
- Handoff/trace state can carry PII; filter before passing and before tracing. https://openai.github.io/openai-agents-python/handoffs/ ; https://openai.github.io/openai-agents-python/tracing/

---

## Recommended design for Wyrm AI

Constraints: tiny team, free tiers; Next.js 16 on Vercel; Supabase Postgres + RLS; server-side `can()`; tenants, roles, per-agent access; audit log. LLM chain: code-first → Claude Haiku 5.5 (`claude-haiku-5-5`, ~$0.10/$0.50 per 1M in/out — figure supplied by Wyrm, not independently verified here) → Groq free models → basic fallback.

Design stance: the "main brain" is **a deterministic TypeScript module (router + policy gate + budget meter + logger)**, with an LLM used only as a classifier/extractor and for wording. This follows "start simple" (https://www.anthropic.com/engineering/building-effective-agents), code orchestration for predictability (https://openai.github.io/openai-agents-python/multi_agent/), and the multi-agent-is-poor-at-real-time finding (https://www.anthropic.com/engineering/multi-agent-research-system). Specialist "agents" (receptionist, booking, follow-up, quotes/invoices, FAQ) are **handlers with their own prompt + minimal tool set**, not autonomous peers.

### A. Decision types the brain makes
1. **route** — which agent handles this inbound event (or none).
2. **answer_mode** — code template / LLM / human.
3. **model_select** — which tier of the LLM chain (or skip LLM).
4. **tool_authorize** — `can(tenant, actor, agent, action, resource)` + risk tier → allow / needs_confirmation / needs_approval / deny.
5. **escalate** — hand to a person (live transfer, callback task, or inbox).
6. **budget_gate** — proceed, degrade to cheaper tier, or stop.
7. **compact** — when to summarise conversation into the shared summary.
8. **schedule** — enqueue follow-up work (reminders, quote chasers) as events, not loops.

### B. Routing algorithm (per inbound event)
1. Normalise event (channel, tenant_id, customer ref, text/transcript). Reject if tenant suspended or agent kill-switched.
2. **Deterministic rules first**: active flow continuation (e.g. mid-booking awaiting date) → same agent; keyword/regex + tenant FAQ exact/near-match → FAQ code answer; explicit "human/agent/person" → escalate; opt-out words (STOP) → follow-up suppression.
3. If unresolved: **LLM classify** with strict JSON schema `{intent (enum, tenant-enabled only), entities, needs_human (bool), confidence (0–1), reason (short)}` via Haiku; on 429/timeout → Groq same schema; on failure → basic fallback ("I'll pass you to a person / take a message").
4. Validate in code: schema valid, intent ∈ tenant's enabled agents, actor has access, required entities present. Compare enums case-insensitively (https://platform.claude.com/docs/en/build-with-claude/structured-outputs).
5. Thresholds (start values, tune on evals): confidence ≥ 0.75 → route; 0.5–0.75 → ask one clarifying question (max 1 per turn, max 2 per conversation); < 0.5 or 2 failed clarifications → escalate. Confidence is one signal; deterministic validation can override it.
6. Dispatch to handler; handler's tool calls go through `tool_authorize`.

### C. Risk tiers and approvals
| Tier | Examples | Gate |
|---|---|---|
| T0 read/inform | FAQ answer, hours, price list lookup, availability check | Auto; logged |
| T1 reversible, single customer | Create booking/hold, reschedule own booking, send booking confirmation/reminder to that customer, create draft quote | Auto **after explicit customer confirmation** of the summarised action (keep existing explicit-booking-confirmation rule) |
| T2 business-impacting | Cancel booking, send quote/invoice to customer, apply discount, change customer record, message a customer who has not contacted in 30+ days | **Owner/staff approval** in dashboard (or tenant opt-in auto with per-day cap) |
| T3 money / mass / irreversible | Refunds, payments/charges, invoice voiding, bulk/mass messages (>10 recipients), deleting data, changing business settings | **Always human approval** by role with `can()`; never auto; agents cannot do settings changes at all |
| Blocked | Arbitrary URL fetch, free-form SQL, sending to addresses not on record, acting on instructions found in inbound content | Not exposed as tools |

Approval objects stored server-side, authorised reviewer, single-use (anti-replay), expiring (https://openai.github.io/openai-agents-python/human_in_the_loop/). Inbound email/SMS/transcripts are untrusted data and can never raise a tier or authorise an action (https://genai.owasp.org/llmrisk/llm01-prompt-injection/). AI disclosure at first interaction on every channel incl. voice greeting (https://ai-act-service-desk.ec.europa.eu/en/ai-act/article-50).

### D. Fields every agent run / decision must log
| Field | Type | Notes |
|---|---|---|
| id | uuid | decision/run id |
| trace_id | uuid | one per inbound event |
| conversation_id | uuid | groups traces (like `group_id`) |
| parent_id | uuid null | parent decision (route → tool call) |
| tenant_id | uuid | RLS key |
| config_version | int | tenant settings/prompt version used |
| agent | enum | brain, receptionist, booking, follow_up, quotes, faq |
| decision_type | enum | route, answer_mode, model_select, tool_authorize, escalate, budget_gate, compact, schedule |
| channel | enum | phone, sms, email, web_chat, internal |
| actor_type / actor_id | enum / uuid | customer, staff, system; id is a reference, not PII |
| input_ref | text | pointer to stored message; no raw PII/recording in log |
| intent / confidence | text / numeric | classifier output |
| rule_id | text null | deterministic rule that fired |
| outcome | enum | routed, answered, clarified, escalated, denied, approved, rejected, failed |
| reason | text ≤200 | short machine/LLM reason |
| tool_name / risk_tier | text / T0–T3 | when an action was considered |
| approval_id / approver_id | uuid null | for T2/T3 |
| provider / model | text | code, anthropic/claude-haiku-5-5, groq/…, fallback |
| fallback_depth | int | 0 = first choice |
| tokens_in / tokens_out | int | |
| cost_usd_micros | bigint | computed from price table version |
| latency_ms | int | end to end for this step |
| attempt / error_code | int / text null | retries, 429, timeout, schema_fail, refusal |
| guardrail_flags | text[] | injection_suspected, pii_filtered, budget_degraded |
| created_at | timestamptz | |

Store in a tenant-scoped `agent_decisions` table (RLS, insert-only for server, select for tenant admins); T2/T3 actions also write the existing audit log.

### E. Metrics to show customers (per agent, per period)
- Conversations / calls handled (volume).
- **Confirmed resolution rate** and **assumed resolution rate**, shown separately (https://intercom.help/fin4all/en/articles/10772642-fin-ai-agent-resolutions).
- Handoff/escalation rate and top escalation reasons.
- Bookings created / rescheduled / cancelled via AI; quotes sent and accepted.
- Approvals pending, approved, rejected, median approval wait.
- Median and p95 response latency (voice: time to first word).
- Error/fallback rate (share of turns served by fallback tiers).
- Cost this month vs plan budget.
- Sampled quality score (judge + human-reviewed sample) and customer corrections count.

### F. Budget and kill-switch rules
- Per-tenant monthly LLM budget (plan-based) + daily cap = monthly/20. At 80% daily → degrade: code-first answers and Groq only. At 100% → no LLM; deterministic flows + "take a message / pass to a person". Never silently drop a booking flow mid-confirmation; finish it deterministically or escalate.
- Global platform cap (protects Wyrm's own free-tier wallet) with the same degrade ladder.
- Rate limits per tenant, per customer identifier (phone/email hash) and per IP; input length cap; max LLM calls per turn (3) and per conversation (e.g. 30); max tool calls per turn (5) (https://genai.owasp.org/llmrisk/llm102025-unbounded-consumption/).
- Kill switches (DB flags, checked on every event, cached ≤30 s): global, per tenant, per agent, per tool, per provider. Owners can pause any agent from the dashboard; Wyrm staff can pause any tenant.
- Auto-trip: an agent auto-pauses outbound sending if error rate > 20% over 50 events, or if outbound messages exceed 3× its 7-day hourly average.
- Retries: 1 retry with jitter for 5xx/timeout; honour `retry-after` on 429 then fall through (https://console.groq.com/docs/rate-limits); per-step timeouts (voice ~3 s LLM budget, text ~10 s).

### G. Quality loop
- Weekly: LLM-judge on a 5–10% sample (cheapest tier), one judge per dimension, "Unknown" allowed; human review of all escalations + judge failures; every confirmed failure or customer correction becomes a fictional-fixture regression case (https://www.anthropic.com/engineering/demystifying-evals-for-ai-agents). Track pass^3 on booking flows.

### H. What NOT to build yet
- An LLM supervisor that plans across agents every turn (cost ~15x, poor at real-time; https://www.anthropic.com/engineering/multi-agent-research-system).
- Agent-to-agent free-form chat or autonomous peer delegation.
- Long-term vector memory / per-customer embeddings — use structured profile + summary.
- Auto-approval of refunds, payments or mass messages.
- A framework migration (LangGraph/AutoGen) — plain TypeScript is enough now.
- Self-modifying prompts from feedback; feedback goes into evals, humans change prompts.
- Paid observability stacks; use the `agent_decisions` table + simple dashboard.
- Third-party data enrichment or cross-tenant learning.
