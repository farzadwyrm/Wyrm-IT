import Link from "next/link";
import { getAccess } from "@/lib/auth";
import { MAIN_SITE } from "@/lib/config";

const TOOLS = [
  {
    title: "Workflow analysis",
    body: "Six quick questions about one task: see which steps AI can do and how many hours it frees up.",
    href: `${MAIN_SITE}/analyse`,
    cta: "Analyse a workflow",
  },
  {
    title: "Live voice agent",
    body: "Call or chat with a receptionist agent for a fictional clinic. It books only after a clear yes.",
    href: `${MAIN_SITE}/receptionist`,
    cta: "Try the voice agent",
  },
  {
    title: "Agent catalogue",
    body: "Twelve agents for customers, sales, operations, finance and your team, each with its workflow.",
    href: `${MAIN_SITE}/agents`,
    cta: "Browse agents",
  },
  {
    title: "Receptionist template",
    body: "The same agent set up for a hair salon from one settings file: how we tailor it to your business.",
    href: `${MAIN_SITE}/receptionist/bright-cuts-salon`,
    cta: "See the salon example",
  },
] as const;

/** Public platform home: every tool open without signing in; sign-in only for the client area. */
export default async function PlatformHome() {
  const access = await getAccess();

  return (
    <div className="space-y-14">
      <section>
        <p className="font-mono text-xs uppercase tracking-[0.2em] text-signal">wyrm ai platform</p>
        <h1 className="mt-3 max-w-2xl font-display text-4xl font-semibold tracking-tight text-balance sm:text-5xl">
          AI agents for your business, ready to try
        </h1>
        <p className="mt-4 max-w-2xl text-lg text-ink-muted">
          Everything here is open: analyse a workflow, talk to a live agent, browse the catalogue.
          Clients sign in to manage their own agents.
        </p>
      </section>

      <section aria-labelledby="tools">
        <h2 id="tools" className="font-display text-2xl font-semibold">
          Tools, no sign-in needed
        </h2>
        <ul className="mt-6 grid gap-4 sm:grid-cols-2">
          {TOOLS.map((tool) => (
            <li
              key={tool.title}
              className="flex flex-col rounded-2xl border border-line bg-paper-raised/80 p-6"
            >
              <h3 className="font-display text-xl font-semibold">{tool.title}</h3>
              <p className="mt-2 flex-1 text-sm text-ink-muted">{tool.body}</p>
              <a href={tool.href} className="mt-5 font-semibold text-ember hover:text-ember-strong">
                {tool.cta} →
              </a>
            </li>
          ))}
        </ul>
      </section>

      <section
        aria-labelledby="client-area"
        className="rounded-3xl border border-ember/30 bg-paper-raised p-6 sm:p-8"
      >
        <p className="font-mono text-xs uppercase tracking-[0.2em] text-signal">client area</p>
        <h2 id="client-area" className="mt-2 font-display text-2xl font-semibold">
          {access ? "You're signed in" : "Already a client?"}
        </h2>
        <p className="mt-2 max-w-xl text-ink-muted">
          {access
            ? "Go to your dashboard to see your business and agents."
            : "Sign in to see your agents, conversations and settings. Access is by invitation."}
        </p>
        <div className="mt-6 flex flex-wrap gap-3">
          <Link
            href={access ? "/dashboard" : "/login"}
            className="rounded-lg bg-ember px-5 py-2.5 font-semibold text-paper hover:bg-ember-strong"
          >
            {access ? "Open dashboard" : "Sign in"}
          </Link>
          {access?.isAdmin && (
            <Link
              href="/admin"
              className="rounded-lg border border-line px-5 py-2.5 font-semibold hover:border-ink-muted"
            >
              Manage clients
            </Link>
          )}
          {!access && (
            <a
              href={`${MAIN_SITE}/contact`}
              className="rounded-lg border border-line px-5 py-2.5 font-semibold hover:border-ink-muted"
            >
              Become a client
            </a>
          )}
        </div>
      </section>
    </div>
  );
}
