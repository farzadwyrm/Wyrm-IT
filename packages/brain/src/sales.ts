import type { InfoField, Policy, Procedure } from "./studio";

/**
 * Sales agent setup (docs/plans/sales-agent.md): what the business sells, who is a good fit,
 * up to five qualifying questions, and how answers score. The model only collects answers; the
 * score and bucket are computed here in code, so a visitor can't talk their way to "hot".
 */

export type Rating = "great" | "ok" | "no";

export interface SalesOption {
  label: string;
  rating: Rating;
}

export interface SalesQuestion {
  /** Stable field key, e.g. "q_budget". */
  key: string;
  question: string;
  /** Choice questions score; open questions are only noted. */
  options: SalesOption[];
}

export interface SalesSetup {
  offer: string;
  idealCustomer: string;
  notFit: string;
  questions: SalesQuestion[];
  /** Points needed for "hot" (great = 2, ok = 1). */
  hotAt: number;
  /** What the agent says to visitors who are not a fit. */
  notFitMessage: string;
}

export type LeadBucket = "hot" | "warm" | "not_fit";

export const RATING_POINTS: Record<Rating, number> = { great: 2, ok: 1, no: 0 };
export const MAX_QUESTIONS = 5;
export const QUESTION_PREFIX = "q_";

export const DEFAULT_NOT_FIT =
  "Thanks for your interest. From what you've told me we may not be the right fit, but you're welcome to get in touch if things change.";

const clip = (v: unknown, max: number) => (typeof v === "string" ? v.trim().slice(0, max) : "");
const slug = (text: string) =>
  text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 30);

/** Cleans a setup from a form or a stored snapshot. Never throws. */
export function cleanSales(input: unknown): SalesSetup {
  const s = (input ?? {}) as Record<string, unknown>;
  const used = new Set<string>();
  const questions = (Array.isArray(s.questions) ? s.questions : [])
    .map((raw) => {
      const q = (raw ?? {}) as Record<string, unknown>;
      const question = clip(q.question, 200);
      if (!question) return null;
      let key = `${QUESTION_PREFIX}${slug(clip(q.key, 40).replace(/^q_/, "") || question) || "question"}`;
      while (used.has(key)) key = `${key}_2`;
      used.add(key);
      const options = (Array.isArray(q.options) ? q.options : [])
        .map((rawOption) => {
          const o = (rawOption ?? {}) as Record<string, unknown>;
          const label = clip(o.label, 80);
          const rating: Rating = o.rating === "great" || o.rating === "no" ? o.rating : "ok";
          return label ? { label, rating } : null;
        })
        .filter((o): o is SalesOption => o !== null)
        .slice(0, 6);
      return { key, question, options };
    })
    .filter((q): q is SalesQuestion => q !== null)
    .slice(0, MAX_QUESTIONS);
  const max = questions.reduce((sum, q) => sum + (q.options.length ? RATING_POINTS.great : 0), 0);
  const hotAt = Math.round(Number(s.hotAt));
  return {
    offer: clip(s.offer, 1000),
    idealCustomer: clip(s.idealCustomer, 600),
    notFit: clip(s.notFit, 600),
    questions,
    hotAt:
      Number.isFinite(hotAt) && hotAt > 0 ? Math.min(hotAt, Math.max(max, 1)) : Math.max(max, 1),
    notFitMessage: clip(s.notFitMessage, 400) || DEFAULT_NOT_FIT,
  };
}

/** The qualifying questions as fields the agent collects. */
export function salesFields(setup: SalesSetup): InfoField[] {
  return setup.questions.map((q) => ({
    key: q.key,
    label: q.question,
    type: q.options.length ? ("choice" as const) : ("text" as const),
    ...(q.options.length ? { options: q.options.map((o) => o.label) } : {}),
  }));
}

/** Adds the current questions to the qualify procedure (idempotent: old question fields go). */
export function withSalesQuestions(policy: Policy): Policy {
  if (!policy.sales) return policy;
  const fields = salesFields(policy.sales);
  const expand = (p: Procedure): Procedure =>
    p.template === "qualify"
      ? {
          ...p,
          requiredInfo: [
            ...p.requiredInfo.filter((f) => !f.key.startsWith(QUESTION_PREFIX)),
            ...fields,
          ],
        }
      : p;
  return { ...policy, procedures: policy.procedures.map(expand) };
}

const norm = (text: string) =>
  text
    .toLowerCase()
    .replace(/[^a-z0-9€$£]+/g, " ")
    .trim();

/** The option an answer refers to: exact, then contained either way. */
export function matchOption(question: SalesQuestion, answer: string): SalesOption | null {
  const a = norm(answer);
  if (!a) return null;
  return (
    question.options.find((o) => norm(o.label) === a) ??
    question.options.find((o) => a.includes(norm(o.label)) || norm(o.label).includes(a)) ??
    null
  );
}

export interface LeadScore {
  score: number;
  bucket: LeadBucket;
  /** Plain-language reasons, shown to the team with the lead. */
  reasons: string[];
}

/** Scores collected answers. Any "no" answer makes the lead not a fit. */
export function scoreLead(setup: SalesSetup, answers: Record<string, string>): LeadScore {
  let score = 0;
  let disqualified = false;
  const reasons: string[] = [];
  for (const q of setup.questions) {
    if (!q.options.length) continue;
    const answer = answers[q.key] ?? "";
    const option = matchOption(q, answer);
    if (!option) {
      reasons.push(`${q.question}: "${answer.slice(0, 60)}" did not match an option`);
      continue;
    }
    score += RATING_POINTS[option.rating];
    if (option.rating === "no") disqualified = true;
    reasons.push(
      `${q.question}: ${option.label} (${option.rating === "no" ? "not a fit" : option.rating})`,
    );
  }
  const bucket: LeadBucket = disqualified ? "not_fit" : score >= setup.hotAt ? "hot" : "warm";
  return { score, bucket, reasons };
}

/** Text for the model while it qualifies: the offer, the fit, and the exact answer options. */
export function salesInstructions(setup: SalesSetup): string {
  const lines = [
    `SALES: You help potential customers and find out whether they are a good fit. Ask the qualifying questions naturally, one or two at a time, and answer their questions from the facts. Never promise prices, discounts, delivery dates or contract terms that are not in the facts. Never tell the customer how they scored.`,
  ];
  if (setup.offer) lines.push(`What we sell: ${setup.offer}`);
  if (setup.idealCustomer) lines.push(`A good fit: ${setup.idealCustomer}`);
  if (setup.notFit) lines.push(`Not a fit: ${setup.notFit}`);
  const choices = setup.questions.filter((q) => q.options.length);
  if (choices.length)
    lines.push(
      `For these fields write exactly one of the listed options, the closest to what the customer said: ${choices
        .map((q) => `${q.key} = ${q.options.map((o) => `"${o.label}"`).join(" | ")}`)
        .join("; ")}.`,
    );
  return lines.join("\n");
}
