import { AGENTS, type Agent } from "./catalogue";

const normalise = (text: string) =>
  ` ${text
    .toLowerCase()
    .replace(/[^a-z0-9\- ]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()} `;

function score(task: string, agent: Agent): number {
  const t = normalise(task);
  let total = 0;
  for (const word of agent.keywords)
    if (t.includes(` ${word} `)) total += word.includes(" ") ? 2 : 1;
  return total;
}

/** The catalogue agent closest to a visitor's task, or null when nothing matches. */
export function matchAgent(task: string): Agent | null {
  let best: Agent | null = null;
  let bestScore = 0;
  for (const agent of AGENTS) {
    const s = score(task, agent);
    if (s > bestScore) {
      best = agent;
      bestScore = s;
    }
  }
  return best;
}

/**
 * True when the task is short and clearly one catalogue agent's job ("answer our phones"),
 * so its ready-made workflow can be shown without calling an AI.
 */
export function isTemplateTask(task: string, agent: Agent): boolean {
  return task.trim().split(/\s+/).length <= 6 && score(task, agent) >= 1;
}
