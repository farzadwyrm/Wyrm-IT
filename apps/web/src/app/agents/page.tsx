import { AGENTS } from "@wyrm/agents";
import type { Metadata } from "next";
import { AgentCard } from "@/components/agent-card";
import { Container, CtaBand, PageHeader } from "@/components/sections";

export const metadata: Metadata = {
  title: "AI agents",
  description:
    "The AI agents Wyrm deploys: voice, inbox, knowledge, sales, back-office and support agents, each with workflows, integrations and guardrails.",
};

export default function AgentsPage() {
  return (
    <>
      <PageHeader
        eyebrow="agents"
        title="Agents that do the work, with people in control"
        intro="Six agents we deploy most. Each one connects to the systems you already use, follows written guardrails and hands anything risky to a person."
      />
      <Container className="pb-8">
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {AGENTS.map((agent, i) => (
            <li key={agent.slug}>
              <AgentCard agent={agent} index={i} />
            </li>
          ))}
        </ul>
      </Container>
      <CtaBand />
    </>
  );
}
