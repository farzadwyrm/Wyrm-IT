/**
 * Model choices live here so demos and client work switch models in one place.
 * Changing a model changes cost and quality: re-run the evals in `evals/` after any change.
 *
 * Owner's choice (2026-10-19): Claude Haiku 5.5 for the public demos, roughly €0.004 per
 * receptionist conversation. Claude Opus 5.5 ("claude-opus-5-5") is the higher-quality option
 * at about 40x the price.
 */
export const MODELS = {
  /** The website's AI receptionist demo. */
  receptionist: "claude-haiku-5-5",
  /** The AI workflow planner: designs an agent workflow from a visitor's task. */
  planner: "claude-haiku-5-5",
} as const;

export type ModelRole = keyof typeof MODELS;

/** US dollars per million tokens (prompts up to 100K tokens), from Anthropic's published prices. */
export const PRICES_PER_MILLION: Record<string, { input: number; output: number }> = {
  "claude-opus-5-5": { input: 4, output: 20 },
  "claude-sonnet-5-5": { input: 2, output: 10 },
  "claude-haiku-5-5": { input: 0.1, output: 0.5 },
};

/** Token counts as reported in a response's `usage` (cache fields are optional). */
export interface TokenUsage {
  input_tokens: number;
  output_tokens: number;
  cache_creation_input_tokens?: number | null;
  cache_read_input_tokens?: number | null;
}

/**
 * Cost of one call in US cents, including prompt-cache writes (1.25x input price) and reads
 * (0.1x). Unknown models are priced as Opus 5.5 to stay conservative.
 */
export function costInCents(model: string, usage: TokenUsage): number {
  const price = PRICES_PER_MILLION[model] ?? { input: 4, output: 20 };
  const dollars =
    usage.input_tokens * price.input +
    (usage.cache_creation_input_tokens ?? 0) * price.input * 1.25 +
    (usage.cache_read_input_tokens ?? 0) * price.input * 0.1 +
    usage.output_tokens * price.output;
  return (dollars / 1_000_000) * 100;
}
