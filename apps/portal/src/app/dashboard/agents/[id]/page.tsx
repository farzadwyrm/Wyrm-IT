import { listAgents } from "@wyrm/core";
import { notFound, redirect } from "next/navigation";
import { requireTenant } from "@/lib/portal";

/**
 * Opening an agent: a documents agent opens on Ask; a new customer-facing one at Go live (the
 * setup checklist), a running one at its facts.
 */
export default async function AgentPage({ params }: PageProps<"/dashboard/agents/[id]">) {
  const page = await requireTenant();
  const { id } = await params;
  const agent = (await listAgents(page.ctx, page.tenantId)).find((a) => a.agent.id === id)?.agent;
  if (!agent) notFound();
  const base = `/dashboard/agents/${agent.id}`;
  if (agent.type === "knowledge") redirect(`${base}/ask`);
  redirect(agent.status === "draft" ? `${base}/launch` : `${base}/studio?tab=facts`);
}
