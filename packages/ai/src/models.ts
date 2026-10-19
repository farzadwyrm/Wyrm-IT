/**
 * Model choices live here so demos and client work switch models in one place.
 * Changing a model changes cost and quality: re-run the evals in `evals/` after any change.
 *
 * Owner's choice (2026-10-19): Claude Haiku 5.5 for the public demos, roughly €0.004 per
 * receptionist conversation. Claude Opus 5.5 ("claude-opus-5-5") is the higher-quality option
 * at about 40x the price.
 */
export const MODELS = {
  /** Written summary for the Readiness Scan. */
  readinessReport: "claude-haiku-5-5",
  /** The website's AI receptionist demo. */
  receptionist: "claude-haiku-5-5",
} as const;

export type ModelRole = keyof typeof MODELS;

/** US dollars per million tokens (prompts up to 100K tokens), from Anthropic's published prices. */
export const PRICES_PER_MILLION: Record<string, { input: number; output: number }> = {
  "claude-opus-5-5": { input: 4, output: 20 },
  "claude-sonnet-5-5": { input: 2, output: 10 },
  "claude-haiku-5-5": { input: 0.1, output: 0.5 },
};

/** Cost of one call in US cents. Unknown models are priced as Opus 5.5 to stay conservative. */
export function costInCents(model: string, inputTokens: number, outputTokens: number): number {
  const price = PRICES_PER_MILLION[model] ?? { input: 4, output: 20 };
  return ((inputTokens * price.input + outputTokens * price.output) / 1_000_000) * 100;
}
