#!/usr/bin/env node
// Mechanical checks that keep the repo legible to AI agents and safe to share.
// Each failure prints how to fix it. Add a check here whenever a mistake could repeat.
import { execFileSync } from "node:child_process";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const failures = [];
const fail = (message, fix) => failures.push(`✗ ${message}\n    fix: ${fix}`);
const read = (path) => readFileSync(join(root, path), "utf8");

// 1. Root AGENTS.md stays a short map, not a manual.
const MAX_ROOT_AGENTS_LINES = 60;
const rootLines = read("AGENTS.md").split("\n").length;
if (rootLines > MAX_ROOT_AGENTS_LINES) {
  fail(
    `AGENTS.md has ${rootLines} lines (max ${MAX_ROOT_AGENTS_LINES})`,
    "move detail into a nested AGENTS.md or docs/ and link to it",
  );
}

// 2. Every workspace with source code has its own AGENTS.md and a typecheck script.
const workspaces = ["apps", "packages"].flatMap((group) =>
  existsSync(join(root, group))
    ? readdirSync(join(root, group), { withFileTypes: true })
        .filter((d) => d.isDirectory())
        .map((d) => `${group}/${d.name}`)
    : [],
);
for (const ws of workspaces) {
  if (!existsSync(join(root, ws, "src"))) continue;
  if (!existsSync(join(root, ws, "AGENTS.md"))) {
    fail(`${ws} has source but no AGENTS.md`, `add ${ws}/AGENTS.md with its purpose and rules`);
  }
  const pkg = JSON.parse(read(`${ws}/package.json`));
  if (!pkg.scripts?.typecheck) {
    fail(`${ws}/package.json has no "typecheck" script`, 'add "typecheck": "tsc --noEmit"');
  }
}

// 3. File paths mentioned in AGENTS.md files must exist (catches stale maps).
const SKIP = /[<>…*]|node_modules|\.env|^https?:/;
const PATHLIKE = /^[\w.@-]+(\/[\w.@-]+)*\/?$/;
const agentsFiles = ["AGENTS.md", ...workspaces.map((ws) => `${ws}/AGENTS.md`)].filter((f) =>
  existsSync(join(root, f)),
);
for (const file of agentsFiles) {
  for (const [, ref] of read(file).matchAll(/`([^`\s]+)`/g)) {
    if (SKIP.test(ref) || !PATHLIKE.test(ref) || !/[/.]/.test(ref) || ref.startsWith("@")) continue;
    if (!/\.(md|ts|tsx|mjs|json|ya?ml|css)$/.test(ref) && !ref.endsWith("/")) continue;
    const local = join(root, dirname(file), ref);
    if (!existsSync(local) && !existsSync(join(root, ref))) {
      fail(`${file} references \`${ref}\`, which does not exist`, "fix the path or remove the reference");
    }
  }
}

// 4. No environment files with real values are tracked by git.
try {
  const tracked = execFileSync("git", ["ls-files"], {
    cwd: root,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "ignore"],
  }).split("\n");
  for (const file of tracked) {
    const name = file.split("/").pop() ?? "";
    if (/^\.env(\..+)?$/.test(name) && name !== ".env.example") {
      fail(`${file} is tracked by git`, `git rm --cached ${file} and keep secrets out of the repo`);
    }
  }
} catch {
  // Not a git checkout (for example a tarball); skip this check.
}

if (failures.length > 0) {
  console.error(`Harness check failed (${failures.length}):\n${failures.join("\n")}`);
  process.exit(1);
}
console.log(`Harness check passed (${agentsFiles.length} AGENTS.md files, ${workspaces.length} workspaces).`);
