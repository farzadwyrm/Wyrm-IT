# Process discovery and analysis methods used before automation (SIPOC, VSM/MBPM, BPMN, Lean waste, process/task mining, process interviews)

Research date: 2026-10-20. I used about 15 searches and fetches. Primary sources were Microsoft Learn, Celonis docs, UiPath docs, Lean Enterprise Institute (LEI) lexicon and AHRQ. Several points come from secondary practitioner sources and are labelled as such. ASQ (403), the OMG spec PDF, and one van der Aalst PDF (binary) could not be fetched directly.

## 1. SIPOC: structure, when it is used, how it scopes a process

### Takeaway
SIPOC is a one-page, five-column scoping table (Suppliers, Inputs, Process, Outputs, Customers). It is built early in a project. The "P" column is a deliberately coarse 4–7 step outline that fixes the start and end boundaries before anyone maps detail. It needs almost no training, so it is the easiest consultant artifact to turn into a self-serve form.

### Cited Findings
- AHRQ defines SIPOC as "a high-level flowchart" that maps the suppliers, inputs, outputs and users of a process. It recommends SIPOC at the start of a project, when a process has multiple suppliers, inputs, outputs or users, and when process elements or end users are unclear. — [AHRQ Workflow Assessment Toolkit: SIPOC](https://digital.ahrq.gov/health-it-tools-and-resources/evaluation-resources/workflow-assessment-health-it-toolkit/all-workflow-tools/sipoc)
- AHRQ procedure:
  1. Identify the process.
  2. Assemble knowledgeable people.
  3. Draw the flowchart where all can see it.
  4. List outputs.
  5. List users (customers).
  6. List inputs.
  7. List input suppliers.
  8. Review for omissions, duplicates, inaccuracies and unclear items.
  9. Draw the final SIPOC.

  Strengths: easy to use, needs little or no training, helps define project scope. Limitation: "does not apply to all processes". AHRQ cites George et al., *Lean Six Sigma Pocket Toolbook* (2005), and Tague, *The Quality Toolbox* (2005). — [AHRQ](https://digital.ahrq.gov/health-it-tools-and-resources/evaluation-resources/workflow-assessment-health-it-toolkit/all-workflow-tools/sipoc)
- The University of Illinois BPI guide starts with the P column and keeps it to about 4–7 high-level steps. Those steps become the high-level map and set the scope. The remaining columns are filled next, with suppliers both internal and external. — [U. Illinois AITS BPI SIPOC How-To Guide](https://www.aits.uillinois.edu/UserFiles/Servers/Server_474/File/Professional_Services/BPI/BPI-SIPOC-HowToGuide.pdf) (search-snippet level; PDF not fully read)
- Typical facilitation uses a whiteboard or flip chart with S-I-P-O-C headings, or sticky notes on a wall. — [U. Illinois AITS](https://www.aits.uillinois.edu/UserFiles/Servers/Server_474/File/Professional_Services/BPI/BPI-SIPOC-HowToGuide.pdf); [AHRQ](https://digital.ahrq.gov/health-it-tools-and-resources/evaluation-resources/workflow-assessment-health-it-toolkit/all-workflow-tools/sipoc)

### Inferences
- For a self-serve interview, SIPOC maps directly onto the opening screens:
  - "What starts this and what does 'done' look like?" sets the boundaries.
  - "List the 4–7 main steps" gives the P column.
  - "What information or documents do you need, and who or what provides them?" gives Inputs and Suppliers.
  - "What do you produce and who receives it?" gives Outputs and Customers.
- SIPOC's coarse P column suits SMB owners. It stops them from drowning in detail before the boundary is agreed, and the detailed steps come next.
- SIPOC records no time, volume, decisions or exceptions. On its own it is not enough for automation analysis.

### Gaps
- ASQ's own SIPOC page returned HTTP 403, so the ASQ wording is not quoted. The two sources I could read (AHRQ and the U. Illinois guide) give the procedure consistently.
- I found no authoritative source fixing the order in which the columns are filled. AHRQ lists outputs and customers before inputs and suppliers. Illinois starts with P, then the rest.

## 2. Value stream mapping (VSM) and metrics-based process mapping (MBPM): metrics per step, lead time vs touch time, finding waste

### Takeaway
VSM, per the LEI lexicon, captures per-step cycle time, lead time, uptime, changeover and %C/A. For office work, Karen Martin and Mike Osterling's MBPM puts process time (PT), lead time (LT) and %C&A on a swimlane per activity. Two summary ratios follow:
- **Activity ratio** = total PT / total LT, which exposes waiting.
- **Rolled first-pass yield (RFPY)** = the product of the %C&A values, which exposes rework.

Waste is found by circling the longest LTs, low %C&As, high PTs and large LT/PT gaps, which usually sit at handoffs.

### Cited Findings
- LEI defines VSM as diagramming every step in the material and information flows from order to delivery, used to identify and eliminate waste. Process-box data:
  - Cycle time (C/T)
  - Lead time (L/T): the time one piece takes from start to finish
  - Uptime
  - Changeover time (C/O)
  - %C/A: the "percentage of product completed with perfect quality at a process step"
  - Available time

  Waste becomes visible by comparing a current-state map with a future-state map. — [LEI Lexicon: Value-Stream Mapping](https://www.lean.org/lexicon-terms/value-stream-mapping/)
- MBPM was developed by Karen Martin and Mike Osterling for office and service processes. Each activity on a swimlane carries PT, LT and %C&A, plus "barriers to flow" and staff count. It is typically used to drill down from a value stream map. — [Karen Martin Group webinar slides (SlideShare)](https://www.slideshare.net/slideshow/metrics-based-process-mapping/7123821); book: *Metrics-Based Process Mapping: Identifying and Eliminating Waste in Office and Service Processes* (2nd ed. 2024) — [AbeBooks listing](https://www.abebooks.com/Metrics-Based-Process-Mapping-Identifying-Eliminating-Waste/32156973639/bd)
- MBPM summary metrics:
  - Critical-path PT sum and critical-path LT sum
  - Activity Ratio (AR)
  - RFPY
  - Total PT
  - Labor required

  One illustrative service map shows AR = 6.8% and RFPY = 1.1%. This is an example figure, not a benchmark. Improvement starts by circling "longest LTs, low %C&As, high PTs, low step-specific ARs". — [Karen Martin Group slides](https://www.slideshare.net/slideshow/metrics-based-process-mapping/7123821)
- Red Hat's practitioner description of MBPM:
  - Process time is the active work effort, nested inside elapsed lead time.
  - When lead time is much higher than process time, work is "sitting in queues or waiting on someone else", which "typically happens at handoffs".
  - %C/A is the share of work correct on the first attempt, and it compounds across dependent steps.

  — [Red Hat blog: Metrics-Based Process Mapping](https://www.redhat.com/en/blog/metrics-based-process-mapping-mbpm) (seen via search snippet; the direct fetch returned 404)

### Inferences
- The VSM/MBPM metrics an SMB owner can estimate without data are:
  - "How long does this step take when you actually work on it?" gives PT, or touch time.
  - "How long from when it arrives to when it is passed on?" gives LT, or elapsed time.
  - "Out of 10, how many arrive complete and correct and don't need chasing or fixing?" gives %C&A.
  - "Who hands it to whom?" gives handoffs.
- From those four answers per step, an analyst or an AI can compute activity ratio and RFPY. They can then flag waiting-dominated and rework-dominated steps.
- Ask for %C&A as "out of 10". It is the most intuitive way to elicit first-pass yield from non-experts. This is a design suggestion, not a sourced practice.
- Manufacturing-only fields (uptime, changeover, available time) should be dropped for office workflows.

### Gaps
- I did not read MBPM's exact RFPY and AR formulas from the primary book. The formulas above (AR = PT/LT; RFPY = product of %C&A) are the standard interpretation and match the Red Hat note on compounding. They should still be checked against Martin & Osterling (2024).
- LEI's own office-VSM materials (for example *Learning to See*, or Keyte & Locher's *The Complete Lean Enterprise*) were not retrieved.

## 3. BPMN / swimlane maps: minimum element set and simplified notations

### Takeaway
BPMN 2.0 defines three Process Modeling conformance subclasses: Descriptive, Analytic and Common Executable. The Descriptive subclass is the business-user "Level 1" palette inherited from flowcharting:
- Pools and lanes
- None, message and timer start events
- None and message end events
- Tasks (none, user, service)
- Subprocesses and call activities
- Exclusive (XOR) and parallel gateways
- Sequence and message flow
- Data objects and data stores
- Annotations

That subset is enough to represent an SMB workflow.

### Cited Findings
- BPMN 2.0's Process Modeling conformance class has three subclasses: Descriptive, Analytic and Common Executable. Each specifies "a limited set of elements and a limited set (as a minimal requirement) of attributes". Analytic expands the palette for event-triggered behavior, critical to modeling exception handling. — [ISO/IEC 19510 (BPMN 2.0.1) preview, VDE Verlag](https://www.vde-verlag.de/iec-normen/preview-pdf/info_isoiec19510{ed1.0}en.pdf); [BPM Institute on Silver's *BPMN Method and Style*](https://bpminstitute.org/resources/books/resources-books-bpmn-method-and-style)
- Elements of the Descriptive subclass, according to a practitioner guide:
  - Events: Message, Timer and None Start; Message and None End
  - Activities: Task (none), User Task, Service Task, expanded and collapsed SubProcess, CallActivity
  - Gateways: Exclusive (XOR) and Parallel
  - Flows: Sequence and Message
  - Containers: Pool and Lane
  - Data: Data Object and Data Store
  - Artifacts: Text Annotation and Data Association

  — [Visual Paradigm: BPMN Descriptive Modeling guide](https://s.visual-paradigm.com/guide/mastering-bpmn-descriptive-modeling-a-practitioners-guide-to-the-essentials/) (secondary; the OMG spec was not fetched)
- Bruce Silver's *BPMN Method and Style* teaches Level 1 (= Descriptive), a palette "largely carried over from traditional flowcharting", and Level 2 (= Analytic) for event-triggered and exception behavior. — [BPM Institute](https://bpminstitute.org/resources/books/resources-books-bpmn-method-and-style)
- Caution: an ARIS community comment notes that some sites list subclass details carried over from XPDL, and that BPMN 2.0 has no "Simple" subclass. — [ARIS Community](https://ariscommunity.com/comment/8090)

### Inferences
- A non-expert-friendly minimum for a web interview needs only:
  - one trigger (a start event typed none, message or timer, which maps to "manual / something arrives / on a schedule")
  - ordered tasks, each with a lane (actor) and a task type (person, system, or person using a system, which maps to user and service tasks)
  - XOR decisions ("if… otherwise…")
  - optional parallel work
  - an end outcome
  - data objects and stores (documents, spreadsheets, systems)
- Message flows between pools correspond to handoffs to external parties such as a customer, supplier or bank.
- Timer start events matter for automation because they mark scheduled work, for example a weekly invoice run.
- Boundary and error events (Analytic level) are what BPMN uses for exceptions. A self-serve tool can collect them as plain text ("what goes wrong at this step and what do you do then?") without exposing notation.

### Gaps
- The official OMG BPMN 2.0.2 spec table (section 2, Conformance) was not retrieved, so the element list rests on a secondary source. It should be checked against omg.org/spec/BPMN/2.0.2 if it is quoted formally.

## 4. Lean waste (TIMWOODS / DOWNTIME) applied to office and knowledge work

### Takeaway
The seven Toyota wastes (TIMWOOD) plus an eighth, unused talent or "Skills", give TIMWOODS or DOWNTIME:
- Defects
- Overproduction
- Waiting
- Non-utilized talent
- Transportation
- Inventory
- Motion
- Extra-processing

Each has a clear office equivalent. Waiting (for approvals) and defects (rework) are usually the most visible in knowledge work.

### Cited Findings
- Office examples from Gemba Academy:
  - Transportation: frequently transferring files between software programs
  - Inventory: excess supplies
  - Motion: walking to a shared printer
  - Waiting: waiting for approvals or responses from other departments
  - Overprocessing: overly complex reports
  - Overproduction: printing more copies than needed
  - Defects: incorrect report data that must be redone
  - Skills: "a talented analyst is given only basic administrative tasks"

  Gemba Academy notes that "some methodologies include an eighth waste". — [Gemba Academy: The Seven (or Eight) Deadly Wastes](https://www.gembaacademy.com/gemba-insights/the-seven-or-eight-deadly-wastes)
- Process Excellence Network lists non-utilized talent signs: assigning staff to wrong tasks, wasteful admin tasks, poor communication, poor management and insufficient training. — [Process Excellence Network: DOWNTIME](https://www.processexcellencenetwork.com/lean-six-sigma-business-performance/articles/the-8-deadly-lean-wastes-downtime)
- Another practitioner source describes talent waste as highly skilled workers doing routine tasks, limited decision-making authority, and ignored improvement suggestions. — [Airacad](https://airacad.com/8-wastes-downtime-lean-identifying-hidden-costs/) (lower-authority source)
- Files waiting on signatures or approvals are cited as office waste and overlap with Waiting. — [SlideShare DOWNTIME table](https://www.slideshare.net/slideshow/downtime-8-wastes-44012341/44012341) (low authority)

### Inferences
Interview questions can be mapped one-to-one onto the wastes:

| Waste | Interview signal |
|---|---|
| Defects | "How often do you redo or correct this?" (also feeds %C&A) |
| Overproduction | Reports or copies nobody reads |
| Waiting | "What do you wait on? Approvals, replies, signatures?" |
| Non-utilized talent | "Which steps are done by someone more senior or skilled than needed?" (a direct automation or delegation signal) |
| Transportation | Re-keying or copying data between systems, emailing files around (the strongest automation signal in office work) |
| Inventory | Backlog or queue size ("how many are waiting right now?") |
| Motion | Switching between apps or tabs, searching for information |
| Extra-processing | Duplicate checks, unnecessary approvals, over-detailed formatting |

The mappings of "transportation" to data re-entry and "motion" to app-switching are common Lean-office interpretations. Only the file-transfer example is directly sourced (Gemba Academy).

### Gaps
- The origin of the eighth waste was not sourced. It is often attributed to later Western Lean writing rather than Ohno, but I did not verify this.
- LEI's own lexicon entry on waste (muda) was not retrieved.

## 5. Process mining and task mining: data used, what they reveal, and what an SMB without event logs can do

### Takeaway
Process mining needs an event log with at least Case ID, Activity and Timestamp, and optionally Resource and attributes. From it, a tool reconstructs the actual flow, frequency-ranked variants, throughput times, bottlenecks and loops.

Task mining (UiPath, Microsoft's Power Automate desktop recorder, Skan) instead records desktop UI actions (clicks, keystrokes, screenshots, app switches). It finds repetitive tasks and variants inside a person's work.

Both are enterprise-oriented and data- or IT-heavy. An SMB can approximate them with:
- self-reported estimates
- a short manual "event log" (logging a handful of real cases)
- exports of timestamps from tools it already uses (email, CRM, accounting, booking, form tools)

### Cited Findings
- Van der Aalst's minimal event-log assumptions:
  - Each event refers to an activity and a case (a process instance).
  - It may record a performer (resource).
  - It carries a timestamp.

  A log is a set of cases, each a trace or sequence of events. Typical tables have columns Case ID, Activity, Resource, Timestamp plus extra attributes. Sources include databases, CSV or spreadsheets, transaction logs and ERP systems. — [van der Aalst, "Event logs: the input for process mining" (processmining.org)](https://www.processmining.org/old-version/files/event_logs_the_input_for_process_mining.pdf); [van der Aalst publications](https://www.vdaalst.com/publications/p314.pdf); [Alpha algorithm (Wikipedia)](https://en.wikipedia.org/wiki/Alpha_algorithm)
- Microsoft Power Automate Process Mining requires these fields (docs updated August 2026):
  - **Case ID**, present for all activities. Examples: order ID, request ID, patient ID.
  - **Activity Name**. Example: "submit request", "request approved", "revise request".
  - **Timestamps**: one timestamp for an event log, start and end for an activity log.

  Optional fields: Resource ("human or technical resource executing a specific event"), event-level attributes, case-level attributes, and financial values per event or per case. — [Microsoft Learn: Prepare processes and data](https://learn.microsoft.com/en-us/power-automate/process-mining-processes-and-data)
- Microsoft warns that many application tables hold only current state, not historical events. Log tables may need joins, and "not all events that you're interested in are logged". The easiest trial is a CSV upload. — [Microsoft Learn](https://learn.microsoft.com/en-us/power-automate/process-mining-processes-and-data)
- Microsoft positions process mining as identifying bottlenecks and inefficiencies, automation opportunities and noncompliant processes. For service desks, it finds standardization opportunities "to reduce rework and eliminate pending cases". — [Microsoft Learn: Process mining overview](https://learn.microsoft.com/en-us/power-automate/process-mining-overview) (updated 2026-08-28)
- Microsoft task mining still requires recording activities with the Power Automate desktop recorder. I found no official retirement notice as of these results. — [Microsoft Learn: Process advisor processes](https://learn.microsoft.com/en-us/power-automate/process-advisor-processes)
- Celonis:
  - The Variant Explorer shows the 10 most frequent variants by default, with frequency, % of cases and average throughput time per variant.
  - Process Explorer KPIs include case frequency, activity frequency and throughput time (median, average, trimmed mean).

  — [Celonis docs: Variant Explorer](https://docs.celonis.com/en/variant-explorer.html); [Celonis help: Process Explorer](https://help.celonis.com/cpm47/en/process-explorer)
- Celonis automation rate per step can be shown through a custom KPI. A native "rework rate" KPI was not found in the docs I searched. — [Celonis community](https://community.celonis.com/general-product-q-a-2/is-the-process-explorer-customizable-in-such-way-that-in-addition-to-the-number-of-activities-per-process-step-the-automation-rate-of-each-step-will-also-be-shown-is-this-possible-or-has-anyone-tried-to-implement-such-a-requirement-1182)
- UiPath Unassisted Task Mining collects "employee desktop data comprising of the screenshot and log data upon each user action (mouse click, keystroke)". ML then suggests repetitive "task candidates". The AI does not rank candidates: a business analyst or SME decides automation potential. Assisted mode merges recorded traces of a known task into a graph and exports a Process Definition Document (PDD) and a Studio XAML skeleton. — [UiPath Task Mining docs](https://docs.uipath.com/task-mining/docs/unassisted-task-minining-introduction); [UiPath docs 2024.10](https://docs.uipath.com/task-mining/automation-suite/2024.10/user-guide/unassisted-task-minining-introduction)
- Skan uses a passive desktop agent ("Virtual Process Agent") that captures UI-level clicks, app switches and handoffs with computer vision. It needs no system event log, so it covers legacy and mainframe screens. Outputs include process maps, variants, exception paths and time allocation. Pricing is quote-only. — [ERPResearch on Skan](https://erpresearch.com/erp-add-ons/process-mining/skan-ai); [UiPath Marketplace listing](https://marketplace.uipath.com/listings/skan-process-discovery-and-intelligence); [Bardeen](https://www.bardeen.ai/best/task-mining-tools) (third-party and vendor material)

### Inferences
- What mining reveals, translated for interview design:
  - Variants become "what are the 2–3 common ways this goes, and roughly what share of cases each?"
  - Bottlenecks become "where does it sit longest?"
  - Rework loops become "which steps get repeated or sent back?"
  - Resource load becomes "who does each step?"
  - Automation rate becomes "which steps are already done by software?"
- The event-log schema is a good target data model for an SMB interview. Each described step = Activity, actor = Resource, a "typical case" = Case. Adding volume and timing estimates gives a synthetic, self-reported equivalent of a mined process. This record could later be validated against real timestamps from SMB tools such as an inbox, CRM or accounting software.
- An SMB with no event logs has three options:
  1. Self-report estimates (cheapest, biased toward the happy path).
  2. Keep a 1–2 week manual tally or log of real cases (case, step, who, start/end).
  3. Export history or audit logs from SaaS tools they already use and treat those as a mini event log.

  Desktop task mining is generally enterprise-priced and raises employee-monitoring and privacy concerns. This is an inference: SMB pricing is undocumented, and Skan's is quote-only.

### Gaps
- I did not find current (2026) public pricing for Celonis, UiPath Process Mining or Skan, or any SMB-tier offerings.
- The van der Aalst "Want to do a process mining project" slides came back as unreadable binary, so his practical data-extraction advice is not quoted.
- I found no authoritative source on whether "rework rate" is a standard named KPI across vendors. Rework is usually detected as repeated activities or loops within a case.

## 6. Practical process-interview approaches (day-in-the-life, gemba/walk-through, SIPOC-then-detail, happy path then exceptions)

### Takeaway
Practitioners converge on this sequence:
1. Scope with SIPOC.
2. Walk through the last real instance step by step, or observe it (gemba).
3. Capture the happy path first.
4. Probe exceptions, decisions, systems and duplicate data entry.
5. Validate by playing the result back.

Interviews alone are biased toward the "official" process and the typical case. Observation and data are needed for durations and hidden variation.

### Cited Findings
- Happy path first: define the default flow "when there are no exceptions, problems, or conditions", express it clearly, then "delve into the necessary exceptions". — [Modern Analyst: How would you build a Business Process Model?](https://modernanalyst.com/Careers/InterviewQuestions/tabid/128/ID/3626/How-would-you-build-a-Business-Process-Model.aspx)
- Why interviews miss steps:
  - People "describe their work imperfectly" and omit automatic steps.
  - Managers describe the process as designed, operators as executed.
  - First answers cover the typical case, while exceptions that consume much of the effort surface only through follow-up.

  Observation reveals double entry between systems, re-typed forms, tribal knowledge and hidden variation. It is "the only reliable way to estimate task durations and interruption rates". — [HEFLO: Elicitation techniques](https://blog.heflo.com/elicitation-techniques/)
- Recommended triangulation: interviews for intent and pain points, observation for behavior, documents and system data for quantities, workshops to resolve conflicts. Further guidance:
  - Analyze documents first.
  - Map as-is before to-be.
  - Treat disagreements as findings, since they reveal undocumented rules.
  - Play findings back for validation.

  — [HEFLO](https://blog.heflo.com/elicitation-techniques/)
- HEFLO's interview question set:
  - Scope and triggers: what starts it, what is "done", how many instances, seasonality.
  - Flow: "walk through the last instance step by step", who passes to whom, where and how long it waits.
  - Decisions: what information drives them, who can approve or override, up to what limit, where the rule is written.
  - Exceptions: when it doesn't go smoothly, how often, what happens when information is missing or wrong.
  - Systems: which systems, spreadsheets and documents; is anything entered twice; what is kept outside the official system.
  - Improvement: what you check manually that a system should check.

  — [HEFLO](https://blog.heflo.com/elicitation-techniques/)
- HEFLO's business-rule fields: condition → outcome (IF/THEN), owner, source, frequency, and constraint vs preference. — [HEFLO](https://blog.heflo.com/elicitation-techniques/)
- An EPC elicitation guide recommends observing where delays occur, who touches the work and which tools are used. It also recommends interviewing those who execute tasks, not only the process owner. — [Visual Paradigm: Eliciting Processes](https://skills.visual-paradigm.com/?p=881)
- A UMass Amherst study compared five elicitation methods on a chemotherapy plan-review process, covering normal and exception steps. It concluded that combining multiple methods is preferable to relying on one. — [UMass CS Tech Report UM-CS-2016-013](https://web.cs.umass.edu/publication/docs/2016/UM-CS-2016-013.pdf)
- SIPOC-then-detail: SIPOC is used at project start to set scope, and VSM and MBPM then drill into detail. — [AHRQ](https://digital.ahrq.gov/health-it-tools-and-resources/evaluation-resources/workflow-assessment-health-it-toolkit/all-workflow-tools/sipoc); [Karen Martin Group](https://www.slideshare.net/slideshow/metrics-based-process-mapping/7123821)

### Inferences
- A self-serve web interview can't observe, so it should imitate a gemba walk with concrete-instance prompting. "Think of the last time this happened. What arrived first?" is the walk-through-the-last-instance technique, and it reduces "official process" bias.
- Suggested flow:
  1. SIPOC boundary.
  2. Happy-path steps, at most about 7–10.
  3. Per-step detail: actor, system, time, wait, %C&A.
  4. Decisions.
  5. Exceptions ("what goes wrong, how often, what do you do").
  6. Volume and seasonality.
  7. Pain and waste probes (DOWNTIME).
  8. A generated summary or diagram the owner confirms (the playback/validation step).
- Ask single owners explicitly whether someone else does any steps. Owners often describe the process as designed rather than as staff execute it.

### Gaps
- The LEI gemba-walk lexicon page returned 404, and I found no other authoritative gemba-walk definition.
- I did not retrieve the BABOK Guide text, and no source specifically documented the "day-in-the-life" interview technique. It is treated here as a variant of observation or walk-through without a citation.
- I found no published study validating self-serve or online process-elicitation questionnaires against facilitated workshops.

## 7. Minimal field set to represent one workflow for later automation analysis

### Takeaway
Combining SIPOC (boundary and I/O), BPMN Descriptive (trigger, tasks, lanes, gateways, data), MBPM (PT, LT, %C&A), event-log semantics (case, activity, resource, timestamp) and HEFLO's elicitation categories gives a compact two-level schema:
- **Workflow level:** name, trigger, end outcome, customers and suppliers, volume and frequency, variants and exceptions.
- **Step level:** activity, actor, system or tool, inputs and outputs, decision rule, touch time, elapsed or wait time, %C&A or rework, handoff.

That is enough to compute automation-relevant indicators.

### Cited Findings (field → source lineage)
- Trigger / start event (none, message, timer) → BPMN Descriptive start events — [Visual Paradigm BPMN guide](https://s.visual-paradigm.com/guide/mastering-bpmn-descriptive-modeling-a-practitioners-guide-to-the-essentials/); "what starts the process, what defines done" — [HEFLO](https://blog.heflo.com/elicitation-techniques/)
- Suppliers, inputs, outputs, customers → [AHRQ SIPOC](https://digital.ahrq.gov/health-it-tools-and-resources/evaluation-resources/workflow-assessment-health-it-toolkit/all-workflow-tools/sipoc)
- Case (what instance flows through), activity (step name), resource (actor), timestamps → [Microsoft Learn data requirements](https://learn.microsoft.com/en-us/power-automate/process-mining-processes-and-data); [van der Aalst](https://www.processmining.org/old-version/files/event_logs_the_input_for_process_mining.pdf)
- Actor/lane, task type (user vs service/system), gateways, data objects and stores → [Visual Paradigm BPMN guide](https://s.visual-paradigm.com/guide/mastering-bpmn-descriptive-modeling-a-practitioners-guide-to-the-essentials/)
- Process time, lead time, %C&A, barriers to flow, staff count → [Karen Martin Group MBPM](https://www.slideshare.net/slideshow/metrics-based-process-mapping/7123821); [LEI VSM](https://www.lean.org/lexicon-terms/value-stream-mapping/)
- Volume and seasonality, waits, decision rules with approval limits, exceptions with frequency, systems used, double entry, shadow spreadsheets → [HEFLO](https://blog.heflo.com/elicitation-techniques/)
- Variants with frequency share, throughput time → [Celonis Variant Explorer](https://docs.celonis.com/en/variant-explorer.html)
- Automation rate per step (already done by software or not) → [Celonis community](https://community.celonis.com/general-product-q-a-2/is-the-process-explorer-customizable-in-such-way-that-in-addition-to-the-number-of-activities-per-process-step-the-automation-rate-of-each-step-will-also-be-shown-is-this-possible-or-has-anyone-tried-to-implement-such-a-requirement-1182)

### Inferences (proposed minimal schema for a short SMB self-serve interview; synthesis, not a published standard)

**Workflow level (asked once):**
1. Workflow name and the "thing" that flows (case), for example an enquiry, order, invoice or booking.
2. Trigger: type (something arrives by email, phone, form or message / on a schedule / someone decides) and source (supplier).
3. Done definition: end output and who receives it (customer).
4. Volume: cases per week or month, plus peaks and seasonality.
5. Typical end-to-end elapsed time (lead time) and the target the owner would like.
6. Main pain, chosen from a DOWNTIME-derived list (waiting, rework, re-typing or copying, chasing information, skilled people doing routine work, too many checks).

**Step level (repeated for about 4–10 happy-path steps):**
7. Step description, written as verb + object (activity).
8. Who does it (role, not name, to avoid personal data). This is the lane or resource.
9. Tool or system used (email, spreadsheet, accounting app, paper, phone). Flag whether information is re-typed from another system.
10. Inputs needed and outputs produced (data objects).
11. Hands-on time (process or touch time).
12. Wait before the next step, and what it is waiting for (lead time minus process time, and the barrier to flow).
13. Correct first time "out of 10" (%C&A). Feeds RFPY and rework.
14. Decision at this step? If yes, the rule as IF/THEN and who can approve (gateway and business rule).
15. Judgment level: rule-based, needs judgment, or needs relationship or empathy. This is a proposed field for automation feasibility. It has no direct source and comes from the task-mining "repetitive discrete steps" concept in [UiPath glossary](https://docs.uipath.com/task-mining/automation-suite/2024.10/user-guide/glossary).

**Exceptions (after the happy path):**
16. What commonly goes wrong or differs, how often (share of cases), and what is done then (variants and exception paths).

**Derived automatically (not asked):**
- Total touch time vs total lead time, giving the activity ratio.
- RFPY, from the product of the step %C&A values.
- Handoff count, from changes of actor.
- System-switch and re-keying count.
- Hours per month, from volume × touch time.
- Candidate steps that are rule-based, high-volume, re-keyed and low-judgment.

Further design points:
- Keep the interview short: SIPOC boundary, then the happy path, then per-step metrics, then exceptions. This mirrors the consultant sequence in section 6, compressed.
- Store the result in an event-log-compatible shape (case, activity, resource, est. duration). It can later be compared with real timestamps exported from the SMB's tools, which acts as a lightweight substitute for process mining.

### Gaps
- I found no published, validated "minimal field set for automation readiness" standard. The schema above is a synthesis. UiPath's PDD template or Automation Hub idea form likely holds a vendor version (fields such as frequency, volume, rule-based %, input type), but neither was retrieved.
- I found no evidence on how accurately SMB owners self-estimate touch time, wait time or %C&A compared with measured values.
