import type { Analysis } from "./analyse";
import { itemsPerWeek, type Range } from "./savings";
import {
  CLASS_LABELS,
  type IntegrationAccess,
  integrationAccess,
  type StepClass,
  TIER_CONTROLS,
  type Tier,
} from "./score";
import type { StepInput, WaitBand, WorkflowInput } from "./types";

/**
 * The assessment report on top of the scores: a recommendation with its confidence, process
 * KPIs from metrics-based process mapping, diagnostic findings (Lean waste probes), a phased
 * rollout and the systems involved. Method: docs/research/reports/AI agent workflow analysis
 * method.md (sections 1, 5 and 6). Thresholds are defaults to calibrate with real deployments.
 */

export type Verdict = "prioritise" | "pilot" | "fix_first" | "defer" | "not_now";
export type Confidence = "high" | "medium" | "low";
export type Severity = "high" | "medium" | "low";

export const VERDICT_LABELS: Record<Verdict, string> = {
  prioritise: "Prioritise",
  pilot: "Pilot",
  fix_first: "Fix the process first",
  defer: "Defer",
  not_now: "Not worth automating yet",
};

export const INTEGRATION_LABELS: Record<IntegrationAccess, string> = {
  api_or_connector: "API or ready-made connector",
  email_only: "Email only",
  ui_only: "Screen only (no API known)",
  none_physical: "Physical or paper",
  unknown: "Not known yet",
};

/** Elapsed hours a wait band stands for (working hours). */
const WAIT_HOURS: Record<WaitBand, number> = {
  none: 0,
  lt_1h: 0.5,
  same_day: 4,
  "1_3_days": 16,
  longer: 40,
};

export const WAIT_LABELS: Record<WaitBand, string> = {
  none: "No wait",
  lt_1h: "< 1 h",
  same_day: "Same day",
  "1_3_days": "1–3 days",
  longer: "> 3 days",
};

/** Productive hours in a full-time year, for FTE equivalents. */
export const HOURS_PER_FTE = 1650;

export interface Kpis {
  casesPerYear: number | null;
  /** Hands-on minutes for one case, all steps. */
  touchMinutesPerCase: number;
  /** Elapsed working hours from trigger to done, for one case. */
  leadTimeHours: number;
  /** Hands-on time ÷ elapsed time: low means work mostly waits. */
  activityRatio: number | null;
  rolledFirstPassYield: number;
  exceptionRate: number | null;
  baselineHoursYear: number;
  baselineFte: number;
  savedHoursYear: Range;
  savedFte: Range;
  /** Share of today's hours in steps an agent or automation would run. */
  automatableShare: number;
  stepsByClass: Record<StepClass, number>;
  maxTier: Tier;
}

export interface Finding {
  id: string;
  severity: Severity;
  title: string;
  detail: string;
  steps: string[];
}

export interface Phase {
  name: string;
  duration: string;
  actions: string[];
  exitCriteria: string;
}

export interface SystemNeed {
  system: string;
  access: IntegrationAccess;
  steps: string[];
}

export interface Report {
  verdict: Verdict;
  headline: string;
  rationale: string;
  confidence: Confidence;
  confidenceNote: string;
  summary: string[];
  kpis: Kpis;
  findings: Finding[];
  roadmap: Phase[];
  systems: SystemNeed[];
  approvers: string[];
  openQuestions: string[];
}

const r1 = (n: number) => Math.round(n * 10) / 10;
const int = (n: number) => Math.round(n).toLocaleString("en");
const pct = (n: number) => `${Math.round(n * 100)}%`;
const minutes = (s: StepInput) => s.touchMinutes ?? 5;
const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;
const roleOf = (s: StepInput) =>
  s.actorRole?.trim() ||
  {
    owner: "Owner",
    staff: "Staff",
    customer: "Customer",
    supplier: "Supplier",
    software: "Software",
  }[s.actorType];

export function hoursLabel(h: number) {
  if (h < 1) return `${Math.round(h * 60)} min`;
  if (h < 8) return `${r1(h)} h`;
  return `${r1(h / 8)} working days`;
}

