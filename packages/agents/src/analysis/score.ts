import type { DecisionType, ImpactFlag, InputFormat, StepInput, WorkflowInput } from "./types";

/**
 * Per-step scoring: capability (deterministic fit vs AI fit) and consequence (risk tier) are
 * scored independently and combined by taking the lower. Method and sources:
 * docs/research/reports/AI agent workflow analysis method.md, sections 3 and 4.
 * Thresholds are defaults to be calibrated with real deployments.
 */

export type StepClass = "automate" | "agent_check" | "assist" | "human";
export type Engine = "code" | "llm" | "person";
export type Tier = 1 | 2 | 3 | 4;
export type IntegrationAccess =
  | "api_or_connector"
  | "email_only"
  | "ui_only"
  | "none_physical"
  | "unknown";
export type Quadrant = "do_first" | "plan_carefully" | "quick_tidy_up" | "not_yet";

export const CLASS_RANK: Record<StepClass, number> = {
  automate: 3,
  agent_check: 2,
  assist: 1,
  human: 0,
};

export const CLASS_LABELS: Record<StepClass, string> = {
  automate: "Automate",
  agent_check: "AI agent + human check",
  assist: "AI assists a person",
  human: "Keep human",
};

export const TIER_LABELS: Record<Tier, string> = {
  1: "Tier 1 · Low",
  2: "Tier 2 · Moderate",
  3: "Tier 3 · High",
  4: "Tier 4 · Restricted",
};

const RULE: Record<DecisionType, number> = {
  none: 5,
  fixed_rule: 4,
  guided_judgement: 3,
  experience_judgement: 2,
  relational_or_physical: 1,
};

const INPUT: Record<InputFormat, number> = {
  system_fields: 5,
  structured_form: 4,
  message_text: 3,
  document: 3,
  phone_call: 2,
  paper_photo: 2,
  in_person_physical: 1,
};

/** Can a language model halve the time of this step at equal quality? (1-5) */
export function aiFit(input: InputFormat, decision: DecisionType): number {
  if (input === "in_person_physical") return 1;
  if (decision === "relational_or_physical") return 2;
  switch (input) {
    case "message_text":
    case "document":
      return decision === "experience_judgement" ? 3 : 5;
    case "phone_call":
      return decision === "experience_judgement" ? 3 : 4;
    case "paper_photo":
      return decision === "none" || decision === "fixed_rule" ? 3 : 2;
    default:
      // Structured data: AI helps with judgement; plain rules are better done in code.
      return decision === "guided_judgement" ? 4 : 3;
  }
}

/** Products with a public API or common connector (Zapier, Make, native integrations). */
const CONNECTED = [
  "gmail",
  "outlook",
  "microsoft 365",
  "google workspace",
  "google calendar",
  "calendar",
  "google sheets",
  "sheets",
  "excel",
  "xero",
  "quickbooks",
  "exact",
  "sage",
  "hubspot",
  "pipedrive",
  "salesforce",
  "shopify",
  "woocommerce",
  "stripe",
  "mollie",
  "zendesk",
  "freshdesk",
  "intercom",
  "slack",
  "teams",
  "notion",
  "airtable",
  "trello",
  "asana",
  "monday",
  "calendly",
  "cal.com",
  "whatsapp",
  "docusign",
  "dropbox",
  "google drive",
  "onedrive",
  "sharepoint",
  "crm",
  "booking system",
  "accounting",
];

export function integrationAccess(step: StepInput): IntegrationAccess {
  if (step.inputFormat === "in_person_physical" || step.inputFormat === "paper_photo") {
    return step.tools.length ? "unknown" : "none_physical";
  }
  const tools = step.tools.map((t) => t.toLowerCase());
  if (tools.some((t) => CONNECTED.some((c) => t.includes(c)))) return "api_or_connector";
  if (tools.some((t) => t.includes("mail")) || step.inputFormat === "message_text")
    return "email_only";
  if (tools.length) return "ui_only";
  return "unknown";
}

