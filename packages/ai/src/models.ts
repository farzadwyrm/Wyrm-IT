/**
 * Model choices live here so demos and client work switch models in one place.
 * Changing a model changes cost and quality: re-run the evals in `evals/` after any change.
 */
export const MODELS = {
  /**
   * Written summary for the Readiness Scan. Claude Opus 5.5 at low effort.
   * Cheaper option (owner's call): "claude-haiku-5-5" costs about 40x less per token.
   */
  readinessReport: "claude-opus-5-5",
} as const;

export type ModelRole = keyof typeof MODELS;

/** US dollars per million tokens, from Anthropic's published prices. */
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
