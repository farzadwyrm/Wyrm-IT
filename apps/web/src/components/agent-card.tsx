import type { Agent } from "@wyrm/agents";
import Link from "next/link";

/** Catalogue card: name, one-line outcome, one link. The whole card is the link. */
export function AgentCard({ agent }: { agent: Agent }) {
  return (
    <Link
      href={`/agents/${agent.slug}`}
      className="group flex h-full flex-col rounded-2xl border border-line bg-paper-raised/80 p-6 transition-colors hover:border-ember/60"
    >
      <span className="flex flex-wrap items-center gap-2">
        <span className="font-display text-xl font-semibold tracking-tight group-hover:text-ember-strong">
          {agent.name}
        </span>
        {agent.demo && (
          <span className="rounded-full bg-moss/15 px-2 py-0.5 text-xs font-medium text-moss">
            Try it live
          </span>
        )}
      </span>
      <span className="mt-2 flex-1 text-ink-muted">{agent.tagline}</span>
      <span className="mt-5 text-sm font-semibold text-ember">See how it works →</span>
    </Link>
  );
}
