import { knowledgeStats, listKnowledgeQuestions } from "@wyrm/core";
import type { Metadata } from "next";
import Link from "next/link";
import { requireTenant, when } from "@/lib/portal";
import { Badge, Empty } from "../../../ui";

export const metadata: Metadata = { title: "Questions" };

/** Questions: what staff asked, what the agent answered, and the gaps to fill with documents. */
export default async function QuestionsPage({
  params,
  searchParams,
}: PageProps<"/dashboard/agents/[id]/questions">) {
  const page = await requireTenant();
  const { id } = await params;
  const query = await searchParams;
  const gaps = query.show === "gaps";
  const [rows, stats] = await Promise.all([
    listKnowledgeQuestions(page.ctx, page.tenantId, id, { unanswered: gaps, limit: 100 }),
    knowledgeStats(page.ctx, page.tenantId, id),
  ]);
  const rate = stats.askedWeek ? Math.round((stats.answeredWeek / stats.askedWeek) * 100) : 0;
  const base = `/dashboard/agents/${id}/questions`;

  return (
    <div className="space-y-6">
      <ul className="grid grid-cols-3 gap-3">
        {[
          ["Asked this week", String(stats.askedWeek)],
          ["Found an answer", stats.askedWeek ? `${rate}%` : "–"],
          ["Marked wrong", String(stats.thumbsDownWeek)],
        ].map(([label, value]) => (
          <li key={label} className="rounded-2xl border border-line bg-paper-raised/80 p-3">
            <p className="text-xs text-ink-muted">{label}</p>
            <p className="mt-1 font-display text-2xl font-semibold">{value}</p>
          </li>
        ))}
      </ul>

      <nav aria-label="Filter questions" className="flex gap-1 border-b border-line">
        {[
          ["all", "All questions", base],
          ["gaps", "Not answered or marked wrong", `${base}?show=gaps`],
        ].map(([key, label, href]) => {
          const active = (key === "gaps") === gaps;
          return (
            <Link
              key={key}
              href={href as string}
              aria-current={active ? "page" : undefined}
              className={`inline-flex min-h-11 items-center border-b-2 px-3 text-sm font-semibold ${
                active ? "border-ember" : "border-transparent text-ink-muted hover:text-ink"
              }`}
            >
              {label}
            </Link>
          );
        })}
      </nav>

      {gaps && rows.length > 0 && (
        <p className="text-sm text-ink-muted">
          Each of these is a gap: add a document that answers it on the{" "}
          <Link href={`/dashboard/agents/${id}/documents`} className="text-ember">
            Documents
          </Link>{" "}
          tab.
        </p>
      )}

      {rows.length === 0 ? (
        <Empty>{gaps ? "No gaps. Every question found an answer." : "No questions yet."}</Empty>
      ) : (
        <ul className="divide-y divide-line rounded-2xl border border-line">
          {rows.map((q) => (
            <li key={q.id} className="space-y-1 p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="font-semibold">{q.question}</p>
                <span className="flex items-center gap-2 text-xs text-ink-muted">
                  {q.feedback === "down" && <Badge tone="bad">marked wrong</Badge>}
                  {q.feedback === "up" && <Badge tone="good">marked right</Badge>}
                  <Badge tone={q.answered ? "good" : "warn"}>
                    {q.answered ? "answered" : "not found"}
                  </Badge>
                  {when(q.createdAt)}
                </span>
              </div>
              <p className="line-clamp-3 whitespace-pre-wrap text-sm text-ink-muted">{q.answer}</p>
              {q.citations.length > 0 && (
                <p className="text-xs text-ink-muted">
                  From: {[...new Set(q.citations.map((c) => c.name))].join(", ")}
                </p>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
