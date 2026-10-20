import { AGENTS, getAgent } from "@wyrm/agents";
import { ButtonLink } from "@wyrm/ui";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Container, CtaBand, Eyebrow } from "@/components/sections";
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
        <nav aria-label="Breadcrumb" className="font-mono text-xs text-ink-muted">
          <Link href="/agents" className="text-signal hover:text-ink">
            agents
          </Link>
          <span aria-hidden="true"> / </span>
          <span>{agent.slug}</span>
        </nav>
        <h1 className="mt-6 max-w-3xl font-display text-4xl font-semibold leading-[1.05] tracking-tight text-balance sm:text-6xl">
          {agent.name}
        </h1>
        <p className="mt-6 max-w-2xl text-lg text-ink-muted text-pretty">{agent.summary}</p>
        <div className="mt-8 flex flex-wrap gap-3">
          {agent.demo && <ButtonLink href={agent.demo.href}>{agent.demo.label}</ButtonLink>}
          <ButtonLink href="/contact" variant={agent.demo ? "secondary" : "primary"}>
            Deploy this agent
          </ButtonLink>
        </div>
      </Container>

      <Container className="grid gap-12 py-16 lg:grid-cols-[1fr_1.1fr]">
        <section aria-labelledby="capabilities">
          <Eyebrow>capabilities</Eyebrow>
          <h2 id="capabilities" className="mt-3 font-display text-2xl font-semibold">
            What it does
          </h2>
          <ul className="mt-6 space-y-3">
            {agent.capabilities.map((c) => (
              <li key={c} className="flex gap-3">
                <span aria-hidden="true" className="mt-1 font-mono text-xs text-ember">
                  →
                </span>
                <span>{c}</span>
              </li>
            ))}
          </ul>

          <h2 className="mt-12 font-display text-2xl font-semibold">What we measure</h2>
          <ul className="mt-4 grid grid-cols-2 gap-3">
            {agent.measures.map((m) => (
              <li
                key={m}
                className="rounded-xl border border-line bg-paper-raised/80 px-3 py-3 font-mono text-xs text-ink-muted"
              >
                {m}
              </li>
            ))}
          </ul>
        </section>

        <section
          aria-labelledby="workflow"
          className="rounded-3xl border border-line bg-paper/60 p-5 sm:p-8"
        >
          <Eyebrow>workflow</Eyebrow>
          <h2 id="workflow" className="mt-3 font-display text-2xl font-semibold">
            {agent.workflow.title}
          </h2>
          <div className="mt-6">
            <WorkflowDiagram workflow={agent.workflow} />
          </div>
          <div className="mt-8 border-t border-line pt-6">
            <WorkflowFacts workflow={agent.workflow} />
          </div>
        </section>
      </Container>

      <Container>
        <p className="text-ink-muted">
          Your process is different?{" "}
          <Link href="/analyse" className="font-semibold text-ember hover:text-ember-strong">
            Analyse your own workflow step by step →
          </Link>
        </p>
      </Container>
      <CtaBand />
    </>
  );
}
