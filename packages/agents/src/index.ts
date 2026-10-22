export { type Analysis, analyseWorkflow } from "./analysis/analyse";
export {
  draftStep,
  draftStepsFromText,
  MAX_STEPS,
  parseStepDrafts,
  stepFromDraft,
} from "./analysis/draft";
export {
  buildReport,
  type Confidence,
  type Finding,
  HOURS_PER_FTE,
  hoursLabel,
  INTEGRATION_LABELS,
  type Kpis,
  type Phase,
  type Report,
  type Severity,
  type SystemNeed,
  VERDICT_LABELS,
  type Verdict,
  WAIT_LABELS,
} from "./analysis/report";
export {
  type Assumption,
  DEFAULTS,
  estimateSavings,
  itemsPerWeek,
  type Range,
  type Savings,
} from "./analysis/savings";
export {
  CLASS_LABELS,
  QUADRANT_LABELS,
  type Quadrant,
  STEP_VERDICT_LABELS,
  type StepClass,
  type StepScore,
  type StepVerdict,
  stepVerdict,
  TIER_CONTROLS,
  TIER_LABELS,
  type Tier,
} from "./analysis/score";
export type * from "./analysis/types";
export { AGENTS, type Agent, type AgentCategory, CATEGORIES, getAgent } from "./catalogue";
export { isTemplateTask, matchAgent } from "./match";
export {
  extractJson,
  parseWorkflow,
  STEP_KINDS,
  STEP_LABELS,
  type Step,
  type StepKind,
  type Workflow,
} from "./workflow";
