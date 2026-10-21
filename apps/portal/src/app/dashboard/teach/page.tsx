import { listAgents } from "@wyrm/core";
import { redirect } from "next/navigation";
import { requireTenant } from "@/lib/portal";

/** Old address: answers now live on each agent (My agent → Answers). */
export default async function TeachPage({ searchParams }: PageProps<"/dashboard/teach">) {
  const page = await requireTenant();
  const params = await searchParams;
  const agents = await listAgents(page.ctx, page.tenantId);
  const wanted = typeof params.agent === "string" ? params.agent : "";
  const agent = agents.find((a) => a.agent.id === wanted) ?? agents[0];
  if (!agent) redirect("/dashboard");
  const topic = typeof params.topic === "string" ? params.topic.slice(0, 80) : "";
  redirect(
    `/dashboard/agents/${agent.agent.id}/answers${topic ? `?topic=${encodeURIComponent(topic)}#answer` : ""}`,
  );
}
