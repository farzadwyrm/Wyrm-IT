# Discovery Interview and Questionnaire Frameworks for Workflow Automation (SMB, 5-10 minute online interview)

Research date: 2026-10-20. Search budget was limited to about 20 tool calls. Many practitioner sources are vendor pages, and they are labelled as such. Items not verified against a primary source are in the Gaps sections.

## 1. Discovery question lists from RPA/automation vendors and consultancies (triggers, volumes, AHT, systems, inputs, rules, exceptions, SLAs, pain, outcome)

### Takeaway
No single canonical question bank exists. Vendor tools converge on two layers. The first is a short screening layer of about five to nine Likert/multiple-choice questions on rule-basedness, how digital the input is, how structured the input is, process stability and documentation, which produces a suitability/readiness score. The second is a detailed layer covering volumes, handling time, FTE, applications, exceptions and cost per run. Consultancy workshops follow the same order: understand purpose, inputs, outputs and steps first, then quantify volumes, cycle times and FTE.

### Cited Findings
- UiPath Automation Hub uses a two-level assessment. Idea submitters answer a short high-level set of questions and get an instant "automation score" with an explanation. If the score shows potential, the process owner fills in a separate detailed questionnaire that includes the list of applications used — [Auxis on UiPath Automation Hub](https://auxis.com/?p=20905)
- In the current UiPath Automation Hub employee-driven form, the Overview asks for an idea name (max 100 chars), an automation ID and a process description, with a duplicate check on title and category. The High Level Assessment has five questions, each with six answer options, and a document upload on the last question. Process owner assignment is optional — [UiPath docs, Employee-driven (2.2510)](https://docs.uipath.com/automation-hub/automation-suite/2.2510/user-guide/employee-driven)
- The five Automation Hub factors are each ranked on a 1-5 scale: (1) degree to which the process has rules; (2) the input's degree of digitization; (3) degree to which the input data is structured; (4) upcoming process changes; (5) existence of documentation. Suitability is the average of factors 1-3. Readiness is the average of factors 4-5. The Idea Score is 0-100%, described as either a simple average of the five factors or a weighted average of Suitability and Readiness. The docs are inconsistent on which applies — [UiPath, Information about the Idea Score](https://docs.uipath.com/automation-hub/automation-cloud/latest/user-guide/information-about-the-idea-score)
- The Automation Hub API keys for the high-level assessment are `rules` (very creative to very rule-based), `input_type` (paper-based to digital), `input_quality` (unstructured to structured), `stability` (expected changes in the next 6 months) and `documentation` (none to detailed work instructions) — [UiPath API guide, input for high level assessment](https://docs.uipath.com/automation-hub/automation-suite/2024.10/api-guide/input-for-high-level-assessment) (seen in search snippet only)
- An older Automation Hub version described nine high-level questions instead of five, so the count has changed over versions — [UiPath Process Mining docs, sending ideas to Automation Hub](https://docs.uipath.com/process-mining/docs/sending-automation-ideas-to-uipath-automation-hub); [Auxis](https://auxis.com/?p=20905)
- ServiceNow's Automation Center request form captures the applications the process uses, the person responsible, actual time spent per run, cost per run, the desired goal of automating, and the intake source (web, integration, process mining) — [ServiceNow docs, Automation request form](https://www.servicenow.com/docs/r/oZRGKGLbfcn968v3Ubchmw/OKLWvO7XAa1c47KFaWdetg) (via search summary)
- An RPA questionnaire generator covers triggers, steps, systems, volumes, exceptions, inputs, outputs and ownership, and asks for frequency, volume, handling time and peak periods. It recommends asking about the normal path and the exceptions separately, because repetitive work can still involve frequent judgment calls or follow-ups for missing data — [Makeform RPA questionnaire generator](https://www.makeform.ai/tools/ai-rpa-questionnaire-generator) (vendor)
- Auxis lists suitability traits as a stable process with few exceptions, clearly defined business rules, and structured digital data. Its worksheet tracks monthly volumes, % exceptions and cycle time. In a client engagement it quantified transaction volumes, cycle times, assigned FTEs and cost to serve for each candidate before ranking — [Auxis webinar slides](https://www.slideshare.net/slideshow/auxis-webinar-diving-into-rpa/81983508); [Auxis case study](https://www.auxis.com/case-study/rpa-process-design-for-technology-company/)
- Workshop sequence: per-activity walk-through workshops that judge automation potential, followed by compiling volumetric data, cycle times and FTE analysis. Another deck describes a stakeholder discovery meeting followed by a 1-2 day process workshop to map the as-is state — [Auxis webinar](https://www.slideshare.net/slideshow/auxis-webinar-diving-into-rpa/81983508); [SlideShare RPA deck](https://www.slideshare.net/slideshow/what-is-robotics-process-automation/66918098)
- A Microsoft document says discovery sessions aim to understand the process's purpose, inputs, outputs and steps, and to find the manual, repetitive, rule-based parts — [Microsoft (binary CMS doc)](https://query.prod.cms.rt.microsoft.com/cms/api/am/binary/RW1c7Kz) (via search summary)
- Microsoft's Power Platform guidance puts a "Discover & Plan" stage first, where CoE and business choose processes by ROI and manage a backlog in the Innovation Backlog app — [Microsoft Power Platform blog](https://www.microsoft.com/en-us/power-platform/blog/?p=4701)

### Inferences
- Synthesized consultant question order for one workflow (my synthesis of the sources above and section 3; no single source prescribes it):
  1. Name and outcome: "What is this task called, and what does it produce when it is done?" (purpose/output)
  2. Trigger: "What kicks it off — an email, a form, a phone call, a date, a customer request?"
  3. Walk through the last occurrence (happy path): "Think of the last time you did it. What did you do first? Then?" Capture steps, apps/systems, and who else was involved.
  4. Inputs: where the information comes from and in what form (typed in a system, email text, PDF, paper/photo, phone call). This maps to digitization and structure.
  5. Decisions/rules: "At any point do you have to decide something? How do you decide?" This maps to rule-based vs judgment.
  6. Exceptions: "When does it NOT go the normal way? How often out of 10?" Also cover rework and errors.
  7. Volume and frequency: how many per week, peaks/seasonality.
  8. Time: minutes per item (plus waiting time), who does it, and the cost of their time.
  9. Constraints: deadlines/SLAs, sensitive data (customer/financial/health), compliance, approvals.
  10. Stability: "Is this likely to change in the next 6 months?" and whether it is documented anywhere.
  11. Pain and desired outcome: "What is most annoying or risky about it? If it were magically handled, what would be different?"
- For SMBs, steps 1-3 and 6-8 matter most. UiPath's five factors (rules, digital input, structured input, stability, documentation) can be inferred from the walkthrough answers instead of being asked as abstract Likert items.
- A two-tier design (a short screen with an instant score, then a deeper follow-up only for promising workflows) is the established vendor pattern and fits a 5-10 minute budget.

### Gaps
- I could not retrieve the exact wording of the UiPath high-level questions and their six answer options, or the Automation Hub Detailed Assessment field list (volumes, AHT, FTE, exception rates). The docs pages point elsewhere.
- I found no peer-reviewed or consultancy-published canonical question bank (e.g., from Deloitte, EY or Accenture). The sources are vendor tools and slide decks.
- SLA and compliance/data-sensitivity questions appear only implicitly (in PDD exception and To-Be sections). I found no source with exact question wording for them.

## 2. Process Definition Document (PDD) templates (UiPath, Blue Prism) and their fields

### Takeaway
The UiPath PDD is structured as: Introduction (purpose, objectives, key contacts, prerequisites), Process Overview, Applications, As-Is map, Statistics, Detailed As-Is steps (each with time, action and screenshot), To-Be (in/out of scope, business exceptions, application exceptions, reporting), and Other Observations. Blue Prism's PDD captures the process flow, a high-level flowchart, target systems and assumptions, with sections, steps and exceptions. A PDD is the natural target schema for structured output.

### Cited Findings
- UiPath's default PDD (Task Capture) sections:
  1. Introduction: Purpose, Objectives, Process Key Contacts (roles), Minimum Pre-requisites for Automation
  2. Process Overview table (partly auto-filled)
  3. Applications Used in the Process
  4. As-Is Process Map
  5. Process Statistics (high-level and detailed)
  6. Detailed As-Is Process Steps (per step: title, description, estimated time, action type, screenshot)
  7. To-Be Process Description: To-Be Detailed Map, Parallel Initiatives, In Scope of RPA, Out of Scope of RPA, Business Exception Handling, Application Error and Exception Handling table, Reporting (optional), Other Observations
  8. Additional Sources of Process Documentation

  — [UiPath docs, Details about the PDD](https://docs.uipath.com/task-capture/docs/details-about-the-pdd)
- Task Capture ships two default templates ("Automation Hub PDD" and "UiPath PDD"). Custom Word templates use placeholders such as {TITLE}, {DESCRIPTION}, {AUTHOR}, {PROCESS_DATE} and {PROCESS_EXECUTION_TIME}, totals (applications, actions, clicks, total time), and loops {#APPLICATIONS}, {#WINDOWS}, {#EXCEPTIONS} with {#EXCEPTION_STEPS} — [UiPath Task Capture 2022.4, export/template docs](https://docs.uipath.com/task-capture/standalone/2022.4/user-guide/creating-your-own-word-template)
- Blue Prism's PDD template captures the flow of a business process to be built in Blue Prism and includes a flowchart of the high-level process, target systems and assumptions. Blue Prism also has a Solution Design Document (SDD) covering security, scheduling, alerting, MI and exception handling. Its ALM guide structures process definitions as Sections, Steps and Exceptions — [Blue Prism portal documents](https://portal.blueprism.com/documents/public?page=5); [Blue Prism Hub ALM v4.1 guide](https://bpdocs.blueprism.com/hub-interact/4-1/en-us/z-pdf/4-1/v4.1%20User%20Guide%20-%20Automation%20Lifecycle%20Management.pdf) (via search summary)
- UiPath's guidance on the default template's Process Overview does not define a separate "volumes" section. Exceptions are split into business exceptions and application errors — [UiPath docs](https://docs.uipath.com/task-capture/docs/details-about-the-pdd)

### Inferences
- A lightweight SMB "mini-PDD" output schema could be: title; purpose/outcome; trigger; owner/roles; applications[]; inputs[] {source, format, structured?}; steps[] {actor, action, app, est_minutes, decision_rule?}; business_exceptions[] {description, frequency, current handling}; system_errors[]; volume {per_period, peaks}; time {per_item, per_week}; sensitive_data; deadlines/SLA; in_scope/out_of_scope; pain_points; desired_outcome; open_questions. This mirrors the PDD sections at much lower detail.
- The PDD's split of business exceptions from application/system errors is worth keeping. Non-experts mostly describe business exceptions ("customer sends the wrong form"). Technical errors usually come out in later design.

### Gaps
- I could not access the full Blue Prism PDD template (portal documents are partly gated or moved). Exact Blue Prism field names are unverified.
- The volumes/AHT/FTE fields that consultants usually add to the PDD "Process Overview" table were not visible in UiPath's public doc text.

## 3. Getting reliable estimates from non-experts (ranges vs exact numbers, anchoring, "last week" recall, per item vs per week)

### Takeaway
The range of the answer options anchors frequency/duration answers: people infer what is "normal" from the scale midpoint, and the effect grows as questions get harder. Shorter reference periods produce higher reported frequencies. People estimate rather than count for frequent, regular behaviours. Best practice is a short, concrete reference period matched to how often the task happens, an open numeric answer or carefully chosen buckets, and decomposition (per item × count) rather than asking directly for a total.

### Cited Findings
- Schwarz et al. (1985): respondents reported daily TV use on either a low-range scale ("up to 30 min" ... "more than 2.5 h") or a high-range scale ("up to 2.5 h" ... "more than 4.5 h"). The low-range group reported less viewing and estimated average viewing as lower. Respondents treated the response alternatives as information about the average — [Schwarz et al., Response scales: effects of category range (ISR)](https://api.isr.umich.edu/?p=190617)
- Respondents assume the average respondent sits in the middle of the scale (1991). The impact of response alternatives grows as question difficulty increases (1992) — [Schwarz et al. 1988, Response scales as frames of reference (SSOAR)](https://www.ssoar.info/ssoar/bitstream/document/6656/1/ssoar-1988-schwarz_et_al-response_scales_as_frames_of.pdf); [Bielefeld record, "Asking difficult questions"](https://pub.uni-bielefeld.de/record/1779097)
- Manipulating the reference period (week, month, quarter, semester) produced a systematic bias for all items: the shorter the period, the higher the reported frequencies — [LMU Munich epub](https://epub.ub.uni-muenchen.de/452/)
- Frequency scales show a pull towards the middle range. The same source recommends open numeric response formats where possible — [LMU Munich epub](https://epub.ub.uni-muenchen.de/452/) (via search summary)
- Respondents often rely on estimation rather than counting, depending on how frequent, important and regular the behaviour is. Questions commonly reference "last week" or "last month" — [Schwarz, Retrospective vs concurrent self-reports (2007)](https://dornsife.usc.edu/norbert-schwarz/wp-content/uploads/sites/231/2023/11/schwarz_retrospective_self-reports_mdc_2007.pdf) (via search summary; PDF text could not be extracted)
- Use a reference period as short as possible, but one that is too short misses less frequent behaviour (e.g., every 10 days). Qualtrics suggests 30 days for grocery trips — [Qualtrics, measuring behavioral frequency](https://www.qualtrics.com/articles/strategy-research/measuring-behavioral-frequency/)
- Range options ("1-5 times") accommodate fuzzy memory. Vague labels such as "often" are subjective — [Sogolytics guide](https://www.sogolytics.com/learning-center/surveys/measuring-behavior-frequency/)
- Optimal recall periods depend on how frequent the behaviour is (payments diary study) — [Boston Fed working paper 12-7](https://www.bostonfed.org/-/media/Documents/Workingpapers/PDF/economic/wp/wp2012/wp1207.pdf) (via search summary)
- Recall of time use for work activities was more accurate than recall of consumption or sick days in a high-frequency field study — [PMC7745111](https://www.ncbi.nlm.nih.gov/pmc/articles/PMC7745111/)

### Inferences
- Ask volume as "How many did you handle last week?" for daily/weekly tasks, and "last month" for rarer ones, with a follow-up asking whether that week was normal, busy or quiet to capture peaks.
- Ask time per item ("the last one took about how many minutes?") and multiply by volume, rather than asking "hours per week". Decomposition reduces the estimation burden. Show the computed weekly total back to the user for confirmation, which also catches implausible answers.
- If buttons are used, choose bucket ranges that do not imply a "normal" midpoint for this population (e.g., include very small and very large options), or use an open number with a "rough guess is fine" note and an "I don't know" option. Avoid vague labels ("often").
- Ask exception frequency as a natural frequency ("out of the last 10, how many needed something unusual?"). This is my suggestion and was not tested in the sources.

### Gaps
- I did not retrieve exact percentages from Schwarz 1985 (the PDF could not be text-extracted). The effect direction is confirmed by the abstract.
- I found no study specifically on SMB owners estimating task time. Evidence on per-item vs per-week decomposition accuracy is inferred from general survey methodology, not directly sourced.

## 4. Interviewing techniques (walk me through the last time, happy path then exceptions, five whys, JTBD)

### Takeaway
Story-based interviewing anchored on a specific past instance ("Tell me about the last time you...") gets more reliable data than generalities. Answers start thin, so the interviewer must "excavate" with chronological prompts ("what happened next?"). JTBD switch interviews add a timeline (first thought → passive looking → active looking → decision) and say motivations should emerge from events rather than be asked directly. Asking about the normal path and exceptions separately is standard RPA practice.

### Cited Findings
- Story-based interviewing asks for specific stories about real past experiences instead of what people typically do. Example: "Tell me about the last time you watched Netflix" rather than "your experience with Netflix" — [Product Talk glossary (Teresa Torres)](https://www.producttalk.org/glossary-discovery-story-based-interviewing/)
- First answers are typically short ("It was last night after dinner"). The interviewer's job is to excavate the full story by helping participants remember details — [Product Talk glossary](https://www.producttalk.org/glossary-discovery-story-based-interviewing/)
- The JTBD switch interview follows a timeline of first thought, passive looking, an event, active looking, and decision. Some guides add consumption as a fifth stage — [CleverX](https://cleverx.com/blog/how-to-run-jobs-to-be-done-interviews); [Usercall](https://usercall.co/post/jtbd-interview)
- The first thought often comes weeks or months before the purchase, triggered by a specific event. Forces (push, pull, anxiety, habit) should emerge from events, not from direct questions — [jobstobedone.org switch interview](https://jobstobedone.org/switch-interview/)
- Example prompts: "When did you first start thinking about this?" and asking for the specific point where the person moved from thinking to acting — [Koji JTBD guide](https://www.koji.so/docs/jobs-to-be-done-interviews)
- Keep the conversation anchored on one concrete decision. Chronology stops people jumping to the outcome and inventing a tidy rationale — [Usercall](https://usercall.co/post/jtbd-interview)
- Ask about the normal path and exceptions separately — [Makeform](https://www.makeform.ai/tools/ai-rpa-questionnaire-generator)
- Interview probe types (descriptive, idiographic, clarifying, explanatory) were compared in a chatbot survey study (64 participants, CHI '25). Probes improved data quality over plain open-ended questions, and different probes worked best at different research stages — [arXiv 2503.08582](https://arxiv.org/abs/2503.08582)

### Inferences
- Recommended flow for an LLM interviewer: (a) a "last time" anchor; (b) chronological excavation ("what happened next?", "where did that information come from?", "what app were you in?"); (c) after the happy path, a separate exceptions pass ("what can go wrong / differ?"); (d) a light "why" probe on pain ("why is that a problem?"), limited to one or two levels in a short interview. A full five-whys is too long for 5-10 minutes.
- Use JTBD mainly for the outcome/pain step ("what made you want to look at this now?"), which surfaces the trigger for buying and the success criterion.

### Gaps
- No primary source on "five whys" was retrieved in this budget. Its use here is standard practice but not cited.
- I found no academic study comparing "last time" walkthroughs with generic descriptions specifically for process elicitation in RPA/BPM. The evidence comes from product discovery and survey methodology.

## 5. Self-serve intake tools: length, question types, drop-off and completion best practice

### Takeaway
Drop-off rises fastest over the first approximately 15 questions, and completion falls 5-20% once surveys exceed about 7-8 minutes. That supports a hard cap of about 8-12 interactions for a 5-10 minute flow. Vendor screens use a few multiple-choice/Likert items with an instant score, which shows value early. Multi-step, one-question-at-a-time, conditional formats are widely reported to complete better, but the strongest numbers come from vendors.

### Cited Findings
- SurveyMonkey (~100k surveys, 1-50 questions): drop-off rises most sharply with each added question up to 15 questions, and less per question after that — [SurveyMonkey, survey questions and completion rates](https://www.surveymonkey.com/curiosity/survey_questions_and_completion_rates/)
- Completion rates drop 5-20% for surveys taking more than 7-8 minutes. Respondents spend nearly half as much time per question on surveys over 30 questions. People tolerate longer surveys more when they are work or school related than when they are customer related — [SurveyMonkey, survey completion times](https://surveymonkey.com/curiosity/survey_completion_times)
- UiPath's idea form gives an instant calculated score with an explanation after a few questions, and only promising ideas move on to a detailed questionnaire — [Auxis](https://auxis.com/?p=20905); [UiPath Idea Score](https://docs.uipath.com/automation-hub/automation-cloud/latest/user-guide/information-about-the-idea-score)
- Typeform claims completion above 50% for conversational forms against roughly 20-30% for traditional forms. These are vendor numbers. Formstack reportedly found multi-step forms had 25.4% higher completion than single-page forms across 650k+ submissions (not verified at source) — [tinycommand blog](https://tinycommand.com/blogs/conversational-forms-vs-traditional-forms-which-is-better-for-your-business)
- Sequential formats can frustrate users who want to review all their answers before submitting — [automationatlas Typeform review](https://automationatlas.io/answers/typeform-review-2026/) (via search summary)
- Conditional display of fields reduces real and perceived complexity. Vendor guidance suggests about 3-5 fields per step — [Orbit Forms, progressive disclosure in forms](https://orbitforms.ai/blog/progressive-disclosure-in-forms) (vendor, unsourced)
- Hidden or progressively disclosed fields must be properly hidden from, and revealed to, screen readers — [Box UK form best practice](https://www.boxuk.com/wp-content/uploads/2019/08/Five_Examples_of_Web_Form_Best_Practice.pdf)
- Microsoft Forms supports branching so relevant questions show based on earlier answers. Intake forms are commonly wired to a list/backlog via Power Automate — [Microsoft Learn Q&A](https://learn.microsoft.com/en-us/answers/a/11434487); [MSU GoWithTheFlow poster](https://hcrs.msu.edu/images/documents/Poster/GoWiththeFlow_V2.pdf)

### Inferences
- UX pattern for a 5-10 minute SMB interview:
  - Open with one free-text "describe the task in a sentence or two" and let the LLM pre-fill.
  - Use tappable multiple-choice options with "Other / not sure" for categorical fields (trigger type, input format, apps).
  - Use numeric inputs with a "rough guess is fine" note for volume and time.
  - Show a progress indicator and a running summary card, which shows value early.
  - End with an instant result (e.g., hours/week at stake and an automation-fit rating with reasons) before asking for contact details.
  - Offer an optional "go deeper" second stage instead of front-loading everything.
- Because SMB owners are describing their own business, the "work-related" tolerance in the SurveyMonkey data may apply partly. Still, target about 6-7 minutes median.

### Gaps
- I found no Nielsen Norman Group article in the search results. NN/g form/progressive-disclosure guidance should be verified directly.
- I found no independent A/B evidence for conversational vs traditional form completion. Completion and drop-off data for AI-readiness/automation calculators and for Zapier/Make template intake were not found.
- The SurveyMonkey data is about a decade old.

## 6. LLM-driven conversational interviews: adaptive follow-ups and structured output (extraction, slot filling)

### Takeaway
Evidence shows chatbot/LLM interviewers raise engagement and open-ended response quality compared with static surveys, though they still fall short of skilled human interviewers on depth. Strict schema-constrained output (JSON Schema with nullable fields) is the standard way to turn the conversation into a structured record. The practical pattern is a slot-filling loop: keep a schema of required slots, ask the next most valuable missing slot or a targeted probe, and extract into a strict schema with nulls for unknowns.

### Cited Findings
- Xiao et al. (ACM TOCHI 2020, ~600 participants, 5,200+ free-text responses): an AI chatbot conversational survey drew higher engagement and significantly better responses than Qualtrics on informativeness, relevance, specificity and clarity (Gricean maxims). The authors are affiliated with Juji, Inc. — [arXiv 1905.10700](https://arxiv.org/abs/1905.10700v2)
- An LLM chatbot with dynamic follow-ups and real-time summaries improved engagement over a baseline and was rated better than standard surveys. It fell short of human interviewers on richness and specificity. The authors frame it as an "augmented survey" rather than a replacement for interviewers — [arXiv 2309.10187](https://arxiv.org/pdf/2309.10187)
- Most chatbot-survey work focuses on probing. LLMs can also live-code open-text answers, but there is little systematic evaluation of the effect on data quality. Performance may differ between factual and attitudinal questions — [arXiv 2504.13908](https://arxiv.org/pdf/2504.13908v3)
- AI-assisted conversational interviewing is reviewed for effects on data quality and respondent experience. Prior work found improved experience and, in some circumstances, better data quality — [Survey Research Methods (Konstanz)](https://ojs.ub.uni-konstanz.de/srm/article/download/8624/7922/37215?inline=1)
- Theory-based probe types improve chatbot survey data quality, and the best probe depends on context — [arXiv 2503.08582](https://arxiv.org/abs/2503.08582)
- Modular conversational agent architectures for surveys/interviews exist (separating dialogue management from content) — [arXiv 2412.17049](https://arxiv.org/pdf/2412.17049) (title only seen)
- OpenAI Structured Outputs (`strict: true` JSON Schema) guarantees responses that follow the supplied schema (required keys, valid enums). JSON mode only guarantees valid JSON. The examples make all properties required with `additionalProperties: false`, and use `["string","null"]` unions for optional or missing information. Code should handle refusals (which may not follow the schema) and incomplete outputs. Use clear key names and descriptions, and build evals to choose the schema — [OpenAI Structured Outputs guide](https://developers.openai.com/api/docs/guides/structured-outputs)

### Inferences
- Architecture for a 5-10 minute interviewer:
  1. A fixed slot schema (the mini-PDD in section 2) with per-slot priority and "good enough" criteria.
  2. After each turn, run a strict-schema extraction that updates slots and marks each as filled, partial or unknown (null), with a confidence or "user guessed" flag.
  3. A policy picks the next turn: a probe on a vague but important slot (e.g., "a few" volume → ask for a number) or the highest-priority empty slot. Stop at a time/turn budget.
  4. Read back a summary for user confirmation and correction before final output.
  5. Output unknowns explicitly rather than inventing values.
- Keep the conversation turns separate from the extraction calls, so the interviewer stays natural while the record stays schema-valid. Log which values came from estimates and which from counts.
- Exception handling and decision rules are the slots LLM interviewers are most likely to under-probe. Give them explicit required probes (the human-interviewer depth gap in 2309.10187 suggests this).

### Gaps
- I found no published study specifically on LLM interviewers eliciting business process/workflow details from SMB owners, or on extraction accuracy for process models from conversation.
- Anthropic/Claude structured-output guidance was not retrieved in this budget. Only OpenAI's guide was checked.
- No quantitative evidence on the best turn count or stopping rules for LLM interviews was found.
