import { DomainError, getConversation } from "@wyrm/core";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  CHANNEL_LABELS,
  explainReason,
  money,
  OUTCOME_LABELS,
  PROVIDER_LABELS,
  requireTenant,
} from "@/lib/portal";
import { makeTestAction, resolveAction, teachAction } from "../../actions";
import { Badge, Card, input, Notice, primary, secondary } from "../../ui";

export const metadata: Metadata = { title: "Conversation" };

export default async function ConversationPage({
  params,
  searchParams,
}: PageProps<"/dashboard/conversations/[id]">) {
  const page = await requireTenant();
  const { id } = await params;
  const query = await searchParams;
  if (!/^[0-9a-f-]{36}$/.test(id)) notFound();
  let detail: Awaited<ReturnType<typeof getConversation>>;
  try {
    detail = await getConversation(page.ctx, page.tenantId, id);
  } catch (e) {
    if (e instanceof DomainError) notFound();
    throw e;
  }
  const { conversation: c, messages, decisions } = detail;
  const back = `/dashboard/conversations/${c.id}`;
  const canTeach = c.agentId ? page.can("agents.configure", c.agentId) : false;
  const canResolve = c.agentId ? page.can("agents.use", c.agentId) : false;
  const cost = decisions.reduce((sum, d) => sum + d.costMicros, 0);
  const lastQuestion = [...messages].reverse().find((m) => m.role === "customer")?.body ?? "";

  return (
    <section className="space-y-6">
      <Link href="/dashboard/inbox?view=all" className="text-sm text-ink-muted hover:text-ink">
        ← Inbox
      </Link>
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="font-display text-3xl font-semibold">{c.customerLabel || "Customer"}</h1>
        {c.outcome && <Badge>{OUTCOME_LABELS[c.outcome]}</Badge>}
        {c.flags.includes("needs_attention") && <Badge tone="warn">Needs attention</Badge>}
      </div>
      <p className="text-ink-muted">
        {CHANNEL_LABELS[c.channel]} ·{" "}
        {c.startedAt.toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" })}
        {c.aiDisclosed ? " · told the customer it's an AI" : ""} · AI cost {money(cost)}
      </p>
      <Notice params={query} />

      {c.summary && (
        <Card>
          <h2 className="text-sm font-semibold text-ink-muted">Summary</h2>
          <p className="mt-1">{c.summary}</p>
        </Card>
      )}

      <div className="grid gap-6 lg:grid-cols-[2fr_1fr]">
        <div className="space-y-3">
          <h2 className="font-display text-xl font-semibold">Transcript</h2>
          <ol className="space-y-3">
            {messages.map((m) => (
              <li
                key={m.id}
                className={`rounded-2xl border border-line p-3 ${m.role === "customer" ? "bg-paper" : "bg-paper-raised"}`}
              >
                <p className="text-xs font-semibold uppercase tracking-wider text-ink-muted">
                  {m.role === "customer"
                    ? "Customer"
                    : m.role === "agent"
                      ? "Agent"
                      : m.role === "staff"
                        ? "Your team"
                        : "System"}
                </p>
                <p className="mt-1 whitespace-pre-wrap">{m.body}</p>
                {m.role === "agent" && canTeach && (
                  <details className="mt-2">
                    <summary className="cursor-pointer text-sm font-semibold text-ember">
                      Fix this answer
                    </summary>
                    <form action={teachAction} className="mt-2 space-y-2">
                      <input type="hidden" name="back" value={back} />
                      <input type="hidden" name="agentId" value={c.agentId ?? ""} />
                      <input type="hidden" name="conversationId" value={c.id} />
                      <input type="hidden" name="messageId" value={m.id} />
                      <input type="hidden" name="wrongAnswer" value={m.body.slice(0, 2000)} />
                      <input type="hidden" name="question" value={lastQuestion.slice(0, 1000)} />
                      <label className="block">
                        <span className="text-sm font-semibold">What should it have said?</span>
                        <textarea
                          name="correctAnswer"
                          required
                          minLength={3}
                          maxLength={2000}
                          rows={3}
                          className={input}
                        />
                      </label>
                      <label className="block">
                        <span className="text-sm font-semibold">Topic (optional)</span>
                        <input
                          name="topic"
                          maxLength={80}
                          className={input}
                          placeholder="e.g. parking"
                        />
                      </label>
                      <button type="submit" className={primary}>
                        Save answer
                      </button>
                    </form>
                  </details>
                )}
              </li>
            ))}
          </ol>
        </div>

        <aside className="space-y-4">
          <Card>
            <h2 className="font-display text-lg font-semibold">Why it did this</h2>
            {decisions.length === 0 ? (
              <p className="mt-2 text-sm text-ink-muted">No decisions recorded.</p>
            ) : (
              <ol className="mt-2 space-y-3 text-sm">
                {decisions.map((d) => (
                  <li key={d.id}>
                    <p>{explainReason(d.reason)}</p>
                    <p className="text-xs text-ink-muted">
                      {PROVIDER_LABELS[d.provider ?? "code"]}
                      {d.confidence !== null
                        ? ` · ${Math.round(Number(d.confidence) * 100)}% sure`
                        : ""}
                      {d.guardrailFlags.length > 0 ? " · unusual request flagged" : ""}
                    </p>
                  </li>
                ))}
              </ol>
            )}
          </Card>
          {canResolve && c.flags.includes("needs_attention") && (
            <form action={resolveAction}>
              <input type="hidden" name="back" value={back} />
              <input type="hidden" name="conversationId" value={c.id} />
              <button type="submit" className={primary}>
                Mark as done
              </button>
            </form>
          )}
          {canTeach && (
            <details className="rounded-2xl border border-line p-4">
              <summary className="cursor-pointer font-semibold">Turn this into a test</summary>
              <form action={makeTestAction} className="mt-3 space-y-2">
                <input type="hidden" name="back" value={back} />
                <input type="hidden" name="conversationId" value={c.id} />
                <label className="block">
                  <span className="text-sm font-semibold">Name</span>
                  <input
                    name="name"
                    required
                    maxLength={120}
                    className={input}
                    defaultValue={c.topics[0] ?? "Saved conversation"}
                  />
                </label>
                <label className="block">
                  <span className="text-sm font-semibold">What should happen?</span>
                  <textarea
                    name="expectation"
                    rows={2}
                    maxLength={1000}
                    className={input}
                    placeholder="e.g. Offers the next free slot and books it"
                  />
                </label>
                <button type="submit" className={secondary}>
                  Save test
                </button>
              </form>
            </details>
          )}
        </aside>
      </div>
    </section>
  );
}
