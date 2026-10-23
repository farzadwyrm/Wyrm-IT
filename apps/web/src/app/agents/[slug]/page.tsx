import { AGENTS, getAgent } from "@wyrm/agents";
import { ButtonLink } from "@wyrm/ui";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Container, CtaBand } from "@/components/sections";
import { WorkflowDiagram, WorkflowFacts } from "@/components/workflow-diagram";

// Only catalogue agents exist; anything else is a 404.
export const dynamicParams = false;

export function generateStaticParams() {
  return AGENTS.map((agent) => ({ slug: agent.slug }));
}

export async function generateMetadata({ params }: PageProps<"/agents/[slug]">): Promise<Metadata> {
  const agent = getAgent((await params).slug);
  if (!agent) return {};
  return { title: agent.name, description: agent.tagline };
}

export default async function AgentPage({ params }: PageProps<"/agents/[slug]">) {
  const agent = getAgent((await params).slug);
  if (!agent) notFound();

  return (
    <>
      <Container className="pt-12 sm:pt-16">
        <nav aria-label="Breadcrumb" className="text-sm">
          <Link href="/agents" className="text-ink-muted hover:text-ink">
            ← All agents
          </Link>
        </nav>
        <h1 className="mt-6 max-w-3xl font-display text-4xl font-semibold leading-[1.05] tracking-tight text-balance sm:text-6xl">
          {agent.name}
        </h1>
        <p className="mt-6 max-w-2xl text-lg text-ink-muted text-pretty">{agent.tagline}</p>
        <div className="mt-8 flex flex-wrap gap-3">
          {agent.demo && <ButtonLink href={agent.demo.href}>{agent.demo.label}</ButtonLink>}
          <ButtonLink href="/contact" variant={agent.demo ? "secondary" : "primary"}>
            Deploy this agent
          </ButtonLink>
        </div>
      </Container>

      <Container className="grid gap-12 py-16 lg:grid-cols-[1fr_1.1fr]">
        <section aria-labelledby="capabilities">
          <h2 id="capabilities" className="font-display text-2xl font-semibold">
            What it does
          </h2>
          <ul className="mt-6 space-y-3">
            {agent.capabilities.map((c) => (
              <li key={c} className="flex gap-3">
                <span aria-hidden="true" className="text-ember">
                  ✓
                </span>
                <span>{c}</span>
              </li>
            ))}
          </ul>
        </section>

        <section
          aria-labelledby="workflow"
          className="rounded-3xl border border-line bg-paper/60 p-5 sm:p-8"
        >
          <h2 id="workflow" className="font-display text-2xl font-semibold">
            How it works, step by step
          </h2>
          <div className="mt-6">
            <WorkflowDiagram workflow={agent.workflow} />
          </div>
          <div className="mt-8 border-t border-line pt-6">
            <WorkflowFacts workflow={agent.workflow} />
          </div>
        </section>
      </Container>

      <CtaBand />
    </>
  );
}
