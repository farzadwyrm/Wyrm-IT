#!/usr/bin/env node
// Claude Code "Stop" hook: before an agent says it is finished, run the fast checks.
// On failure it exits with code 2, which sends the output back to the agent to fix.
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";

let input = {};
try {
  input = JSON.parse(readFileSync(0, "utf8") || "{}");
} catch {
  // No or invalid hook payload: run the checks anyway.
}

// Avoid an endless loop if the agent is already responding to this hook.
if (input.stop_hook_active) process.exit(0);

const result = spawnSync("pnpm", ["-s", "verify:fast"], {
  encoding: "utf8",
  shell: process.platform === "win32",
});

if (result.status !== 0) {
  const output = `${result.stdout ?? ""}${result.stderr ?? ""}`.trim().split("\n").slice(-60).join("\n");
  process.stderr.write(`pnpm verify:fast failed. Fix these before finishing:\n${output}\n`);
  process.exit(2);
}
process.exit(0);
