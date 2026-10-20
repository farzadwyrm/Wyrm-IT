# Automation Suitability Scoring Frameworks and ROI Calculation Methods

Research date: 2026-10-20. Sources were fetched or searched on that date. Several fine-grained items (exact vendor weights, paywalled Gartner scores, full academic papers) were not available and are listed under Gaps.

## 1. UiPath Automation Hub: High-Level Assessment, Detailed Assessment, scoring and KPIs

### Takeaway
UiPath is the most transparent vendor source. Its default High-Level Assessment (Idea Score) uses five 1–5 Likert questions averaged to 0–100%. Its Detailed Assessment produces Feasibility (yes/no), Automation Potential % and Ease of Implementation % (Easy 65–100, Medium 35–65, Difficult 0–35). Benefit is computed as Automation Potential % × As-Is hours (or cost, or FTE) per year. UiPath does not publish the internal weights or multiplier values.

### Cited Findings
**High-Level Assessment (Idea Score): questions and numeric scale** — [UiPath API guide, Input for High Level Assessment (Automation Suite 2.2510)](https://docs.uipath.com/automation-hub/automation-suite/2.2510/api-guide/input-for-high-level-assessment)
- Q1 `rules`, "How rule-based is your task?": Very Creative=1, Pretty Creative=2, A mix between rules and creativity=3, Pretty Rule Based=4, Very Rule Based=5.
- Q2 `input_type`, input data: Very Much Paperbased=1 … A mix between digital and paperbased=3 … Very Much Digital=5.
- Q3 `input_quality`, input structure: Very much unstructured=1 … mix=3 … Very Much Structured=5.
- Q4 `stability`, expected process changes in the next 6 months: Major Change Expected=1, Several=2, Some=3, Minor=4, No Change Expected=5.
- Q5 `documentation`: no documentation=1, Input Files=2, Task/Process maps/flowcharts=3, Standard Operating Procedure=4, Detailed Work Instructions=5.
- The same questions and scales appear in the 2023.x API guides — [UiPath 2023.4 API guide](https://docs.uipath.com/automation-hub/automation-suite/2023.4/api-guide/input-for-high-level-assessment)
- Default Idea Score is 0–100% (higher is better), described as "a simple arithmetic average" of the 5 Likert factors. The docs also mention a "weighted average between suitability % and readiness %" without defining it. If an admin customizes the weights, the Idea Score becomes a weighted average of question scores and suitability/readiness are no longer computed separately — [UiPath 2021.10, Information about the Idea Score](https://docs.uipath.com/automation-hub/automation-suite/2021.10/user-guide/information-about-the-idea-score)
- Newer cloud docs describe the submitter flow as "9 simple questions". The form is customizable: questions can be added, deleted, reordered, retyped and reweighted. The submitter gets a score plus an explanation — [UiPath search summary of platform setup / FAQ share idea](https://docs.uipath.com/automation-hub/automation-cloud/latest/user-guide/faq-share-idea). The default 9-question text was not retrieved; the API guide lists only the 5 scored questions.
- In 2021.10, selecting "Major change expected" for process or application stability hits a disqualifier threshold, and the idea is automatically set to On Hold — [UiPath 2021.10 detailed assessment algorithm](https://docs.uipath.com/automation-hub/automation-suite/2021.10/user-guide/information-about-the-detailed-assessment-algorithm)

**Detailed Assessment algorithm** — [UiPath, Detailed Assessment Algorithm (Automation Cloud, latest)](https://docs.uipath.com/automation-hub/automation-cloud/latest/user-guide/information-about-the-detailed-assessment-algorithm.md)
- Primary driver selection: Cost, Quality, or Productivity.
- **Feasibility** (yes/no): based on Process Stability and Applications Stability.
- **Automation Potential** (0–100%): based on how structured the input data is, process variability, and level of digitization of inputs. The process starts at 100% automatable and is reduced by these factors; "90%" means 90% of the described process can be automated.
- **Ease of Implementation** (0–100%) uses six factors: Process Stability, Applications Stability, input data structure, Process Variability, Process Length, and Number of Applications. Two multipliers apply: an OCR multiplier for scanned input, and the % of applications accessed via thin client (e.g. Citrix). Bands: Easy 65–100%, Medium 35–65%, Difficult 0–35%.
- **KPI formulas** (1-year horizon):
  - Total Time Needed (As-Is, h/yr) = baseline processing time + rework time from errors + audit/review time.
  - FTEs Required = Total Time (h/yr) / Average Working Days per Year / Working Hours per Day.
  - Cost/year (As-Is) = Average Employee Full Cost per Year × FTEs Required.
  - Benefit (hours) = Automation Potential % × Total Time Needed. Benefit (currency) = Automation Potential % × Cost/year. Benefit (FTE) = Automation Potential % × FTEs Required. Per-employee variants divide by the number of employees.

**Detailed Assessment input fields** — [UiPath, Completing the Detailed Assessment (2.2510)](https://docs.uipath.com/automation-hub/automation-suite/2.2510/user-guide/completing-the-detailed-assessment)
- Automation goal: Primary Reason to Automate.
- Environmental stability: Process Changes Expected in the Next 6 Months; Applications Changes Expected in the Next 6 Months (e.g. no, minor, several changes).
- Employee profile: Average Working Days/Year (net of holidays), Working Hours/Day, Average Employee Full Cost/Year (optional).
- Process volumetry: Task/Process Frequency; Activity Volume Average (company-wide or per employee); Number of Employees Performing the Task; Average Processing Time/Transaction (minutes); Average Error Rate % (optional); Average Rework Time/Transaction; Average Work to be Reviewed/Audited % and Review Time/Transaction (optional). Calculated fields: Total Processing, Rework and Review Time; Total Time As-Is; FTEs Required; Cost/Year As-Is.
- Ways of working: Process Peaks (frequency of volume increases); Average Number of Steps; Number of Ways to Complete the Process (variants).
- Data input: % of Digital Data Input (per source); Scanned Data Input (y/n); % of Structured Digital Data Input.
- Applications Used (from the App Inventory).
- Additional admin-defined questions do not affect the computed indicators.
- Post-automation results are captured once the idea is Live: time per transaction, error %, and time to resolve errors.

### Inferences
- UiPath's model is a two-stage funnel: a cheap Likert screen (rule-based, digital, structured, stable, documented), then a quantitative assessment that combines volumetrics with complexity.
- The benefit formula assumes no residual human effort beyond (1 − Automation Potential). It has no separate exception-handling or run-cost term, so it estimates gross capacity released, not net ROI.
- "Rule-based %" is not a numeric field in the detailed assessment. Rule-basedness appears only as the Likert Q1 in the high-level screen; variability and steps stand in for it in the detailed assessment.

### Gaps
- UiPath does not publish its numeric factor weights, how the six Ease factors combine, or the OCR and thin-client multiplier values. The docs reviewed explicitly omit them.
- The full default text of the "9 questions" in the current cloud high-level form was not retrieved.

## 2. Blue Prism (SS&C) PAT, Automation Anywhere Discovery Bot, Microsoft Power Automate Process Advisor

### Takeaway
Blue Prism's Process Assessment Tool (PAT) uses the same two-axis logic as UiPath: Automation Potential × Ease of Implementation, giving Prioritize, Review or Defer. Its value is process-time value × % automated. Automation Anywhere and Microsoft rely on discovery and process-mining data such as recordings, path frequency, rework and bottlenecks. Neither publishes a scoring rubric.

### Cited Findings
**Blue Prism PAT** — [Blue Prism PAT user guide, Process assessment](https://documentation.blueprism.com/pat/en-us/user-guide/process-assessment.htm)
- Automation Potential questions: all steps well defined and documented (y/n); how often the same steps repeat; number of people performing the process; periods of high demand (y/n); approximate number of applications; number of application screens; estimated automation potential of the end-to-end process (%); share of data already in structured digital format; approximate number of steps.
- Ease of Implementation questions: % of applications with no user interface; steps that could reuse existing Blue Prism objects; whether a digital worker can access the applications and security measures; whether a similar process was automated before (y/n); performance measures in place for the manual process (y/n); test data available (y/n).
- Benefit Opportunity inputs: working days/yr per FTE, average time per complete process run, frequency, completions per period, productive hours/day, and annual employee cost including salary and benefits.
- The tool "uses a Machine Learning (ML) algorithm to recommend process candidates". The recommendation comes from the relationship between the two scores and is shown in half-quadrants from 0 to 6. Outcomes: **Prioritize** (high potential, high ease); **Review** (high/low or low/high); **Defer** (low/low). Numeric thresholds are not published.
- Each process receives two scores, one for automation readiness and one for ease of implementation. The tool is free with a Blue Prism portal account — [Blue Prism PAT about page](https://bpdocs.blueprism.com/pat/en-us/pat-about.htm); [Blue Prism community blog, 2021](https://community.blueprism.com/blogs/danny-major1/2021/05/21/learn-which-process-to-automate-with-pat)
- PAT FAQ worked example: potential value = value of process time × percentage of process automated — [Blue Prism PAT FAQ](https://bpdocs.blueprism.com/pat/en-us/faqs.htm) (via search snippet)

**Automation Anywhere Discovery Bot**
- Discovery Bot identifies opportunities from user recordings and prioritizes them by ROI. System-generated opportunities are created once at least two recordings are approved, and default to "Model – Easy" and "Filter – Most common path" — [Automation Anywhere docs, Review opportunities and convert to bot](https://docs.automationanywhere.com/bundle/enterprise-v2019/page/discovery-bot/topics/discovery-bot-opportunities.html); [Discovery Bot intro](https://docs.automationanywhere.com/bundle/enterprise-v2019/page/discovery-bot/topics/discovery-bot-intro.html)

**Microsoft Power Automate Process Advisor / process mining**
- Features include rework detectors, root-cause analysis and automation recommendations in the process map. In one Microsoft case study, the process map showed that 20% of cases required rework — [Microsoft Power Platform blog](https://www.microsoft.com/en-us/power-platform/blog/?p=11109)
- Process Advisor's automation recommendation suggests connectors and actions based on recordings — [Inogic blog](https://www.inogic.com/blog/?p=29741) (partner source)

### Inferences
- The industry-standard RPA rubric has two axes: Potential/Value (volume, repetition, structured digital data, rule-based, people involved) and Ease/Feasibility (stability, number of apps/screens, UI access, reuse, test data, prior experience). Quadrant outcomes are Prioritize, Review and Defer.
- Mining-based tools add observed frequency, path variants and rework rate as objective inputs in place of self-reported Likert answers.

### Gaps
- No public weights for Blue Prism PAT (it is ML-based), and no public formula for Automation Anywhere's opportunity score.
- I found no primary Microsoft doc listing explicit scoring criteria for Process Advisor recommendations.
- "Bot Insight" is AA's analytics product. I found nothing showing it scores candidates.

## 3. Gen-AI / AI-agent use-case prioritisation (McKinsey, BCG, Deloitte, Gartner, Accenture, PwC)

### Takeaway
All the consultancies converge on a value × feasibility 2×2. Gartner's Use-Case Prism labels the quadrants Likely Wins, Calculated Risks, Marginal Gains and Selective Exceptions. Deloitte's 2026 matrix uses user desirability × technical sophistication, with the outcomes Scale, Enhance, De-prioritize and Stop. Agent-era frameworks typically add data readiness and risk as separate axes.

### Cited Findings
- **Gartner Use-Case Prism**: use cases are plotted on business value vs feasibility. Quadrants: high value/high feasibility = "likely wins"; high value/lower feasibility = "calculated risks"; high feasibility/low value = "marginal gains"; low/low = "selective exceptions". One collection holds 16 prisms with 294 industry-specific GenAI use cases. Gartner also has an "AI Opportunity Radar" that vets ideas on business value and feasibility — [Gartner research abstracts (paywalled)](https://www.gartner.com/en/documents/5426463); [Microsoft WWPS summary of Gartner Use-Case Prism: GenAI for Government Contact Centers](https://wwps.microsoft.com/?p=12638)
- **Deloitte**, "From data to decisions: Closing the AI value gap", 27 May 2026 (Ivanoff Olsen, Rampazzo) — [Deloitte Denmark](https://www.deloitte.com/dk/en/services/consulting/perspectives/closing-the-ai-value-gap.html)
  - Axis 1, technical sophistication: tech maturity, implementation complexity, production reliability, and technical KPIs (accuracy, latency, uptime, error rates).
  - Axis 2, user desirability: customer demand, usage frequency, criticality to the journey, and desirability KPIs (adoption, satisfaction, NPS, usage frequency).
  - Quadrants: Scale (high/high), Enhance (high desirability, low sophistication), De-prioritize (low/low), Stop (low desirability, high sophistication). A financial-attractiveness overlay applies, and anything not financially attractive is de-prioritized or stopped.
  - Decision gates at 90 days (reach/trial), 6 months (adoption trajectory) and 12 months (ROI and strategic decision).
- **BCG**: the "10-20-70" rule puts AI effort at 10% algorithms, 20% tech and data, and 70% people and processes. Value plays are "deploy, reshape, invent". BCG reports that 62% of companies recognize AI as a value source but only 24% have realized it — [BCG AI capabilities page](https://www.bcg.com/capabilities/artificial-intelligence); [BCG, ROI of AI](https://www.bcg.com/featured-insights/how-to/roi-of-ai)
- **McKinsey** (MGI, June 2023): current gen AI plus other technologies "have the potential to automate work activities that absorb 60 to 70 percent of employees' time today". This is technical potential, not a forecast. Gen AI could add 0.1–0.6 pp to annual labor productivity growth through 2040 — [McKinsey, The economic potential of generative AI](https://www.mckinsey.com/mgi/our-research/the-economic-potential-of-generative-ai-the-next-productivity-frontier)
- McKinsey partners (in an AWS interview) advise ranking use cases by impact and feasibility, then a 1–2 week PoC, then MVP, then scale — [AWS APN blog with McKinsey](https://aws.amazon.com/blogs/apn/generative-ai-trends-and-opportunities-for-aws-partners-a-conversation-with-mckinsey-and-company/)
- Agentic-AI prioritization (Info-Tech): business value, risk, data readiness and feasibility; workflow fit and autonomy guardrails for professional services — [Info-Tech, Assess and prioritize agentic AI use cases](https://www.infotech.com/research/assess-and-prioritize-agentic-ai-use-cases-in-government)

### Inferences
- For an AI-agent rubric, a defensible structure is value (hours, cost, revenue, customer impact) vs feasibility (data availability and quality, integration access, process stability, tolerance for error and risk), with risk/reversibility as a gate or third axis. This combines Gartner/Deloitte/Info-Tech with UiPath/Blue Prism.
- Deloitte's 2026 framework stresses post-launch gates, which supports building re-scoring with real adoption and accuracy data into the method.

### Gaps
- I found no primary McKinsey, Accenture or PwC document giving a named gen-AI prioritization rubric with explicit criteria or weights. Secondary blogs attribute value/feasibility matrices to McKinsey without a source.
- Gartner prism scores and feasibility sub-factors are paywalled.

## 4. ROI / time-saved formulas, assumptions and conservative automation rates

### Takeaway
The standard gross benefit is annual volume × handling time × automation rate (or potential %) × fully loaded hourly cost. UiPath includes rework and review time in the baseline. A credible net ROI subtracts residual human exception handling, licences, infrastructure, build and maintenance, over a 24–36 month horizon. UiPath reports a typical payback within 18 months.

### Cited Findings
- UiPath (Vargha Moayed, 18 Oct 2018), "RPA and the ROI Conundrum" — [UiPath blog](https://www.uipath.com/blog/rpa/rpa-and-the-roi-conundrum)
  - Build the business case over 24–36 months, and distinguish single-process ROI from program ROI.
  - Time saved, extrapolated from pilots, is "typically 30 to 70%". Multiply hours saved by a fully loaded hourly cost.
  - Error-reduction benefit multiplier of 1.1–1.3, chosen by qualitative consensus on low, medium or high error rates.
  - Fully loaded cost covers benefits, facilities and IT use, training, turnover and future raises.
  - Costs: licences (start at a 1:1 robot:process ratio, improving to 2.5–3 at scale); infrastructure; development (estimated by low/medium/high complexity tiers, with a 30–40% dev productivity gain after year 1 from reuse); monitoring and maintenance (script changes for overlooked exceptions, app changes, stoppages).
  - Payback: not always under a year, but in most cases strong ROI within 18 months.
- UiPath Automation Hub's baseline adds rework (error rate × rework time) and audit/review time to processing time. Benefit = Automation Potential % × that total — [UiPath Detailed Assessment Algorithm](https://docs.uipath.com/automation-hub/automation-cloud/latest/user-guide/information-about-the-detailed-assessment-algorithm.md)
- Blue Prism PAT: potential value = value of process time × % of process automated — [Blue Prism PAT FAQ](https://bpdocs.blueprism.com/pat/en-us/faqs.htm)
- Practitioner sources list baseline inputs as volumes, AHT and FTE cost including overhead, plus error/rework costs. They warn against inflated automation rates and ignored exception costs; employment costs commonly run about 30–40% above wages — [Auxiliobits, ROI modeling for RPA](https://www.auxiliobits.com/?p=20358); [Nividous](https://nividous.com/blogs/how-to-calculate-roi-for-rpa-project) (vendor/partner blogs, lower authority)

### Inferences
Synthesized formula (my construction; no single source states it exactly):
- Baseline hours/yr H0 = V × (AHT + e × T_rework + r × T_review) / 60, where V is volume, AHT is minutes, e is error rate and r is review %.
- Hours saved = V × AHT/60 × a × (1 − x) + rework hours avoided − V × x × T_exception/60 − oversight hours. Here a is the share of the task automated and x is the exception/hand-back rate.
- Value = hours saved × loaded hourly rate (salary × ~1.3–1.4 ÷ productive hours/yr). UiPath's productive-hours basis is working days × hours/day.
- Net annual = value − (licences/LLM usage + infra + maintenance) − amortized build. Payback (months) = build cost / (monthly net benefit).
- Conservative stance: use the low end of UiPath's 30–70% time-saved range (or 30–50%) for first estimates, show low/base/high scenarios, and list every assumption (volume source, AHT measurement method, loaded-rate multiplier, exception rate, horizon). Report "hours of capacity released" separately from "cash saved", since released time is not cash unless headcount or overtime changes.

### Gaps
- No authoritative source gives a standard default exception rate or a "conservative automation rate" benchmark beyond UiPath's 30–70% range.
- No primary source covers LLM/agent-specific run-cost modelling (tokens, human review of AI output) in these vendor frameworks.

## 5. Common pitfalls in automation selection

### Takeaway
The recurring pitfalls are automating broken or poorly understood processes, picking low-volume, high-variance, unstable or highly visible complex processes first, ignoring exceptions, and scaling too fast after a pilot. Vendor tools encode these as disqualifiers (major change expected → On Hold) and as Ease penalties.

### Cited Findings
- UiPath disqualifies ideas where major process or app change is expected (set to On Hold) — [UiPath 2021.10 detailed assessment algorithm](https://docs.uipath.com/automation-hub/automation-suite/2021.10/user-guide/information-about-the-detailed-assessment-algorithm)
- The "30–50% of initial RPA projects fail" figure is widely attributed to EY, but only through secondary sources; I did not locate the EY original — [FP&A Trends](https://fpa-trends.com/article/avoid-most-common-pitfalls-fpa-rpa-initiatives); [TechBeacon](https://techbeacon.com/enterprise-it/4-robotic-process-automation-project-fails-avoid?amp)
- RPA "won't fix a process that you don't fully understand, or that is fundamentally broken". Missing or mislabeled information makes bots repeat mistakes or stop — [TechBeacon](https://techbeacon.com/enterprise-it/4-robotic-process-automation-project-fails-avoid?amp)
- Good first candidates: high volume, rule-based with limited exceptions, stable systems, structured input. Starting with the most complex or high-visibility process "is almost always a mistake". Interview front-line staff rather than relying only on documented procedures — [Rockingtech, May 2026](https://rockingtech.co.uk/blog/what-to-automate-first-and-what-to-leave-alone) (small consultancy blog)
- After a successful first candidate there is a rush to onboard many processes, "and this is where it can break" — [AutomationEdge](https://automationedge.com/blogs/4-major-factors-for-the-rpa-projects-failure)
- Overlooked exceptions drive maintenance costs — [UiPath ROI Conundrum](https://www.uipath.com/blog/rpa/rpa-and-the-roi-conundrum)

**Academic RPA candidate-selection literature**
- Wanner, Hofmann, Fischer, Imgrund, Janiesch, Geyer-Klingeberg, "Process Selection in RPA Projects – Towards a Quantifiable Method of Decision Making", ICIS 2019. It uses process mining to build an automatable-indicator system for prioritizing RPA by ROI. The AIS eLibrary page marks the paper as **withdrawn** — [AIS eLibrary](https://aisel.aisnet.org/icis2019/business_models/business_models/28)
- A follow-on framework paper, "A framework to evaluate the viability of RPA for business process activities", appeared in the BPM 2020 RPA Forum (Springer DOI 10.1007/978-3-030-58779-6_14) from the FAU/Würzburg group — [arXiv 2007.10900](https://arxiv.org/abs/2007.10900). Its text could not be extracted, so the indicators are unverified.
- A 2023 Springer study names five main RPA selection criteria: execution time, stability, process complexity, data type and failure rate — [Springer chapter](https://link.springer.com/10.1007/978-3-031-46594-9_11) (via search snippet)
- Yadav & Panda (IJAI) derive standard RPA candidate criteria through SME surveys, PCA and Naive Bayes, selecting the top 20 criteria — [IJAI](https://ijai.iaescore.com/index.php/IJAI/article/view/25402)
- Leshob et al. (ÉTS Montréal) propose a rule-based method to identify RPA-suitable processes and note there is no easy, automatic method for this — [ÉTS Pure record](https://pure.etsmtl.ca/en/publications/a-rule-based-method-to-effectively-adopt-robotic-process-automati); a systematic review by Farinha et al. lists 32 selection criteria — [arXiv 2012.11951 / related](https://arxiv.org/pdf/2012.11951.pdf) (via search snippet)

### Inferences
- A rubric should include hard gates (process broken or undocumented, major change expected, unacceptable error risk, no system access) before any weighted scoring. It should penalize variant count and exception rate rather than relying only on volume.
- For SMB AI-agent work, low volume is a frequent trap. A minimum hours-per-year threshold should precede feasibility scoring.

### Gaps
- EY's primary 30–50% failure source was not found.
- The specific criteria and weights in Leshob et al. (2018/2020) and Wanner et al. (2019/2020) were not retrieved: the full texts were not accessible or were withdrawn.
