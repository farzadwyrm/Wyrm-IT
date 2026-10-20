import type { Agent } from "@wyrm/agents";
import Link from "next/link";

/** Catalogue card: the whole card is one link. */
export function AgentCard({ agent, index }: { agent: Agent; index: number }) {
  return (
    <Link
      href={`/agents/${agent.slug}`}
      className="group flex h-full flex-col rounded-2xl border border-line bg-paper-raised/80 p-6 transition-colors hover:border-ember/60"
    >
      <span className="flex items-center justify-between font-mono text-xs text-ink-muted">
        <span>agent.{String(index + 1).padStart(2, "0")}</span>
        {agent.demo && (
          <span className="rounded-full border border-moss/40 px-2 py-0.5 text-moss">
            live demo
          </span>
        )}
      </span>
      <span className="mt-4 font-display text-xl font-semibold tracking-tight group-hover:text-ember-strong">
        {agent.name}
      </span>
      <span className="mt-2 flex-1 text-sm text-ink-muted">{agent.tagline}</span>
      <span className="mt-5 font-mono text-xs text-ember">
        {agent.workflow.steps.length} steps · {agent.workflow.integrations.length} integrations →
      </span>
    </Link>
  );
}
