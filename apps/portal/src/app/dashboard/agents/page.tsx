import { listAgents, listSwitches } from "@wyrm/core";
import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { requireTenant } from "@/lib/portal";
import { agentStatusAction } from "../actions";
import { Badge, Card, Empty, Notice, PageHeader, secondary } from "../ui";

export const metadata: Metadata = { title: "Agents" };

export default async function AgentsPage({ searchParams }: PageProps<"/dashboard/agents">) {
  const page = await requireTenant();
  const params = await searchParams;
  const [agents, switches] = await Promise.all([
    listAgents(page.ctx, page.tenantId),
    listSwitches(page.ctx, page.tenantId),
  ]);
  // One agent (the usual case): go straight to it.
  if (agents.length === 1 && agents[0]) redirect(`/dashboard/agents/${agents[0].agent.id}`);
  const pausedAll = switches.some((s) => s.scope === "tenant" || s.scope === "global");

  return (
    <section className="space-y-6">
      <PageHeader
        title="Agents"
        intro="Open an agent to change what it knows, test it and publish."
      />
      <Notice params={params} />
      {pausedAll && (
        <p role="status" className="rounded-xl border border-signal/60 bg-signal/10 p-3">
          All assistants are paused right now: customers are asked to leave a message.{" "}
          <Link href="/dashboard/settings" className="font-semibold text-ember">
            Settings
          </Link>
        </p>
      )}
      {agents.length === 0 ? (
        <Empty>No agents yet. Your Wyrm contact sets them up with you.</Empty>
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2">
          {agents.map(({ agent }) => {
            const autoPaused = switches.find((s) => s.scope === "agent" && s.agentId === agent.id);
            const canConfigure = page.can("agents.configure", agent.id);
            return (
              <li key={agent.id}>
                <Card className="flex h-full flex-col gap-3">
                  <div className="flex items-center justify-between gap-2">
                    <Link
                      href={`/dashboard/agents/${agent.id}`}
                      className="font-display text-xl font-semibold hover:text-ember"
                    >
                      {agent.name}
                    </Link>
                    <Badge tone={agent.status === "live" && !autoPaused ? "good" : "plain"}>
                      {autoPaused
                        ? "stopped"
                        : agent.status === "live"
                          ? "on"
                          : agent.status === "draft"
                            ? "not live yet"
                            : "paused"}
                    </Badge>
                  </div>
                  <p className="text-sm text-ink-muted">{agent.type.replace(/_/g, " ")}</p>
                  {autoPaused && (
                    <p className="text-sm text-signal">Stopped: {autoPaused.reason}</p>
                  )}
                  <div className="mt-auto flex flex-wrap gap-2">
                    <Link href={`/dashboard/agents/${agent.id}`} className={secondary}>
                      {canConfigure ? "Configure" : "Details"}
                    </Link>
                    {canConfigure && agent.status !== "draft" && (
                      <form action={agentStatusAction}>
                        <input type="hidden" name="back" value="/dashboard/agents" />
                        <input type="hidden" name="agentId" value={agent.id} />
                        <input
                          type="hidden"
                          name="status"
                          value={agent.status === "live" ? "paused" : "live"}
                        />
                        <button type="submit" className={secondary}>
                          {agent.status === "live" ? "Pause" : "Switch on"}
                        </button>
                      </form>
                    )}
                  </div>
                </Card>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
