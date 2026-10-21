/** One word for where an agent stands, shared by the sidebar, Overview and My agent. */
export type AgentState = "live" | "paused" | "stopped" | "setup";

export const STATE: Record<
  AgentState,
  { label: string; dot: string; tone: "good" | "warn" | "bad" | "plain" }
> = {
  live: { label: "Live", dot: "bg-moss", tone: "good" },
  paused: { label: "Paused", dot: "bg-signal", tone: "warn" },
  stopped: { label: "Stopped", dot: "bg-node-output", tone: "bad" },
  setup: { label: "Setting up", dot: "bg-ink-muted", tone: "plain" },
};

/** `stopped` wins: an off switch (automatic or manual) overrides the agent's own status. */
export function agentState(status: string, stopped: boolean): AgentState {
  if (stopped) return "stopped";
  if (status === "live") return "live";
  if (status === "paused") return "paused";
  return "setup";
}