function kpis(w: WorkflowInput, a: Analysis): Kpis {
  const perWeek = itemsPerWeek(w);
  const touch = w.steps.reduce((t, s) => t + (s.actorType === "software" ? 0 : minutes(s)), 0);
  const waits = w.steps.reduce((t, s) => t + WAIT_HOURS[s.waitBand], 0);
  const lead = touch / 60 + waits;
  const baseline = a.savings.baselineHoursYear;
  const stepsByClass: Record<StepClass, number> = {
    automate: 0,
    agent_check: 0,
    assist: 0,
    human: 0,
  };
  let agentHours = 0;
  a.scores.forEach((s, i) => {
    if (s.alreadyAutomated) return;
    stepsByClass[s.finalClass] += 1;
    if (s.finalClass === "automate" || s.finalClass === "agent_check")
      agentHours += a.savings.steps[i]?.baselineHoursYear ?? 0;
  });
  const fte = (h: number) => Math.round((h / HOURS_PER_FTE) * 100) / 100;
  return {
    casesPerYear: perWeek === null ? null : Math.round(perWeek * 48),
    touchMinutesPerCase: touch,
    leadTimeHours: r1(lead),
    activityRatio: lead > 0 ? touch / 60 / lead : null,
    rolledFirstPassYield: a.gates.rolledFirstPassYield,
    exceptionRate: w.exceptionsOutOf10 === null ? null : w.exceptionsOutOf10 / 10,
    baselineHoursYear: baseline,
    baselineFte: fte(baseline),
    savedHoursYear: a.savings.savedHoursYear,
    savedFte: {
      low: fte(a.savings.savedHoursYear.low),
      base: fte(a.savings.savedHoursYear.base),
      high: fte(a.savings.savedHoursYear.high),
    },
    automatableShare: baseline > 0 ? agentHours / baseline : 0,
    stepsByClass,
    maxTier: a.maxTier,
  };
}

