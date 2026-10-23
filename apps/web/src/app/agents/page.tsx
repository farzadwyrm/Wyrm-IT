import { AGENTS, CATEGORIES } from "@wyrm/agents";
import type { Metadata } from "next";
import { AgentCard } from "@/components/agent-card";
import { Container, CtaBand, PageHeader } from "@/components/sections";

export const metadata: Metadata = {
  title: "AI agents",
  description:
    "Twelve AI agents Wyrm deploys for small and medium businesses: voice, inbox, support, reviews, sales, quotes, scheduling, invoices, payment reminders, reports, meeting notes and knowledge.",
};

export default function AgentsPage() {
  return (
    <>
      <PageHeader
        title="Pick a job to hand over"
        intro="Each agent does one job, works with the tools you already use, and asks a person before anything important."
      />
      <Container className="pb-4">
        <nav aria-label="Agent categories" className="flex flex-wrap gap-2">
          {CATEGORIES.map((c) => (
            <a
              key={c.id}
              href={`#${c.id}`}
              className="rounded-full border border-line px-3 py-1.5 text-sm text-ink-muted hover:border-ember/60 hover:text-ink"
            >
              {c.name}
            </a>
          ))}
        </nav>
      </Container>
      {CATEGORIES.map((category) => {
        const agents = AGENTS.filter((a) => a.category === category.id);
        return (
          <section
            key={category.id}
            id={category.id}
            aria-labelledby={`${category.id}-title`}
            className="scroll-mt-20"
          >
            <Container className="py-10">
              <h2 id={`${category.id}-title`} className="font-display text-2xl font-semibold">
                {category.name}
              </h2>
              <p className="mt-1 text-ink-muted">{category.intro}</p>
              <ul className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {agents.map((agent) => (
                  <li key={agent.slug}>
                    <AgentCard agent={agent} />
                  </li>
                ))}
              </ul>
            </Container>
          </section>
        );
      })}
      <CtaBand />
    </>
  );
}
