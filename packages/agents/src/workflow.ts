/** One step in an agent workflow, drawn as a node in the diagram. */
export type StepKind = "trigger" | "agent" | "tool" | "human" | "output";

export const STEP_KINDS: readonly StepKind[] = ["trigger", "agent", "tool", "human", "output"];

export const STEP_LABELS: Record<StepKind, string> = {
  trigger: "Trigger",
  agent: "AI agent",
  tool: "System",
  human: "Human check",
  output: "Result",
};

export interface Step {
  kind: StepKind;
  /** Short, e.g. "Classify the email". */
  label: string;
  /** One sentence. */
  detail: string;
}

export interface Workflow {
  title: string;
  steps: Step[];
  /** Systems the agent connects to, e.g. "Gmail", "HubSpot". */
  integrations: string[];
  /** What the agent may never do on its own, and other limits. */
  guardrails: string[];
}

const MAX_STEPS = 9;
const text = (v: unknown, max: number) =>
  typeof v === "string" && v.trim() ? v.trim().replace(/\s+/g, " ").slice(0, max) : null;
const list = (v: unknown, maxItems: number, maxLen: number) =>
  Array.isArray(v) ? v.flatMap((x) => text(x, maxLen) ?? []).slice(0, maxItems) : [];

/**
 * Checks a workflow that came from a model. Returns null unless it has a title, 3-9 steps of
 * known kinds, starts with a trigger and includes at least one AI agent step.
 */
export function parseWorkflow(value: unknown): Workflow | null {
  if (typeof value !== "object" || value === null) return null;
  const v = value as Record<string, unknown>;
  const title = text(v.title, 80);
  if (!title || !Array.isArray(v.steps)) return null;
  const steps: Step[] = [];
  for (const raw of v.steps.slice(0, MAX_STEPS)) {
    if (typeof raw !== "object" || raw === null) return null;
    const s = raw as Record<string, unknown>;
    const kind = STEP_KINDS.find((k) => k === s.kind);
    const label = text(s.label, 60);
    if (!kind || !label) return null;
    steps.push({ kind, label, detail: text(s.detail, 200) ?? "" });
  }
  if (steps.length < 3 || steps[0]?.kind !== "trigger") return null;
  if (!steps.some((s) => s.kind === "agent")) return null;
  return {
    title,
    steps,
    integrations: list(v.integrations, 8, 40),
    guardrails: list(v.guardrails, 5, 160),
  };
}

/** Pulls the first JSON object out of a model reply (tolerates code fences and chatter). */
export function extractJson(reply: string): unknown {
  const start = reply.indexOf("{");
  const end = reply.lastIndexOf("}");
  if (start < 0 || end <= start) return null;
  try {
    return JSON.parse(reply.slice(start, end + 1));
  } catch {
    return null;
  }
}