/** Highest tier any impact flag triggers (section 4). */
export function riskTier(step: StepInput): Tier {
  const f = new Set<ImpactFlag>(step.impactFlags);
  if (f.has("decision_about_person") || f.has("safety")) return 4;
  const money = f.has("money");
  if (
    (money && step.moneyBand !== "lt_50") ||
    f.has("destructive_write") ||
    (f.has("commitment") && step.reversibility !== "easy") ||
    f.has("sensitive_data") ||
    f.has("legal_statement")
  ) {
    return 3;
  }
  if (
    f.has("external_message") ||
    money ||
    f.has("commitment") ||
    (f.has("personal_data") && step.reversibility !== "easy")
  ) {
    return 2;
  }
  return 1;
}

const minClass = (a: StepClass, b: StepClass): StepClass =>
  CLASS_RANK[a] <= CLASS_RANK[b] ? a : b;

export interface StepScore {
  stepId: string;
  rule: number;
  input: number;
  aiFit: number;
  detFit: number;
  exceptionShare: number;
  integration: IntegrationAccess;
  capability: StepClass;
  tier: Tier;
  finalClass: StepClass;
  /** Who does the work once deployed. */
  engine: Engine;
  alreadyAutomated: boolean;
  /** One plain sentence explaining the class. */
  reason: string;
}

/** Exception share for one step: attributed cases, else the workflow share, else 0.2. */
export function exceptionShare(workflow: WorkflowInput, step: StepInput): number {
  const wf = workflow.exceptionsOutOf10 === null ? null : workflow.exceptionsOutOf10 / 10;
  const attributed = workflow.exceptions.filter((e) => e.stepId === step.id).length;
  if (wf !== null && attributed > 0 && workflow.exceptions.length > 0) {
    return Math.min(1, (wf * attributed) / workflow.exceptions.length);
  }
  return wf ?? 0.2;
}

export function scoreStep(workflow: WorkflowInput, step: StepInput): StepScore {
  const rule = RULE[step.decisionType];
  const input = INPUT[step.inputFormat];
  const fit = aiFit(step.inputFormat, step.decisionType);
  const detFit = (rule + input) / 2;
  const x = exceptionShare(workflow, step);
  const integration = integrationAccess(step);
  const tier = riskTier(step);
  const base = {
    stepId: step.id,
    rule,
    input,
    aiFit: fit,
    detFit,
    exceptionShare: x,
    integration,
    tier,
  };

  if (step.actorType === "software") {
    return {
      ...base,
      capability: "automate",
      finalClass: "automate",
      engine: "code",
      alreadyAutomated: true,
      reason: "Software already does this step.",
    };
  }

  // Capability: first matching rule (section 3).
  let capability: StepClass;
  let engine: Engine;
  let llmRule4 = false;
  let reason: string;
  if (step.keepHuman || fit === 1) {
    capability = "human";
    engine = "person";
    reason = step.keepHuman
      ? "You want a person to keep doing this."
      : "Physical or in-person work that software cannot do.";
  } else if (detFit >= 4 && input >= 4 && x <= 0.2 && integration !== "none_physical") {
    // Input must already be structured: plain code cannot read emails or PDFs reliably.
    capability = "automate";
    engine = "code";
    reason = "Clear rules on digital data: plain automation does it reliably, no AI needed.";
  } else if (fit >= 4 && rule >= 3 && x <= 0.3) {
    capability = "agent_check";
    engine = "llm";
    llmRule4 = true;
    reason = "Unstructured input with rules or guidelines: a good job for an AI agent.";
  } else if (fit >= 3) {
    capability = rule >= 3 ? "agent_check" : "assist";
    engine = "llm";
    reason =
      rule >= 3
        ? "An AI agent can do it, with a person checking the result."
        : "Needs experience: AI prepares drafts or summaries, a person decides.";
  } else if (fit === 2) {
    capability = "assist";
    engine = "llm";
    reason = "Mostly human work; AI can help with preparation.";
  } else {
    capability = "human";
    engine = "person";
    reason = "Best left to a person.";
  }

  // Risk caps autonomy (section 4).
  const cap: StepClass =
    tier === 1
      ? "automate"
      : tier === 2
        ? engine === "code"
          ? "automate"
          : "agent_check"
        : tier === 3
          ? "agent_check"
          : "assist";
  let finalClass = minClass(capability, cap);
  if (llmRule4 && tier === 1) finalClass = "automate";
  if (finalClass === "human") engine = "person";
  if (CLASS_RANK[finalClass] < CLASS_RANK[capability]) {
    reason += ` Capped by risk (${TIER_LABELS[tier]}).`;
  }

  return { ...base, capability, finalClass, engine, alreadyAutomated: false, reason };
}

