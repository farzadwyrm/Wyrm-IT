import { defineConfig } from "vitest/config";

// The tests build a real Postgres (PGlite) and run every migration; CI machines need longer.
export default defineConfig({ test: { hookTimeout: 120_000, testTimeout: 30_000 } });
