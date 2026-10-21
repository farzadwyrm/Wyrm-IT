import { listAgents } from "@wyrm/core";
import { notFound, redirect } from "next/navigation";
import { requireTenant } from "@/lib/portal";

/** Opening an agent: a new one starts at Go live (the setup checklist), a running one at its facts. */
export default async function AgentPage({ params }: PageProps<"/dashboard/agents/[id]">) {
  const page = await requireTenant();
  const { id } = await params;
  const agent = (await listAgents(page.ctx, page.tenantId)).find((a) => a.agent.id === id)?.agent;
  if (!agent) notFound();
  redirect(
    agent.status === "draft"
      ? `/dashboard/agents/${agent.id}/launch`
      : `/dashboard/agents/${agent.id}/studio?tab=facts`,
  );
}
