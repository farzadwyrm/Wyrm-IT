import { AGENTS, getAgent } from "@wyrm/agents";
import { ButtonLink } from "@wyrm/ui";
import Link from "next/link";
import { AgentCard } from "@/components/agent-card";
import { Container, CtaBand, SectionTitle } from "@/components/sections";
import { WorkflowDiagram } from "@/components/workflow-diagram";
import { DEMOS, USE_CASES } from "@/lib/site";

const HERO_AGENT = getAgent("inbox-agent") ?? AGENTS[0];

const PROCESS = [
  {
    title: "We talk",
    body: "You tell us which task eats your week. We look at how it's done today.",
  },
  {
    title: "We build and test",
    body: "We connect the agent to your tools and test it on your real cases.",
  },
  {
    title: "We run it for you",
    body: "We watch every run, fix what's off and report back each month.",
  },
];

export default function HomePage() {
  return (
    <>
      <Container className="grid items-center gap-12 pt-16 pb-20 sm:pt-24 lg:grid-cols-[1.1fr_1fr]">
        <div>
          <h1 className="font-display text-5xl font-semibold leading-[1.02] tracking-tight text-balance sm:text-7xl">
            AI agents that run your{" "}
            <span className="bg-gradient-to-r from-ember-strong via-ember to-signal bg-clip-text text-transparent">
              workflows
            </span>
            .
          </h1>
          <p className="mt-6 max-w-xl text-lg text-ink-muted text-pretty">
            We set up AI assistants that answer your phone, reply to emails and chase invoices, so
            your team can get on with the real work. You stay in control.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <ButtonLink href="/agents">See what we can automate</ButtonLink>
            <ButtonLink href="/receptionist" variant="secondary">
              Try the live demo
            </ButtonLink>
          </div>
        </div>

        {HERO_AGENT && (
          <figure className="rounded-3xl border border-line bg-paper-raised/70 shadow-[0_0_80px_-20px] shadow-ember/40">
            <figcaption className="border-b border-line px-5 py-3 text-sm text-ink-muted">
              Example: an email answered for you
            </figcaption>
            <div className="p-5 sm:p-6">
              <WorkflowDiagram workflow={HERO_AGENT.workflow} compact />
            </div>
          </figure>
        )}
      </Container>

      <section aria-labelledby="agents" className="border-t border-line">
        <Container className="py-20">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <SectionTitle id="agents" title="What our agents do" />
            <Link href="/agents" className="font-semibold text-ember hover:text-ember-strong">
              See all agents →
            </Link>
          </div>
          <ul className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {AGENTS.slice(0, 6).map((agent) => (
              <li key={agent.slug}>
                <AgentCard agent={agent} />
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
            title="Try it yourself"
            intro="Talk to an agent for a pretend business, or check one task of your own."
          />
          <ul className="mt-10 grid gap-4 md:grid-cols-3">
            {/* The task analysis has its own card below, with the search box. */}
            {DEMOS.filter(
              (demo) => demo.status === "live" && demo.href && demo.href !== "/analyse",
            ).map((demo) => (
              <li
                key={demo.slug}
                className="flex flex-col rounded-2xl border border-line bg-paper-raised/80 p-6"
              >
                <h3 className="font-display text-lg font-semibold">{demo.name}</h3>
                <p className="mt-2 flex-1 text-ink-muted">{demo.summary}</p>
                <Link
                  href={demo.href ?? "/receptionist"}
                  className="mt-5 font-semibold text-ember hover:text-ember-strong"
                >
                  Try it now →
                </Link>
              </li>
            ))}
            <li className="flex flex-col rounded-2xl border border-line bg-paper-raised/80 p-6">
              <h3 className="font-display text-lg font-semibold">Check one of your tasks</h3>
              <p className="mt-2 text-ink-muted">
                Name a task and get a free report on what to automate. About 15 minutes.
              </p>
              <search className="mt-5">
                <form
                  action="/analyse"
                  className="flex gap-2 rounded-xl border border-line bg-paper p-1.5 focus-within:border-ember/60"
                >
                  <label htmlFor="hero-task" className="sr-only">
                    Name a task to analyse
                  </label>
                  <input
                    id="hero-task"
                    name="q"
                    maxLength={600}
                    placeholder="e.g. Entering invoices"
                    className="min-w-0 flex-1 bg-transparent px-2 py-2 outline-none placeholder:text-ink-muted/60"
                  />
                  <button
                    type="submit"
                    className="rounded-lg bg-ember/15 px-3 py-2 text-sm font-semibold text-ember-strong hover:bg-ember/25"
                  >
                    Analyse
                  </button>
                </form>
              </search>
            </li>
          </ul>
        </Container>
      </section>

      <section aria-labelledby="use-cases" className="border-t border-line">
        <Container className="py-20">
          <SectionTitle id="use-cases" title="Where it helps most" />
          <ul className="mt-10 grid gap-4 md:grid-cols-3">
            {USE_CASES.map((useCase) => (
              <li
                key={useCase.sector}
                className="rounded-2xl border border-line bg-paper-raised/80 p-6"
              >
                <h3 className="font-display text-lg font-semibold">{useCase.sector}</h3>
                <p className="mt-2 text-ink-muted">{useCase.solution}</p>
              </li>
            ))}
          </ul>
        </Container>
      </section>

      <section aria-labelledby="process" className="border-t border-line">
        <Container className="py-20">
          <SectionTitle id="process" title="How it works" />
          <ol className="mt-10 grid gap-6 md:grid-cols-3">
            {PROCESS.map((p) => (
              <li key={p.title} className="border-t border-ember/50 pt-5">
                <p className="font-display text-lg font-semibold">{p.title}</p>
                <p className="mt-2 text-ink-muted">{p.body}</p>
              </li>
            ))}
          </ol>
        </Container>
      </section>

      <CtaBand />
    </>
  );
}
