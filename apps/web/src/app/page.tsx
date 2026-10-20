import { AGENTS, getAgent, STEP_KINDS, STEP_LABELS, type StepKind } from "@wyrm/agents";
import { ButtonLink } from "@wyrm/ui";
import Link from "next/link";
import { AgentCard } from "@/components/agent-card";
import { Container, CtaBand, Eyebrow, SectionTitle } from "@/components/sections";
import { WorkflowDiagram } from "@/components/workflow-diagram";
import { DEMOS, PRINCIPLES, USE_CASES } from "@/lib/site";

const HERO_AGENT = getAgent("inbox-agent") ?? AGENTS[0];

const KIND_COPY: Record<StepKind, string> = {
  trigger: "An email, call, form or file starts the run.",
  agent: "The AI reads, decides and drafts, within its rules.",
  tool: "It works in your calendar, inbox, CRM or accounting.",
  human: "A person approves anything that matters.",
  output: "The work is done, logged and measured.",
};

const PROCESS = [
  {
    step: "01",
    title: "Map",
    body: "We sit with the people who do the work and map one workflow end to end.",
  },
  {
    step: "02",
    title: "Design",
    body: "Agent steps, systems, guardrails and the numbers that define success.",
  },
  {
    step: "03",
    title: "Build & test",
    body: "Connected to your tools and tested on your real cases before go-live.",
  },
  {
    step: "04",
    title: "Run & improve",
    body: "We monitor every run, review accuracy monthly and add new skills.",
  },
];

