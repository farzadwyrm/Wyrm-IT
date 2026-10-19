import { defineConfig } from "vitest/config";

/** Live evals against the real Claude API. Run with `pnpm eval` (needs ANTHROPIC_API_KEY). */
export default defineConfig({
  test: {
    include: ["evals/**/*.eval.ts"],
    testTimeout: 120_000,
  },
});
