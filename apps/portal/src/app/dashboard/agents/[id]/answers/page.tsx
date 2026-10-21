import { listCorrections, unansweredTopics } from "@wyrm/core";
import type { Metadata } from "next";
import Link from "next/link";
import { requireTenant, when } from "@/lib/portal";
import { retireAction, teachAction } from "../../../actions";
import { Badge, Card, Empty, input, Notice, primary } from "../../../ui";

export const metadata: Metadata = { title: "Answers" };

/** Answers: the right reply to questions customers ask. Each answer also becomes a test. */
export default async function AnswersPage({
  params,
  searchParams,
}: PageProps<"/dashboard/agents/[id]/answers">) {
  const page = await requireTenant();
  const { id } = await params;
  const query = await searchParams;
  const topic = typeof query.topic === "string" ? query.topic.slice(0, 80) : "";
  const [corrections, topics] = await Promise.all([
    listCorrections(page.ctx, page.tenantId),
    unansweredTopics(page.ctx, page.tenantId),
  ]);
  const canEdit = page.can("agents.configure", id) && !page.readOnly;
  const back = `/dashboard/agents/${id}/answers`;
  const saved = corrections.filter(
    (c) => c.correction.agentId === id && c.correction.status === "active",
  );
  const open = topics.filter((t) => t.agentId === id);

  return (
    <div className="space-y-6">
      <p className="max-w-2xl text-ink-muted">
        Tell your agent the right answer in plain words. It uses these straight away, and each one
        becomes a test so it keeps getting it right.
      </p>
      <Notice params={query} />

      {open.length > 0 && (
        <Card>
          <h2 className="font-display text-lg font-semibold">Questions it couldn't answer</h2>
          <ul className="mt-3 flex flex-wrap gap-2">
            {open.map((t) => (
              <li key={t.topic}>
                <Link
                  href={`${back}?topic=${encodeURIComponent(t.topic)}#answer`}
                  className="inline-flex min-h-11 items-center gap-2 rounded-full border border-line px-3 hover:border-ember"
                >
                  {t.topic} <Badge tone="warn">{t.n}</Badge>
                </Link>
              </li>
            ))}
          </ul>
        </Card>
      )}

      <div className="grid gap-6 xl:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
        {canEdit ? (
          <form
            id="answer"
            action={teachAction}
            className="space-y-3 self-start rounded-2xl border border-line bg-paper-raised/60 p-5"
          >
            <h2 className="font-display text-lg font-semibold">Add an answer</h2>
            <input type="hidden" name="back" value={back} />
            <input type="hidden" name="agentId" value={id} />
            <label className="block">
              <span className="text-sm font-semibold">Topic</span>
              <input
                name="topic"
                defaultValue={topic}
                maxLength={80}
                className={input}
                placeholder="e.g. parking"
              />
            </label>
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
                rows={4}
                className={input}
              />
            </label>
            <button type="submit" className={primary}>
              Save answer
            </button>
          </form>
        ) : (
          <Empty>Only people who manage this agent can add answers.</Empty>
        )}

        <div className="space-y-3">
          <h2 className="font-display text-lg font-semibold">
            Saved answers <span className="text-ink-muted">({saved.length})</span>
          </h2>
          {saved.length === 0 ? (
            <Empty>No saved answers yet.</Empty>
          ) : (
            <ul className="divide-y divide-line rounded-2xl border border-line">
              {saved.map(({ correction: c }) => (
                <li key={c.id} className="space-y-1 p-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="font-semibold">{c.topic || "Answer"}</p>
                    <span className="flex items-center gap-2 text-xs text-ink-muted">
                      {when(c.createdAt)}
                      {c.testId && <Badge tone="good">has a test</Badge>}
                    </span>
                  </div>
                  <p className="whitespace-pre-wrap text-sm">{c.correctAnswer}</p>
                  {canEdit && (
                    <form action={retireAction}>
                      <input type="hidden" name="back" value={back} />
                      <input type="hidden" name="correctionId" value={c.id} />
                      <button type="submit" className="text-sm text-ink-muted hover:text-ink">
                        Remove
                      </button>
                    </form>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