export interface Gates {
  /** Major change expected: redesign first. */
  defer: boolean;
  /** Rolled first-pass yield below 0.5: fix the process before automating. */
  fixFirst: boolean;
  rolledFirstPassYield: number;
}

export function gates(workflow: WorkflowInput): Gates {
  const rfy = workflow.steps.reduce((p, s) => p * ((s.firstPassOutOf10 ?? 9) / 10), 1);
  return {
    defer: workflow.changeExpected === "major",
    fixFirst: rfy < 0.5,
    rolledFirstPassYield: rfy,
  };
}

/** Value (baseline hours a year) against feasibility (stability, integration, exceptions). */
export function quadrant(
  workflow: WorkflowInput,
  score: StepScore,
  baselineHoursYear: number,
): Quadrant {
  const h = baselineHoursYear;
  const value = h < 10 ? 1 : h < 50 ? 2 : h < 150 ? 3 : h < 400 ? 4 : 5;
  const stability = { no: 5, minor: 4, some: 2, major: 1 }[workflow.changeExpected];
  const integration = {
    api_or_connector: 5,
    email_only: 3,
    ui_only: 2,
    unknown: 2,
    none_physical: 1,
  }[score.integration];
  const exceptions = 5 - 4 * score.exceptionShare;
  const feasibility = (stability + integration + exceptions) / 3;
  if (value >= 3) return feasibility >= 3 ? "do_first" : "plan_carefully";
  return feasibility >= 3 ? "quick_tidy_up" : "not_yet";
}

export const QUADRANT_LABELS: Record<Quadrant, string> = {
  do_first: "Do first",
  plan_carefully: "Plan carefully",
  quick_tidy_up: "Quick tidy-up",
  not_yet: "Not worth it yet",
};

/** How a person stays in control at each tier, and the guardrails the agent runs with. */
export const TIER_CONTROLS: Record<Tier, { humanCheck: string; guardrails: string[] }> = {
  1: {
    humanCheck: "Review every result for the first 20, then a 5% sample.",
    guardrails: ["Every action logged", "Retry limit, then hand to a person", "Kill switch"],
  },
  2: {
    humanCheck:
      "Escalates to staff when unsure; review every result for the first 50, then a 10% sample.",
    guardrails: [
      "Tells people they are talking to an AI (EU AI Act Art. 50)",
      "Only the permissions this step needs",
      "Output checked against a fixed format before use",
      "Personal data filtered from logs",
    ],
  },
  3: {
    humanCheck: "The agent prepares; a person approves each action before it happens.",
    guardrails: [
      "Approval screen shows the source data and asks to confirm key fields",
      "Spending caps; the agent can never delete records",
      "Audit trail of every approval",
    ],
  },
  4: {
    humanCheck: "A person makes the decision; AI only prepares documents.",
    guardrails: [
      "No profiling or automated decisions about people",
      "Written assessment before use; get professional advice",
    ],
  },
};
