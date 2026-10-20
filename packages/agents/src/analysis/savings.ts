import type { StepClass, StepScore } from "./score";
import type { Provenance, WorkflowInput } from "./types";

/**
 * Hours released, as a low/base/high range. Extends UiPath's benefit model with exception and
 * oversight terms (research report, section 6). Every default is shown to the owner.
 */
export const DEFAULTS = {
  weeksPerYear: 48,
  /** Rework time as a share of step time when a step is not right first time. */
  reworkFactor: 0.5,
  /** Saving rate per class, low/base/high. Exceptions are excluded before this applies. */
  savingRate: {
    automate: [0.6, 0.8, 0.9],
    agent_check: [0.3, 0.5, 0.7],
    assist: [0.15, 0.3, 0.5],
    human: [0, 0, 0],
  } satisfies Record<StepClass, number[]>,
  /** Oversight hours a week for a live workflow, low/base/high scenario. */
  oversightHoursPerWeek: [1, 0.5, 0.25],
  /** Employer cost on top of wage. */
  loadedCostMultiplier: 1.3,
  minutesWhenUnknown: 5,
  weeksPerMonth: 4.33,
} as const;

export interface Range {
  low: number;
  base: number;
  high: number;
}

export interface StepSavings {
  stepId: string;
  baselineHoursYear: number;
  savedHoursYear: Range;
}

export interface Assumption {
  label: string;
  value: string;
  provenance: Provenance;
}

export interface Savings {
  itemsPerWeek: number | null;
  baselineHoursYear: number;
  steps: StepSavings[];
  savedHoursYear: Range;
  savedHoursWeek: Range;
  /** Value of time released per year; null without a wage. */
  valueYear: Range | null;
  /** The step that contributes most to the base saving. */
  biggestStepId: string | null;
  assumptions: Assumption[];
  /** Required answers missing, so the range is wide. */
  openQuestions: string[];
}

export function itemsPerWeek(w: WorkflowInput): number | null {
  if (w.weekKind !== "normal" && w.typicalPerWeek !== null) return w.typicalPerWeek;
  if (w.volumeCount === null) return w.typicalPerWeek;
  return w.volumePeriod === "month" ? w.volumeCount / DEFAULTS.weeksPerMonth : w.volumeCount;
}

const round = (n: number) => Math.round(n * 10) / 10;
const scenarios = [0, 1, 2] as const;

export function estimateSavings(w: WorkflowInput, scores: StepScore[]): Savings {
  const perWeek = itemsPerWeek(w);
  const itemsYear = (perWeek ?? 0) * DEFAULTS.weeksPerYear;
  const openQuestions: string[] = [];
  if (perWeek === null) openQuestions.push("How many of these happen in a normal week");

  const steps: StepSavings[] = w.steps.map((step) => {
    const score = scores.find((s) => s.stepId === step.id);
    const minutes = step.touchMinutes ?? DEFAULTS.minutesWhenUnknown;
    if (step.touchMinutes === null) openQuestions.push(`Minutes for "${step.name}"`);
    const errorShare = 1 - (step.firstPassOutOf10 ?? 9) / 10;
    const baseline = (itemsYear * minutes * (1 + errorShare * DEFAULTS.reworkFactor)) / 60;
    const cls: StepClass = !score || score.alreadyAutomated ? "human" : score.finalClass;
    const x = score?.exceptionShare ?? 0.2;
    const [low, base, high] = scenarios.map(
      (i) => baseline * (1 - x) * (DEFAULTS.savingRate[cls][i] ?? 0),
    );
    return {
      stepId: step.id,
      baselineHoursYear: score?.alreadyAutomated ? 0 : baseline,
      savedHoursYear: { low: low ?? 0, base: base ?? 0, high: high ?? 0 },
    };
  });

  const anyChange = steps.some((s) => s.savedHoursYear.base > 0);
  const total = (i: 0 | 1 | 2) => {
    const key = (["low", "base", "high"] as const)[i];
    const gross = steps.reduce((sum, s) => sum + s.savedHoursYear[key], 0);
    const oversight = anyChange ? DEFAULTS.oversightHoursPerWeek[i] * DEFAULTS.weeksPerYear : 0;
    return Math.max(0, gross - oversight);
  };
  const savedHoursYear = { low: round(total(0)), base: round(total(1)), high: round(total(2)) };
  const perWeekRange = {
    low: round(savedHoursYear.low / DEFAULTS.weeksPerYear),
    base: round(savedHoursYear.base / DEFAULTS.weeksPerYear),
    high: round(savedHoursYear.high / DEFAULTS.weeksPerYear),
  };
  const money = (h: number) =>
    Math.round((h * (w.hourlyWage ?? 0) * DEFAULTS.loadedCostMultiplier) / 10) * 10;
  const valueYear =
    w.hourlyWage === null
      ? null
      : {
          low: money(savedHoursYear.low),
          base: money(savedHoursYear.base),
          high: money(savedHoursYear.high),
        };

  const biggest = [...steps].sort((a, b) => b.savedHoursYear.base - a.savedHoursYear.base)[0];

  const assumptions: Assumption[] = [
    {
      label: "Items per normal week",
      value: perWeek === null ? "unknown" : String(round(perWeek)),
      provenance: perWeek === null ? "default" : "user_estimate",
    },
    ...w.steps.map((s) => ({
      label: `Minutes per item: ${s.name}`,
      value: String(s.touchMinutes ?? DEFAULTS.minutesWhenUnknown),
      provenance: (s.touchMinutes === null ? "default" : "user_estimate") as Provenance,
    })),
    {
      label: "Exceptions that stay with a person",
      value: w.exceptionsOutOf10 === null ? "2 in 10" : `${w.exceptionsOutOf10} in 10`,
      provenance: w.exceptionsOutOf10 === null ? "default" : "user_estimate",
    },
    { label: "Working weeks a year", value: String(DEFAULTS.weeksPerYear), provenance: "default" },
    {
      label: "Time saved where automated / agent / assisted (base)",
      value: "80% / 50% / 30%",
      provenance: "default",
    },
    {
      label: "Oversight time once live",
      value: `${DEFAULTS.oversightHoursPerWeek[1]} h a week`,
      provenance: "default",
    },
  ];
  if (w.hourlyWage !== null) {
    assumptions.push(
      { label: "Hourly wage", value: `${w.currency} ${w.hourlyWage}`, provenance: "user_estimate" },
      {
        label: "Employer cost on top of wage",
        value: `×${DEFAULTS.loadedCostMultiplier}`,
        provenance: "default",
      },
    );
  }

  return {
    itemsPerWeek: perWeek === null ? null : round(perWeek),
    baselineHoursYear: round(steps.reduce((s, x) => s + x.baselineHoursYear, 0)),
    steps,
    savedHoursYear,
    savedHoursWeek: perWeekRange,
    valueYear,
    biggestStepId: biggest && biggest.savedHoursYear.base > 0 ? biggest.stepId : null,
    assumptions,
    openQuestions,
  };
}