function findings(w: WorkflowInput, a: Analysis, k: Kpis): Finding[] {
  const out: Finding[] = [];
  const hoursOf = (s: StepInput) =>
    a.savings.steps.find((x) => x.stepId === s.id)?.baselineHoursYear ?? 0;
  const human = w.steps.filter((s) => s.actorType !== "software");

  const rekey = human.filter((s) => s.rekeying);
  if (rekey.length) {
    const h = rekey.reduce((t, s) => t + hoursOf(s), 0);
    out.push({
      id: "rekeying",
      severity: k.baselineHoursYear > 0 && h / k.baselineHoursYear >= 0.2 ? "high" : "medium",
      title: "Data is re-typed between systems",
      detail: `${plural(rekey.length, "step")} copy information from one place into another (about ${int(h)} h a year). Re-keying is the clearest automation signal in office work: an integration or agent can carry the data across and remove typing errors.`,
      steps: rekey.map((s) => s.name),
    });
  }

  const waiting = w.steps.filter((s) => WAIT_HOURS[s.waitBand] >= 4);
  if (waiting.length || (k.activityRatio !== null && k.activityRatio < 0.2)) {
    out.push({
      id: "waiting",
      severity: k.activityRatio !== null && k.activityRatio < 0.1 ? "high" : "medium",
      title: "Work spends most of its time waiting",
      detail: `One case takes about ${hoursLabel(k.leadTimeHours)} from start to finish for ${k.touchMinutesPerCase} minutes of hands-on work (activity ratio ${k.activityRatio === null ? "n/a" : pct(k.activityRatio)}). Waiting usually sits at handoffs and approvals; an agent that acts the moment information arrives shortens the elapsed time more than the effort.`,
      steps: waiting.map((s) => s.name),
    });
  }

  const rework = w.steps.filter((s) => (s.firstPassOutOf10 ?? 9) <= 7);
  if (rework.length || k.rolledFirstPassYield < 0.7) {
    out.push({
      id: "rework",
      severity: k.rolledFirstPassYield < 0.5 ? "high" : "medium",
      title: "Cases are often not right first time",
      detail: `Only ${pct(k.rolledFirstPassYield)} of cases pass every step without correction (rolled first-pass yield). Automating an unreliable step repeats its errors faster, so fix the cause of rework in ${rework.length ? rework.map((s) => `"${s.name}"`).join(", ") : "the weakest steps"} before or during the pilot.`,
      steps: rework.map((s) => s.name),
    });
  }

  if (k.exceptionRate !== null && k.exceptionRate >= 0.3) {
    out.push({
      id: "exceptions",
      severity: k.exceptionRate >= 0.5 ? "high" : "medium",
      title: "Many cases leave the standard path",
      detail: `About ${pct(k.exceptionRate)} of cases need special handling. Agents run the standard path and hand exceptions to a person, so savings apply only to the standard share. Write down the three most common exceptions and how each is resolved; that is the agent's escalation policy.`,
      steps: w.exceptions.map((e) => e.what).filter(Boolean),
    });
  }

  const skilled = human.filter(
    (s) =>
      s.actorType === "owner" && (s.decisionType === "none" || s.decisionType === "fixed_rule"),
  );
  if (skilled.length || w.painTags.includes("skilled_routine")) {
    const h = skilled.reduce((t, s) => t + hoursOf(s), 0);
    out.push({
      id: "skilled_routine",
      severity: h >= 50 ? "high" : "medium",
      title: "Senior time goes on routine work",
      detail: skilled.length
        ? `The owner spends about ${int(h)} h a year on steps that follow fixed rules. These are the first hours to hand to automation or an agent.`
        : "Skilled people do routine parts of this process. Moving those parts to an agent frees time for work that needs their judgement.",
      steps: skilled.map((s) => s.name),
    });
  }

  if (w.painTags.includes("chasing")) {
    out.push({
      id: "chasing",
      severity: "medium",
      title: "Time is lost chasing missing information",
      detail:
        "Incomplete inputs trigger follow-ups. An agent can check each incoming item for completeness straight away and request what is missing before anyone starts work.",
      steps: [],
    });
  }

  if (w.painTags.includes("too_many_checks")) {
    out.push({
      id: "checks",
      severity: "low",
      title: "Checks may be heavier than the risk",
      detail:
        "Approval steps cost time on every case. Keep approvals for high-consequence steps (Tier 3–4 below) and replace the rest with automatic validation and sampling.",
      steps: [],
    });
  }

  if (w.documentation === "nothing" || w.documentation === "notes") {
    out.push({
      id: "documentation",
      severity: "medium",
      title: "The procedure is not written down",
      detail:
        "An agent needs explicit rules: what counts as complete, which thresholds apply, who handles what. Writing a one-page procedure is part of the first phase and also protects the business when a person is absent.",
      steps: [],
    });
  }

  const high = w.steps.filter((_s, i) => (a.scores[i]?.tier ?? 1) >= 3);
  if (high.length) {
    const restricted = w.steps.filter((_s, i) => a.scores[i]?.tier === 4);
    out.push({
      id: "risk",
      severity: restricted.length ? "high" : "medium",
      title: restricted.length
        ? "Some steps decide about people or safety"
        : "Some steps carry real consequences",
      detail: restricted.length
        ? "Decisions about someone's job, pay, credit or insurance, or about safety, stay with a person; AI may only prepare information (EU AI Act Annex III and Art. 6). Other high-consequence steps need approval before the agent acts."
        : "Money, commitments, sensitive data or hard-to-undo actions: the agent may prepare these, but a person approves each one before it happens, with an audit trail.",
      steps: high.map((s) => s.name),
    });
  }

  const order: Record<Severity, number> = { high: 0, medium: 1, low: 2 };
  return out.sort((x, y) => order[x.severity] - order[y.severity]);
}

