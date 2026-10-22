import type { Step, Workflow } from "../workflow";
import { estimateSavings, type Savings } from "./savings";
import {
  type Gates,
  gates,
  type Quadrant,
  quadrant,
  type StepScore,
  scoreStep,
  TIER_CONTROLS,
  type Tier,
} from "./score";
import type { TriggerType, WorkflowInput } from "./types";

export interface Analysis {
  scores: StepScore[];
  quadrants: Record<string, Quadrant>;
  gates: Gates;
  savings: Savings;
  /** The process as it runs today. */
  asIs: Workflow;
  /** The proposed agent workflow; null when the workflow should be redesigned first. */
  toBe: Workflow | null;
  /** Highest risk tier in the workflow. */
  maxTier: Tier;
}

const TRIGGER_LABEL: Record<TriggerType, string> = {
  email: "Email arrives",
  call: "Phone call comes in",
  web_form: "Web form or booking",
  chat: "Chat or text message",
  paper: "Paper document arrives",
  schedule: "On a schedule",
  manual: "Someone starts it",
  other: "It starts",
};

function trigger(w: WorkflowInput): Step {
  return {
    kind: "trigger",
    label: TRIGGER_LABEL[w.triggerType],
    detail: w.triggerSource || "",
  };
}

function output(w: WorkflowInput): Step {
  return { kind: "output", label: "Done", detail: w.outcome };
}

const unique = (xs: string[]) => [...new Set(xs.filter(Boolean))];

/** Turns the interview record into scores, savings and as-is / to-be workflows. */
export function analyseWorkflow(w: WorkflowInput): Analysis {
  const scores = w.steps.map((s) => scoreStep(w, s));
  const savings = estimateSavings(w, scores);
  const g = gates(w);
  const quadrants = Object.fromEntries(
    scores.map((s) => [
      s.stepId,
      quadrant(w, s, savings.steps.find((x) => x.stepId === s.stepId)?.baselineHoursYear ?? 0),
    ]),
  );
  const maxTier = Math.max(1, ...scores.map((s) => s.tier)) as Tier;

  const asIs: Workflow = {
    title: w.name || "Your workflow today",
    steps: [
      trigger(w),
      ...w.steps.map(
        (s): Step => ({
          kind: s.actorType === "software" ? "tool" : "human",
          label: s.name,
          detail: [
            s.actorRole ?? (s.actorType === "owner" ? "You" : s.actorType),
            s.touchMinutes !== null ? `${s.touchMinutes} min` : null,
            s.rekeying ? "re-typed" : null,
          ]
            .filter(Boolean)
            .join(" · "),
        }),
      ),
      output(w),
    ],
    integrations: unique(w.steps.flatMap((s) => s.tools)),
    guardrails: [],
  };

  let toBe: Workflow | null = null;
  if (!g.defer) {
    const steps: Step[] = [trigger(w)];
    w.steps.forEach((s, i) => {
      const score = scores[i];
      if (!score) return;
      if (score.alreadyAutomated) {
        steps.push({ kind: "tool", label: s.name, detail: "Already automated." });
        return;
      }
      switch (score.finalClass) {
        case "automate":
          steps.push(
            score.engine === "code"
              ? { kind: "tool", label: s.name, detail: "Done by an integration, no AI needed." }
              : { kind: "agent", label: s.name, detail: "AI agent does it; results sampled." },
          );
          break;
        case "agent_check":
          if (score.tier >= 3) {
            steps.push(
              score.engine === "code"
                ? { kind: "tool", label: s.name, detail: "Integration prepares the action." }
                : { kind: "agent", label: s.name, detail: "AI agent prepares the action." },
            );
            steps.push({
              kind: "human",
              label: /^(approve|review|check|sign|confirm)/i.test(s.name)
                ? `${s.name} (person decides)`
                : `Approve: ${s.name.charAt(0).toLowerCase()}${s.name.slice(1)}`,
              detail: TIER_CONTROLS[3].humanCheck,
            });
          } else {
            steps.push({
              kind: "agent",
              label: s.name,
              detail: "AI agent does it; unsure cases go to a person.",
            });
          }
          break;
        case "assist":
          steps.push({
            kind: "human",
            label: s.name,
            detail: "AI prepares drafts or summaries; a person decides.",
          });
          break;
        case "human":
          steps.push({ kind: "human", label: s.name, detail: "Stays with your team." });
          break;
      }
    });
    steps.push(output(w));
    const tiers = unique(scores.map((s) => String(s.tier))).map((t) => Number(t) as Tier);
    const exceptionsTo =
      w.steps.find((s) => s.actorType === "staff" && s.actorRole)?.actorRole ?? "you";
    toBe = {
      title: `${w.name || "Your workflow"}, with AI agents`,
      steps,
      integrations: asIs.integrations,
      guardrails: unique([
        ...tiers.sort((a, b) => b - a).flatMap((t) => TIER_CONTROLS[t].guardrails),
        `Exceptions and anything unclear go to ${exceptionsTo}`,
        "At most 3 retries, then hand to a person",
      ]).slice(0, 7),
    };
  }

  return { scores, quadrants, gates: g, savings, asIs, toBe, maxTier };
}
