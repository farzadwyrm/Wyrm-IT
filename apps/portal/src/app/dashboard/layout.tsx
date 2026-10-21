import { homeMetrics, listAgents, listSwitches } from "@wyrm/core";
import type { ReactNode } from "react";
import { coreContext, getAccess } from "@/lib/auth";
import { endViewAsAction } from "../admin/actions";
import { agentState } from "./agent-state";
import { DashboardNav, type NavAgent } from "./nav";

/**
 * Client-area frame: sidebar (Overview, Inbox, My agent, Settings) for customer staff. Every page
 * still checks access itself (`requireTenant`), since layouts are not a security boundary.
 */
export default async function DashboardLayout({ children }: { children: ReactNode }) {
  const access = await getAccess();
  const actor = access?.actor;
  const me = actor?.kind === "tenant" ? actor : actor?.kind === "impersonating" ? actor.as : null;
  let waiting = 0;
  let agents: NavAgent[] = [];
  const business =
    (me && access?.tenants.find((t) => t.tenantId === me.tenantId)?.name) || "Your business";
  if (access && me) {
    try {
      const ctx = await coreContext(access);
      const [home, list, switches] = await Promise.all([
        homeMetrics(ctx, me.tenantId),
        listAgents(ctx, me.tenantId),
        listSwitches(ctx, me.tenantId),
      ]);
      waiting = home.needsAttention;
      const all = switches.some((s) => s.scope === "tenant" || s.scope === "global");
      agents = list.map(({ agent }) => ({
        id: agent.id,
        name: agent.name,
        state: agentState(
          agent.status,
          all || switches.some((s) => s.scope === "agent" && s.agentId === agent.id),
        ),
      }));
    } catch {
      waiting = 0;
    }
  }
  return (
    <div className="space-y-6">
      {actor?.kind === "impersonating" && (
        <p role="status" className="rounded-xl border border-signal/60 bg-signal/10 p-3 text-sm">
          Wyrm staff view{actor.readOnly ? " (view only)" : ""}: you're seeing the portal as this
          client's team member. The session is logged in their activity log and ends at{" "}
          {actor.expiresAt.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}.{" "}
          <button type="submit" form="end-view-as" className="font-semibold text-ember underline">
            End now
          </button>
        </p>
      )}
      {actor?.kind === "impersonating" && <form id="end-view-as" action={endViewAsAction} />}
      {me ? (
        <div className="grid gap-6 lg:grid-cols-[13rem_minmax(0,1fr)] lg:gap-10">
          <DashboardNav business={business} waiting={waiting} agents={agents} />
          <div className="min-w-0">{children}</div>
        </div>
      ) : (
        children
      )}
    </div>
  );
}
