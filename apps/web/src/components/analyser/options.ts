import type {
  ActorType,
  ChangeExpected,
  DecisionType,
  Documentation,
  ImpactFlag,
  InputFormat,
  MoneyBand,
  PainTag,
  Provenance,
  Recipient,
  Reversibility,
  TriggerType,
  WaitBand,
} from "@wyrm/agents";

/** Answer options for the assessment, worded for a business owner or operations lead. */

export const TRIGGERS: [TriggerType, string][] = [
  ["email", "Email received"],
  ["call", "Phone call"],
  ["web_form", "Web form or online booking"],
  ["chat", "Chat, SMS or WhatsApp message"],
  ["paper", "Paper document or post"],
  ["schedule", "Scheduled (e.g. weekly, month-end)"],
  ["manual", "Started by staff when needed"],
  ["other", "Other"],
];

export const RECIPIENTS: [Recipient, string][] = [
  ["customer", "Customers"],
  ["supplier", "Suppliers"],
  ["team", "Internal team"],
  ["authority", "Authorities (tax, regulator)"],
  ["internal", "Records only"],
  ["other", "Other"],
];

export const ACTORS: [ActorType, string][] = [
  ["owner", "Owner / manager"],
  ["staff", "Staff member"],
  ["customer", "Customer"],
  ["supplier", "Supplier"],
  ["software", "Already automated"],
];

export const INPUTS: [InputFormat, string][] = [
  ["system_fields", "Structured data in a system"],
  ["structured_form", "Structured web form"],
  ["message_text", "Free-text email or message"],
  ["document", "PDF or document"],
  ["paper_photo", "Paper or photo"],
  ["phone_call", "Phone conversation"],
  ["in_person_physical", "In person / physical work"],
];

export const DECISIONS: [DecisionType, string][] = [
  ["none", "No decision (data handling)"],
  ["fixed_rule", "Fixed rule (if X then Y)"],
  ["guided_judgement", "Judgement within written guidelines"],
  ["experience_judgement", "Judgement from experience"],
  ["relational_or_physical", "Relationship, empathy or presence"],
];

export const WAITS: [WaitBand, string][] = [
  ["none", "None"],
  ["lt_1h", "Under 1 hour"],
  ["same_day", "Same day"],
  ["1_3_days", "1–3 days"],
  ["longer", "More than 3 days"],
];

export const FIRST_PASS: [string, string][] = [
  ["10", "10 / 10"],
  ["9", "9 / 10"],
  ["8", "8 / 10"],
  ["7", "7 / 10"],
  ["6", "6 / 10"],
  ["5", "5 / 10 or fewer"],
];

export const FLAGS: [ImpactFlag, string][] = [
  ["money", "Moves money (payment, refund)"],
  ["external_message", "Sends to customers or suppliers"],
  ["commitment", "Commits the business (order, booking, cancellation)"],
  ["destructive_write", "Deletes or overwrites records"],
  ["personal_data", "Uses personal data"],
  ["sensitive_data", "Health, financial, ID or children's data"],
  ["decision_about_person", "Decides about a person's job, pay, credit or insurance"],
  ["safety", "Safety or emergency"],
  ["legal_statement", "Legal or tax statements"],
];

export const MONEY_BANDS: [MoneyBand, string][] = [
  ["lt_50", "Under 50"],
  ["50_500", "50–500"],
  ["500_5000", "500–5,000"],
  ["gt_5000", "Over 5,000"],
];

export const REVERSIBILITY: [Reversibility, string][] = [
  ["easy", "Easily reversed"],
  ["effort", "Reversible with effort or an apology"],
  ["irreversible", "Not reversible"],
];

export const CHANGES: [ChangeExpected, string][] = [
  ["no", "No change expected"],
  ["minor", "Minor adjustments"],
  ["some", "Some changes planned"],
  ["major", "Major change (new software or rules)"],
];

export const DOCS: [Documentation, string][] = [
  ["nothing", "Not documented"],
  ["notes", "Informal notes"],
  ["checklist", "Checklist or template"],
  ["instructions", "Step-by-step procedure"],
];

/** Lean waste probes, with what each looks like in office work. */
export const PAINS: [PainTag, string, string][] = [
  ["retyping", "Re-keying data", "Copying information between email, documents and systems"],
  ["waiting", "Waiting", "Work stalls on approvals, replies or a colleague"],
  ["mistakes", "Rework", "Errors found later and corrected"],
  ["chasing", "Chasing information", "Inputs arrive incomplete and need follow-up"],
  ["too_many_checks", "Over-processing", "Checks or approvals heavier than the risk"],
  ["skilled_routine", "Under-used skills", "Senior people doing routine steps"],
];

export const CURRENCIES: [string, string][] = [
  ["EUR", "EUR"],
  ["GBP", "GBP"],
  ["USD", "USD"],
];

export const PROVENANCE_LABEL: Record<Provenance, string> = {
  user_stated: "Stated",
  user_estimate: "Your estimate",
  ai_confirmed: "AI-drafted, reviewed",
  ai_unconfirmed: "AI-drafted",
  default: "Default",
};

export const EXAMPLE_WALKTHROUGH =
  "A supplier emails a PDF invoice to accounts@.\nThe office manager checks it against the purchase order in the shared spreadsheet.\nShe types the supplier, amounts and VAT into Xero.\nIf it is over 1,000 the owner approves it, usually the next day.\nShe schedules the payment in the banking app.";
