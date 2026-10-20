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

/** Answer options in the owner's words (research report, section 1). */
export const TRIGGERS: [TriggerType, string][] = [
  ["email", "An email arrives"],
  ["call", "A phone call"],
  ["web_form", "A web form or booking"],
  ["chat", "A chat or text message"],
  ["paper", "A paper document or post"],
  ["schedule", "On a schedule (e.g. every Friday)"],
  ["manual", "I or a colleague decide to start it"],
  ["other", "Something else"],
];

export const RECIPIENTS: [Recipient, string][] = [
  ["customer", "A customer"],
  ["supplier", "A supplier"],
  ["team", "My team"],
  ["authority", "An authority (tax, regulator)"],
  ["internal", "Nobody, it's record-keeping"],
  ["other", "Someone else"],
];

export const ACTORS: [ActorType, string][] = [
  ["owner", "Me"],
  ["staff", "A staff member"],
  ["customer", "The customer"],
  ["supplier", "A supplier"],
  ["software", "Software already does it"],
];

export const INPUTS: [InputFormat, string][] = [
  ["system_fields", "Already in a system, as fields"],
  ["structured_form", "A structured web form"],
  ["message_text", "Email or message text"],
  ["document", "A PDF or document"],
  ["paper_photo", "Paper or a photo"],
  ["phone_call", "A phone call"],
  ["in_person_physical", "In person or physical work"],
];

export const DECISIONS: [DecisionType, string][] = [
  ["none", "No decision"],
  ["fixed_rule", "A fixed rule (if this, then that)"],
  ["guided_judgement", "Judgement using guidelines or prices"],
  ["experience_judgement", "Judgement from experience"],
  ["relational_or_physical", "Needs empathy, relationships or being there"],
];

export const WAITS: [WaitBand, string][] = [
  ["none", "No wait"],
  ["lt_1h", "Under an hour"],
  ["same_day", "Same day"],
  ["1_3_days", "1–3 days"],
  ["longer", "Longer"],
];

export const FLAGS: [ImpactFlag, string][] = [
  ["money", "Takes, pays or refunds money"],
  ["external_message", "Sends something to a customer or supplier"],
  ["commitment", "Books, orders, cancels or agrees something"],
  ["destructive_write", "Deletes or overwrites records"],
  ["personal_data", "Uses people's personal details"],
  ["sensitive_data", "Health, financial, ID or children's data"],
  ["decision_about_person", "Decides about someone's job, pay, credit or insurance"],
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
  ["easy", "Easily undone"],
  ["effort", "With effort or an apology"],
  ["irreversible", "Not at all"],
];

export const CHANGES: [ChangeExpected, string][] = [
  ["no", "No"],
  ["minor", "Minor tweaks"],
  ["some", "Some changes"],
  ["major", "Major change (new software, rules)"],
];

export const DOCS: [Documentation, string][] = [
  ["nothing", "Nothing written down"],
  ["notes", "Some notes"],
  ["checklist", "A checklist or template"],
  ["instructions", "Step-by-step instructions"],
];

export const PAINS: [PainTag, string][] = [
  ["waiting", "Waiting on people"],
  ["mistakes", "Fixing mistakes"],
  ["retyping", "Re-typing or copying"],
  ["chasing", "Chasing missing information"],
  ["skilled_routine", "Skilled people doing routine work"],
  ["too_many_checks", "Too many checks"],
];

export const PROVENANCE_LABEL: Record<Provenance, string> = {
  user_stated: "you said",
  user_estimate: "you estimated",
  ai_confirmed: "AI drafted, you confirmed",
  ai_unconfirmed: "AI drafted",
  default: "default",
};

export const EXAMPLE_WALKTHROUGH =
  "A supplier emails a PDF invoice to our info@ inbox.\nI open it and check it against the purchase order in our shared spreadsheet.\nI type the supplier, amounts and VAT into Xero.\nIf it's over 1,000 I ask the owner to approve it.\nI schedule the payment in the bank.";