function verdict(a: Analysis, k: Kpis): Pick<Report, "verdict" | "headline" | "rationale"> {
  const saved = a.savings.savedHoursYear.base;
  const doFirstHours = a.savings.steps
    .filter((s) => a.quadrants[s.stepId] === "do_first")
    .reduce((t, s) => t + s.savedHoursYear.base, 0);
  const gross = a.savings.steps.reduce((t, s) => t + s.savedHoursYear.base, 0);
  if (a.gates.defer) {
    return {
      verdict: "defer",
      headline: "Defer until the planned change has settled",
      rationale:
        "A major change to this process or its software is expected. Automating now would mean rebuilding the agent once the change lands; reassess when the new way of working is stable.",
    };
  }
  if (a.gates.fixFirst) {
    return {
      verdict: "fix_first",
      headline: "Fix the process first, then automate",
      rationale: `Only ${pct(k.rolledFirstPassYield)} of cases go through without correction. Remove the main causes of rework first; an agent on an unreliable process repeats its errors faster.`,
    };
  }
  if (saved >= 150 && gross > 0 && doFirstHours / gross >= 0.5) {
    return {
      verdict: "prioritise",
      headline: "Prioritise: strong case for an AI agent",
      rationale: `About ${int(saved)} hours a year can be released (${hoursLabel(saved / 48)} a week), mostly in steps that are both valuable and feasible to automate. Start with a supervised pilot.`,
    };
  }
  if (saved >= 40) {
    return {
      verdict: "pilot",
      headline: "Pilot: worthwhile, prove it on a small scale",
      rationale: `About ${int(saved)} hours a year can be released. The case is real but depends on ${doFirstHours / Math.max(gross, 1) < 0.5 ? "integration or exception handling" : "volume"}; a short pilot will confirm the numbers before wider rollout.`,
    };
  }
  return {
    verdict: "not_now",
    headline: "Not worth automating yet",
    rationale: `The expected saving is about ${int(saved)} hours a year${k.casesPerYear !== null ? ` at ${int(k.casesPerYear)} cases a year` : ""}. Unless volume grows or the process changes, an agent would cost more attention than it saves; a checklist or template may be enough.`,
  };
}

function confidence(w: WorkflowInput, a: Analysis): Pick<Report, "confidence" | "confidenceNote"> {
  const asked = 2 + w.steps.length; // volume, exceptions, minutes per step
  let answered = 0;
  if (itemsPerWeek(w) !== null) answered += 1;
  if (w.exceptionsOutOf10 !== null) answered += 1;
  answered += w.steps.filter((s) => s.touchMinutes !== null).length;
  const confirmed = w.steps.filter((s) => s.confirmed).length / Math.max(1, w.steps.length);
  const share = answered / asked;
  const level: Confidence =
    share >= 0.85 && confirmed >= 0.5 ? "high" : share >= 0.6 ? "medium" : "low";
  const missing = a.savings.openQuestions.length;
  return {
    confidence: level,
    confidenceNote:
      level === "high"
        ? "Based on your estimates for volume, step times and exceptions. Validate with a week of real timings during the pilot."
        : `${missing ? `${plural(missing, "input")} used typical values instead of your figures. ` : ""}${confirmed < 0.5 ? "Most step details are AI-drafted and not yet reviewed. " : ""}Treat the figures as a first estimate.`,
  };
}

