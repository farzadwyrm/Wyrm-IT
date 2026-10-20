/**
 * The interview record for one workflow: a "mini process definition document". Field names
 * follow the method in docs/research/reports/AI agent workflow analysis method.md (section 2).
 */

/** Where a value came from; shown to the owner next to every number. */
export type Provenance =
  | "user_stated"
  | "user_estimate"
  | "ai_confirmed"
  | "ai_unconfirmed"
  | "default";

export type TriggerType =
  | "email"
  | "call"
  | "web_form"
  | "chat"
  | "paper"
  | "schedule"
  | "manual"
  | "other";

export type Recipient = "customer" | "supplier" | "team" | "authority" | "internal" | "other";

export type ActorType = "owner" | "staff" | "customer" | "supplier" | "software";

export type InputFormat =
  | "system_fields"
  | "structured_form"
  | "message_text"
  | "document"
  | "paper_photo"
  | "phone_call"
  | "in_person_physical";

export type DecisionType =
  | "none"
  | "fixed_rule"
  | "guided_judgement"
  | "experience_judgement"
  | "relational_or_physical";

export type WaitBand = "none" | "lt_1h" | "same_day" | "1_3_days" | "longer";

export type ImpactFlag =
  | "money"
  | "external_message"
  | "commitment"
  | "destructive_write"
  | "personal_data"
  | "sensitive_data"
  | "decision_about_person"
  | "safety"
  | "legal_statement";

export type MoneyBand = "lt_50" | "50_500" | "500_5000" | "gt_5000";
export type Reversibility = "easy" | "effort" | "irreversible";
export type ChangeExpected = "no" | "minor" | "some" | "major";
export type Documentation = "nothing" | "notes" | "checklist" | "instructions";
export type PainTag =
  | "waiting"
  | "mistakes"
  | "retyping"
  | "chasing"
  | "skilled_routine"
  | "too_many_checks";

/** What the AI (or the text fallback) drafts from the walk-through, before the owner confirms. */
export interface StepDraft {
  name: string;
  actorType: ActorType;
  tools: string[];
  inputFormat: InputFormat;
  rekeying: boolean;
  decisionType: DecisionType;
  impactFlags: ImpactFlag[];
}

export interface StepInput extends StepDraft {
  id: string;
  /** A role such as "office manager", never a person's name. */
  actorRole: string | null;
  decisionRule: string | null;
  /** Hands-on minutes per item. */
  touchMinutes: number | null;
  waitBand: WaitBand;
  /** Right first time, out of 10. */
  firstPassOutOf10: number | null;
  moneyBand: MoneyBand | null;
  reversibility: Reversibility;
  /** The owner never wants software to do this step. */
  keepHuman: boolean;
  /** True once the owner has seen and accepted the drafted fields. */
  confirmed: boolean;
}

export interface ExceptionCase {
  stepId: string | null;
  what: string;
  handling: string;
}

export interface WorkflowInput {
  name: string;
  outcome: string;
  triggerType: TriggerType;
  triggerSource: string;
  recipients: Recipient[];
  /** "How many last week/month?" */
  volumeCount: number | null;
  volumePeriod: "week" | "month";
  weekKind: "normal" | "busy" | "quiet";
  /** Only asked when the recalled period was not normal. */
  typicalPerWeek: number | null;
  whyNow: string;
  /** "Out of your last 10, how many didn't go the normal way?" */
  exceptionsOutOf10: number | null;
  exceptions: ExceptionCase[];
  changeExpected: ChangeExpected;
  documentation: Documentation;
  hourlyWage: number | null;
  currency: string;
  painTags: PainTag[];
  steps: StepInput[];
}
