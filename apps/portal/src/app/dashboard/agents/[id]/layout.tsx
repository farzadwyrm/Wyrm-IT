import { getStudio, listAgents, listSwitches } from "@wyrm/core";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { requireTenant } from "@/lib/portal";
import { agentStatusAction } from "../../actions";
import { agentState, STATE } from "../../agent-state";
import { Badge, secondary } from "../../ui";
import { AgentTabs } from "./agent-tabs";

const TYPE_LABELS: Record<string, string> = {
  receptionist: "Receptionist",
  quote: "Quotes",
  support: "Support",
  sales: "Sales",
};

/** My agent: one header and one set of tabs for everything the customer can configure. */
export default async function AgentLayout({
  children,
  params,
}: LayoutProps<"/dashboard/agents/[id]">) {
  const page = await requireTenant();
  const { id } = await params;
  const all = await listAgents(page.ctx, page.tenantId);
  const agent = all.find((a) => a.agent.id === id)?.agent;
  if (!agent) notFound();
  const [switches, studio] = await Promise.all([
    listSwitches(page.ctx, page.tenantId),
    getStudio(page.ctx, page.tenantId, agent.id).catch(() => null),
  ]);
  const stopped = switches.some(
    (s) =>
      s.scope === "tenant" || s.scope === "global" || (s.scope === "agent" && s.agentId === id),
  );
  const state = agentState(agent.status, stopped);
  const canConfigure = page.can("agents.configure", agent.id) && !page.readOnly;
  const base = `/dashboard/agents/${agent.id}`;

  return (
    <section className="space-y-6">
      {all.length > 1 && (
        <Link href="/dashboard/agents" className="text-sm text-ink-muted hover:text-ink">
          ← All agents
        </Link>
      )}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="font-display text-3xl font-semibold tracking-tight">{agent.name}</h1>
          <Badge tone={STATE[state].tone}>{STATE[state].label}</Badge>
          <span className="text-sm text-ink-muted">
            {TYPE_LABELS[agent.type] ?? agent.type.replace(/_/g, " ")}
          </span>
        </div>
        {canConfigure &&
          (agent.status === "draft" ? (
            <Link href={`${base}/launch`} className={secondary}>
              Finish setup →
            </Link>
          ) : (
            <form action={agentStatusAction}>
              <input type="hidden" name="back" value={`${base}/launch`} />
              <input type="hidden" name="agentId" value={agent.id} />
              <input
                type="hidden"
                name="status"
                value={agent.status === "live" ? "paused" : "live"}
              />
              <button type="submit" className={secondary}>
                {agent.status === "live" ? "Pause agent" : "Switch back on"}
              </button>
            </form>
          ))}
      </div>
      <Suspense fallback={<div className="h-11 border-b border-line" />}>
        <AgentTabs agentId={agent.id} conflicts={studio?.conflicts.length ?? 0} />
      </Suspense>
      {children}
    </section>
  );
}
