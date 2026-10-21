import { listAgents, listCorrections, unansweredTopics } from "@wyrm/core";
import type { Metadata } from "next";
import Link from "next/link";
import { requireTenant, when } from "@/lib/portal";
import { retireAction, teachAction } from "../actions";
import { Badge, Card, Empty, input, Notice, PageHeader, primary } from "../ui";

export const metadata: Metadata = { title: "Teach" };

export default async function TeachPage({ searchParams }: PageProps<"/dashboard/teach">) {
  const page = await requireTenant();
  const params = await searchParams;
  const topic = typeof params.topic === "string" ? params.topic.slice(0, 80) : "";
  const preferredAgent = typeof params.agent === "string" ? params.agent : "";
  const [agents, corrections, topics] = await Promise.all([
    listAgents(page.ctx, page.tenantId),
    listCorrections(page.ctx, page.tenantId),
    unansweredTopics(page.ctx, page.tenantId),
  ]);
  const teachable = agents.filter(({ agent }) => page.can("agents.configure", agent.id));
  const back = "/dashboard/teach";
  const active = corrections.filter((c) => c.correction.status === "active");

  return (
    <section className="space-y-8">
      <PageHeader
        title="Teach"
        intro="Tell your agents the right answer in plain words. Each answer also becomes a test, so the agent keeps getting it right."
      />
      <Notice params={params} />

      {topics.length > 0 && (
        <Card>
          <h2 className="font-display text-xl font-semibold">Questions without a good answer</h2>
          <ul className="mt-3 flex flex-wrap gap-2">
            {topics.map((t) => (
              <li key={t.topic}>
                <Link
                  href={`/dashboard/teach?topic=${encodeURIComponent(t.topic)}${t.agentId ? `&agent=${t.agentId}` : ""}#answer`}
                  className="inline-flex min-h-11 items-center gap-2 rounded-full border border-line px-3 hover:border-ember"
                >
                  {t.topic} <Badge tone="warn">{t.n}</Badge>
                </Link>
              </li>
            ))}
          </ul>
        </Card>
      )}

      {teachable.length > 0 ? (
        <form
          id="answer"
          action={teachAction}
          className="space-y-3 rounded-2xl border border-line bg-paper-raised/60 p-5"
        >
          <h2 className="font-display text-xl font-semibold">Add an answer</h2>
          <input type="hidden" name="back" value={back} />
          <div className="grid gap-3 sm:grid-cols-2">
            <label>
              <span className="text-sm font-semibold">Agent</span>
              <select name="agentId" defaultValue={preferredAgent} className={input}>
                {teachable.map(({ agent }) => (
                  <option key={agent.id} value={agent.id}>
                    {agent.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              <span className="text-sm font-semibold">Topic</span>
              <input
                name="topic"
                defaultValue={topic}
                maxLength={80}
                className={input}
                placeholder="e.g. parking"
              />
            </label>
          </div>
          <label className="block">
            <span className="text-sm font-semibold">What customers ask</span>
            <input
              name="question"
              maxLength={1000}
              className={input}
              placeholder="e.g. Is there parking nearby?"
            />
          </label>
          <label className="block">
            <span className="text-sm font-semibold">The right answer</span>
            <textarea
              name="correctAnswer"
              required
              minLength={3}
              maxLength={2000}
              rows={3}
              className={input}
            />
          </label>
          <button type="submit" className={primary}>
            Save answer
          </button>
        </form>
      ) : (
        <Empty>Only people who manage an agent can teach it. Ask your owner or admin.</Empty>
      )}

      <div className="space-y-3">
        <h2 className="font-display text-xl font-semibold">Saved answers</h2>
        {active.length === 0 ? (
          <Empty>No saved answers yet.</Empty>
        ) : (
          <ul className="space-y-3">
            {active.map(({ correction: c, agentName }) => (
              <li key={c.id}>
                <Card>
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="font-semibold">{c.topic || "Answer"}</p>
                    <span className="text-sm text-ink-muted">
                      {agentName} · {when(c.createdAt)}{" "}
                      {c.testId && <Badge tone="good">has a test</Badge>}
                    </span>
                  </div>
                  <p className="mt-2 whitespace-pre-wrap">{c.correctAnswer}</p>
                  {page.can("agents.configure", c.agentId) && (
                    <form action={retireAction} className="mt-2">
                      <input type="hidden" name="back" value={back} />
                      <input type="hidden" name="correctionId" value={c.id} />
                      <button type="submit" className="text-sm text-ink-muted hover:text-ink">
                        Remove
                      </button>
                    </form>
                  )}
                </Card>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
