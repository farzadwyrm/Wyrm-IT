/** The seven areas every question belongs to. Scores are reported per pillar. */
export const PILLARS = [
  "foundation",
  "identity",
  "devices",
  "network",
  "applications",
  "data",
  "visibility",
] as const;

export type Pillar = (typeof PILLARS)[number];

/** 1 = fix first (immediate risk) … 4 = advanced maturity. Drives finding order. */
export type Phase = 1 | 2 | 3 | 4;

export type Answer = "in_place" | "partial" | "gap" | "not_applicable";

export interface Question {
  /** Stable id, never reused once published (stored answers reference it). */
  id: string;
  pillar: Pillar;
  phase: Phase;
  /** 1–3. How much this item moves the pillar score. */
  weight: 1 | 2 | 3;
  prompt: string;
  /** Plain-language explanation shown when the answer is "gap" or "partial". */
  whyItMatters: string;
}

export type Answers = Readonly<Record<string, Answer>>;

export interface PillarScore {
  pillar: Pillar;
  /** 0–100, or null when every question in the pillar was not applicable / unanswered. */
  percent: number | null;
  answered: number;
}

export interface Finding {
  questionId: string;
  pillar: Pillar;
  phase: Phase;
  answer: "gap" | "partial";
  prompt: string;
  whyItMatters: string;
}

export interface AssessmentResult {
  overall: number | null;
  pillars: PillarScore[];
  /** Ordered: phase ascending, then gaps before partials, then weight descending. */
  findings: Finding[];
}