function roadmap(w: WorkflowInput, k: Kpis, v: Verdict): Phase[] {
  const phases: Phase[] = [];
  const needsPrep =
    v === "fix_first" ||
    v === "defer" ||
    w.documentation === "nothing" ||
    w.documentation === "notes";
  if (needsPrep) {
    const actions = [
      ...(v === "defer" ? ["Let the planned change settle, then re-run this assessment"] : []),
      ...(v === "fix_first" || k.rolledFirstPassYield < 0.7
        ? ["Find and remove the top causes of rework"]
        : []),
      "Write a one-page procedure: inputs, rules, thresholds, who handles exceptions",
      ...(w.exceptions.length || (k.exceptionRate ?? 0) >= 0.3
        ? ["List the most common exceptions and how each is resolved"]
        : []),
    ];
    phases.push({
      name: "Prepare the process",
      duration: v === "defer" ? "Until the change is stable" : "1–3 weeks",
      actions,
      exitCriteria:
        "The standard path is written down and right first time in at least 8 of 10 cases.",
    });
  }
  if (v === "defer") return phases;
  const sample = k.casesPerYear ? Math.max(20, Math.min(100, Math.round(k.casesPerYear / 24))) : 30;
  phases.push({
    name: "Pilot in shadow mode",
    duration: "2–4 weeks",
    actions: [
      "Connect the agent to the systems listed below with the least access it needs",
      "The agent processes real cases; a person reviews and approves every output",
      "Record edits, rejections and escalations for each case",
    ],
    exitCriteria: `At least 90% of outputs accepted without edits over ${sample}+ cases, and no high-consequence errors.`,
  });
  const top = TIER_CONTROLS[k.maxTier];
  phases.push({
    name: "Supervised operation",
    duration: "4–8 weeks",
    actions: [
      top.humanCheck,
      "Exceptions and unclear cases go to the named person, with the case summary attached",
      "Weekly review of escalations and corrections; update the procedure and tests",
    ],
    exitCriteria:
      "Escalation rate and corrections stable for 4 weeks; savings confirmed against the baseline.",
  });
  phases.push({
    name: "Run and improve",
    duration: "Ongoing",
    actions: [
      "Monthly review: hours released, right-first-time rate, escalations, customer feedback",
      "Lower review sampling where quality holds; keep approvals on high-consequence steps",
      "Reassess when volume, rules or software change",
    ],
    exitCriteria: "Agreed KPIs reported monthly.",
  });
  return phases;
}

function systems(w: WorkflowInput): SystemNeed[] {
  const map = new Map<string, SystemNeed>();
  for (const s of w.steps) {
    for (const t of s.tools) {
      const key = t.trim();
      if (!key) continue;
      const found = map.get(key.toLowerCase());
      if (found) found.steps.push(s.name);
      else
        map.set(key.toLowerCase(), {
          system: key,
          access: integrationAccess({ ...s, tools: [key] }),
          steps: [s.name],
        });
    }
  }
  return [...map.values()];
}

function summary(w: WorkflowInput, a: Analysis, k: Kpis, headline: string): string[] {
  const name = w.name.trim() || "This process";
  const classCounts = (Object.keys(k.stepsByClass) as StepClass[])
    .filter((c) => k.stepsByClass[c] > 0)
    .map((c) => `${k.stepsByClass[c]} ${CLASS_LABELS[c].toLowerCase()}`)
    .join(", ");
  const s = a.savings.savedHoursYear;
  const value = a.savings.valueYear;
  return [
    `${name} runs about ${k.casesPerYear === null ? "an unknown number of" : int(k.casesPerYear)} times a year and takes ${int(k.baselineHoursYear)} hours of staff time (${k.baselineFte} FTE), with ${k.touchMinutesPerCase} minutes of hands-on work per case.`,
    `Of ${plural(w.steps.length, "step")}: ${classCounts || "none assessed"}. ${pct(k.automatableShare)} of today's effort sits in steps an agent or automation would run.`,
    `Expected release: ${int(s.low)}–${int(s.high)} hours a year (base ${int(s.base)} h, ${k.savedFte.base} FTE)${value ? `, worth about ${w.currency} ${int(value.low)}–${int(value.high)} a year in staff time` : ""}. This is capacity, not cash, unless paid hours, overtime or outsourcing go down.`,
    `${headline}. The highest consequence level is ${["", "low", "moderate", "high", "restricted"][k.maxTier]} (Tier ${k.maxTier}), which sets the human controls in the rollout below.`,
  ];
}

/** Builds the assessment report for one analysed workflow. */
export function buildReport(w: WorkflowInput, a: Analysis): Report {
  const k = kpis(w, a);
  const v = verdict(a, k);
  const approvers = [
    ...new Set(w.steps.filter((_s, i) => (a.scores[i]?.tier ?? 1) >= 3).map(roleOf)),
  ];
  return {
    ...v,
    ...confidence(w, a),
    summary: summary(w, a, k, v.headline),
    kpis: k,
    findings: findings(w, a, k),
    roadmap: roadmap(w, k, v.verdict),
    systems: systems(w),
    approvers,
    openQuestions: a.savings.openQuestions,
  };
}
