import type {
  ActorType,
  DecisionType,
  ImpactFlag,
  InputFormat,
  StepDraft,
  StepInput,
} from "./types";

export const MAX_STEPS = 10;

const ACTORS: readonly ActorType[] = ["owner", "staff", "customer", "supplier", "software"];
const INPUTS: readonly InputFormat[] = [
  "system_fields",
  "structured_form",
  "message_text",
  "document",
  "paper_photo",
  "phone_call",
  "in_person_physical",
];
const DECISIONS: readonly DecisionType[] = [
  "none",
  "fixed_rule",
  "guided_judgement",
  "experience_judgement",
  "relational_or_physical",
];
const FLAGS: readonly ImpactFlag[] = [
  "money",
  "external_message",
  "commitment",
  "destructive_write",
  "personal_data",
  "sensitive_data",
  "decision_about_person",
  "safety",
  "legal_statement",
];

const pick = <T extends string>(allowed: readonly T[], v: unknown, fallback: T): T =>
  allowed.find((a) => a === v) ?? fallback;
const text = (v: unknown, max: number) =>
  typeof v === "string" ? v.trim().replace(/\s+/g, " ").slice(0, max) : "";

/** Validates step drafts from a model. Unknown values fall back to safe defaults. */
export function parseStepDrafts(value: unknown): StepDraft[] | null {
  const raw = (value as { steps?: unknown } | null)?.steps;
  if (!Array.isArray(raw)) return null;
  const steps: StepDraft[] = [];
  for (const s of raw.slice(0, MAX_STEPS)) {
    if (typeof s !== "object" || s === null) continue;
    const r = s as Record<string, unknown>;
    const name = text(r.name, 70);
    if (!name) continue;
    steps.push({
      name,
      actorType: pick(ACTORS, r.actorType, "owner"),
      tools: Array.isArray(r.tools)
        ? r.tools
            .map((t) => text(t, 30))
            .filter(Boolean)
            .slice(0, 4)
        : [],
      inputFormat: pick(INPUTS, r.inputFormat, "message_text"),
      rekeying: r.rekeying === true,
      decisionType: pick(DECISIONS, r.decisionType, "guided_judgement"),
      impactFlags: Array.isArray(r.impactFlags)
        ? [...new Set(r.impactFlags.flatMap((f) => FLAGS.filter((x) => x === f)))]
        : [],
    });
  }
  return steps.length >= 1 ? steps : null;
}

const has = (s: string, words: string[]) => words.some((w) => new RegExp(`\\b${w}`, "i").test(s));

const TOOL_WORDS = [
  "gmail",
  "outlook",
  "excel",
  "google sheets",
  "sheets",
  "xero",
  "quickbooks",
  "exact",
  "sage",
  "hubspot",
  "pipedrive",
  "salesforce",
  "shopify",
  "stripe",
  "zendesk",
  "whatsapp",
  "slack",
  "teams",
  "calendar",
  "crm",
  "word",
  "pdf",
  "notion",
  "trello",
];

/** Drafts one step from a sentence with keyword rules. Used when no AI is available. */
export function draftStep(sentence: string): StepDraft {
  const s = sentence.toLowerCase();
  const inputFormat: InputFormat = has(s, ["call", "phone", "ring"])
    ? "phone_call"
    : has(s, ["paper", "print", "post", "photo", "scan", "receipt"])
      ? "paper_photo"
      : has(s, ["pdf", "invoice", "document", "attachment", "contract", "quote"])
        ? "document"
        : has(s, ["email", "mail", "message", "whatsapp", "chat", "text"])
          ? "message_text"
          : has(s, ["form", "booking"])
            ? "structured_form"
            : has(s, ["visit", "deliver", "drive", "install", "repair", "meet", "pack", "ship"])
              ? "in_person_physical"
              : "system_fields";
  const decisionType: DecisionType = has(s, ["decide", "judge", "assess", "negotiat", "review"])
    ? "experience_judgement"
    : has(s, ["check", "approve", "match", "verify", "compare", "price", "quote"])
      ? "guided_judgement"
      : has(s, ["if ", "when ", "rule"])
        ? "fixed_rule"
        : "none";
  const flags = new Set<ImpactFlag>();
  if (has(s, ["pay", "refund", "charge", "invoice", "transfer"])) flags.add("money");
  if (has(s, ["send", "reply", "email the", "call back", "tell the customer", "confirm"]))
    flags.add("external_message");
  if (has(s, ["book", "order", "cancel", "schedule", "agree"])) flags.add("commitment");
  if (has(s, ["delete", "remove", "overwrite"])) flags.add("destructive_write");
  if (has(s, ["customer", "client", "patient", "address", "name"])) flags.add("personal_data");
  if (has(s, ["medical", "health", "passport", "bank details", "salary"]))
    flags.add("sensitive_data");
  if (has(s, ["hire", "hiring", "candidate", "performance review", "credit check"]))
    flags.add("decision_about_person");
  const tools = TOOL_WORDS.filter((t) => s.includes(t)).slice(0, 3);
  return {
    name: sentence
      .trim()
      .replace(/[.;]+$/, "")
      .replace(/^(then|and|next|after that)\s+/i, "")
      .slice(0, 70),
    actorType: "owner",
    tools,
    inputFormat,
    rekeying: has(s, ["type", "copy", "enter", "re-enter", "paste", "fill in", "add it to"]),
    decisionType,
    impactFlags: [...flags],
  };
}

/** Splits a walk-through into steps: one per line, or per sentence / "then". */
export function draftStepsFromText(walkthrough: string): StepDraft[] {
  const lines = walkthrough
    .split(/\n+/)
    .map((l) => l.replace(/^\s*(\d+[.)]|[-*•])\s*/, "").trim())
    .filter(Boolean);
  const parts = (lines.length >= 2 ? lines : walkthrough.split(/(?<=[.!?])\s+|,?\s+then\s+|;\s*/i))
    .map((p) => p.trim())
    .filter((p) => p.split(/\s+/).length >= 2);
  return parts.slice(0, MAX_STEPS).map(draftStep);
}

let counter = 0;

/** A full step from a draft, with conservative defaults the owner then confirms. */
export function stepFromDraft(draft: StepDraft, id = `s${++counter}`): StepInput {
  const risky = draft.impactFlags.some((f) => f !== "personal_data");
  return {
    ...draft,
    id,
    actorRole: null,
    decisionRule: null,
    touchMinutes: null,
    waitBand: "none",
    firstPassOutOf10: null,
    moneyBand: null,
    reversibility: risky ? "effort" : "easy",
    keepHuman: false,
    confirmed: false,
  };
}