export default function HomePage() {
  return (
    <>
      <Container className="grid items-center gap-12 pt-16 pb-20 sm:pt-24 lg:grid-cols-[1.1fr_1fr]">
        <div>
          <Eyebrow>ai agents · designed, deployed, managed</Eyebrow>
          <h1 className="mt-5 font-display text-5xl font-semibold leading-[1.02] tracking-tight text-balance sm:text-7xl">
            AI agents that run your{" "}
            <span className="bg-gradient-to-r from-ember-strong via-ember to-signal bg-clip-text text-transparent">
              workflows
            </span>
            .
          </h1>
          <p className="mt-6 max-w-xl text-lg text-ink-muted text-pretty">
            We build agents that answer calls, handle email, qualify leads, process invoices and
            support customers, connected to the tools you already use, with people in control of
            what matters.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <ButtonLink href="/analyse">Analyse a workflow</ButtonLink>
            <ButtonLink href="/agents" variant="secondary">
              See the agents
            </ButtonLink>
          </div>
          <search className="mt-8 max-w-xl">
            <form
              action="/analyse"
              className="flex gap-2 rounded-xl border border-line bg-paper-raised/80 p-1.5 focus-within:border-ember/60"
            >
              <label htmlFor="hero-task" className="sr-only">
                Name a task to analyse
              </label>
              <span aria-hidden="true" className="self-center pl-2 font-mono text-sm text-signal">
                &gt;
              </span>
              <input
                id="hero-task"
                name="q"
                maxLength={600}
                placeholder="e.g. Entering supplier invoices into Xero"
                className="min-w-0 flex-1 bg-transparent px-1 py-2 outline-none placeholder:text-ink-muted/60"
              />
              <button
                type="submit"
                className="rounded-lg bg-ember/15 px-3 py-2 text-sm font-semibold text-ember-strong hover:bg-ember/25"
              >
                Analyse
              </button>
            </form>
          </search>
        </div>

        {HERO_AGENT && (
          <div className="rounded-3xl border border-line bg-paper-raised/70 shadow-[0_0_80px_-20px] shadow-ember/40">
            <div className="flex items-center justify-between border-b border-line px-5 py-3 font-mono text-xs text-ink-muted">
              <span>
                agent.run(<span className="text-signal">"{HERO_AGENT.slug}"</span>)
              </span>
              <span className="flex items-center gap-1.5 text-moss">
                <span
                  aria-hidden="true"
                  className="size-1.5 rounded-full bg-moss motion-safe:animate-pulse"
                />
                live
              </span>
            </div>
            <div className="p-5 sm:p-6">
              <WorkflowDiagram workflow={HERO_AGENT.workflow} compact />
            </div>
          </div>
        )}
      </Container>

      <section aria-labelledby="anatomy" className="border-t border-line">
        <Container className="py-20">
          <SectionTitle
            id="anatomy"
            eyebrow="anatomy of an agent"
            title="Five building blocks behind every agent"
            intro="Every agent we deploy is a workflow you can read: what starts it, what the AI does, which systems it touches and where a person decides."
          />
          <ol className="mt-10 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
            {STEP_KINDS.map((kind, i) => (
              <li key={kind} className="rounded-2xl border border-line bg-paper-raised/80 p-5">
                <p className="font-mono text-xs text-ink-muted">0{i + 1}</p>
                <p className="mt-3 font-semibold">{STEP_LABELS[kind]}</p>
                <p className="mt-2 text-sm text-ink-muted">{KIND_COPY[kind]}</p>
              </li>
            ))}
          </ol>
        </Container>
      </section>

      <section aria-labelledby="agents" className="border-t border-line">
        <Container className="py-20">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <SectionTitle
              id="agents"
              eyebrow="agents"
              title="Agents for the work that eats your week"
            />
            <Link href="/agents" className="font-mono text-sm text-ember hover:text-ember-strong">
              all agents →
            </Link>
          </div>
          <ul className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {AGENTS.map((agent, i) => (
              <li key={agent.slug}>
                <AgentCard agent={agent} index={i} />
              </li>
            ))}
          </ul>
        </Container>
      </section>

      <section
        id="demos"
        aria-labelledby="demos-title"
        className="scroll-mt-20 border-t border-line"
      >
        <Container className="py-20">
          <SectionTitle
            id="demos-title"
            eyebrow="try it"
            title="Talk to an agent before you talk to us"
            intro="Live demos with a fictional business, so you can see exactly how an agent behaves."
          />
          <ul className="mt-10 grid gap-4 md:grid-cols-3">
            {DEMOS.map((demo) => (
              <li
                key={demo.slug}
                className="flex flex-col rounded-2xl border border-line bg-paper-raised/80 p-6"
              >
                <h3 className="font-display text-lg font-semibold">{demo.name}</h3>
                <p className="mt-2 flex-1 text-sm text-ink-muted">{demo.summary}</p>
                {demo.status === "live" && demo.href ? (
                  <Link
                    href={demo.href}
                    className="mt-5 font-semibold text-ember hover:text-ember-strong"
                  >
                    Try it now →
                  </Link>
                ) : (
                  <p className="mt-5 font-mono text-xs uppercase tracking-wider text-ink-muted">
                    coming soon
                  </p>
                )}
              </li>
            ))}
          </ul>
        </Container>
      </section>

      <section aria-labelledby="use-cases" className="border-t border-line">
        <Container className="py-20">
          <SectionTitle id="use-cases" eyebrow="use cases" title="Where agents pay off first" />
          <ul className="mt-10 grid gap-4 md:grid-cols-3">
            {USE_CASES.map((useCase) => (
              <li
                key={useCase.sector}
                className="rounded-2xl border border-line bg-paper-raised/80 p-6"
              >
                <h3 className="font-semibold">{useCase.sector}</h3>
                <p className="mt-3 text-sm text-ink-muted">
                  <span className="font-mono text-xs text-node-output">before </span>
                  {useCase.problem}
                </p>
                <p className="mt-2 text-sm text-ink-muted">
                  <span className="font-mono text-xs text-moss">after </span>
                  {useCase.solution}
                </p>
              </li>
            ))}
          </ul>
        </Container>
      </section>

      <section aria-labelledby="process" className="border-t border-line">
        <Container className="py-20">
          <SectionTitle
            id="process"
            eyebrow="deployment"
            title="From one workflow to agents running every day"
          />
          <ol className="mt-10 grid gap-4 md:grid-cols-4">
            {PROCESS.map((p) => (
              <li key={p.step} className="border-t border-ember/50 pt-5">
                <p className="font-mono text-sm text-ember">{p.step}</p>
                <p className="mt-2 font-display text-lg font-semibold">{p.title}</p>
                <p className="mt-2 text-sm text-ink-muted">{p.body}</p>
              </li>
            ))}
          </ol>
        </Container>
      </section>

      <section aria-labelledby="principles" className="border-t border-line">
        <Container className="py-20">
          <SectionTitle id="principles" eyebrow="principles" title="Autonomy with guardrails" />
          <dl className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {PRINCIPLES.map((principle) => (
              <div key={principle.title}>
                <dt className="font-semibold">{principle.title}</dt>
                <dd className="mt-2 text-sm text-ink-muted">{principle.body}</dd>
              </div>
            ))}
          </dl>
        </Container>
      </section>

      <CtaBand />
    </>
  );
}
