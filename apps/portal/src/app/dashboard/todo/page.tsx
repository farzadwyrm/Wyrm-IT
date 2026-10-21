import { listApprovals, listConversations } from "@wyrm/core";
import type { Metadata } from "next";
import Link from "next/link";
import { CHANNEL_LABELS, OUTCOME_LABELS, requireTenant, when } from "@/lib/portal";
import { approveAction, resolveAction } from "../actions";
import { Badge, Card, Empty, input, Notice, PageHeader, primary, secondary } from "../ui";

export const metadata: Metadata = { title: "To-do" };

export default async function TodoPage({ searchParams }: PageProps<"/dashboard/todo">) {
  const page = await requireTenant();
  const params = await searchParams;
  const [approvals, attention] = await Promise.all([
    listApprovals(page.ctx, page.tenantId),
    listConversations(page.ctx, page.tenantId, { needsAttention: true, limit: 50 }),
  ]);
  const back = "/dashboard/todo";

  return (
    <section className="space-y-8">
      <PageHeader
        title="To-do"
        intro="Things your agents held back for you, and customers waiting for a person."
      />
      <Notice params={params} />

      <div className="space-y-3">
        <h2 className="font-display text-xl font-semibold">Waiting for your approval</h2>
        {approvals.length === 0 ? (
          <Empty>
            Nothing to approve. Agents ask here before risky actions like cancelling or sending a
            quote.
          </Empty>
        ) : (
          <ul className="space-y-3">
            {approvals.map(({ approval: a, agentName }) => {
              const canDecide = a.agentId ? page.can("agents.configure", a.agentId) : false;
              return (
                <li key={a.id}>
                  <Card>
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="font-semibold">{a.summary}</p>
                      <Badge tone={a.riskTier >= 3 ? "bad" : "warn"}>
                        {a.riskTier >= 3 ? "High risk" : "Needs approval"}
                      </Badge>
                    </div>
                    <p className="mt-1 text-sm text-ink-muted">
                      {agentName ?? "Agent"} · asked {when(a.requestedAt)} · expires{" "}
                      {a.expiresAt.toLocaleString("en-GB", {
                        dateStyle: "short",
                        timeStyle: "short",
                      })}
                      {a.conversationId && (
                        <>
                          {" · "}
                          <Link
                            href={`/dashboard/conversations/${a.conversationId}`}
                            className="text-ember"
                          >
                            see conversation
                          </Link>
                        </>
                      )}
                    </p>
                    {canDecide ? (
                      <form action={approveAction} className="mt-3 flex flex-wrap items-end gap-2">
                        <input type="hidden" name="back" value={back} />
                        <input type="hidden" name="approvalId" value={a.id} />
                        <label className="min-w-48 flex-1">
                          <span className="text-sm font-semibold">Reason (needed to reject)</span>
                          <input name="reason" maxLength={500} className={input} />
                        </label>
                        <button type="submit" name="decision" value="approve" className={primary}>
                          Approve
                        </button>
                        <button type="submit" name="decision" value="reject" className={secondary}>
                          Reject
                        </button>
                      </form>
                    ) : (
                      <p className="mt-3 text-sm text-ink-muted">
                        Someone who manages this agent needs to decide.
                      </p>
                    )}
                  </Card>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <div className="space-y-3">
        <h2 className="font-display text-xl font-semibold">Customers waiting for a person</h2>
        {attention.length === 0 ? (
          <Empty>No one is waiting. Handoffs and callback requests appear here.</Empty>
        ) : (
          <ul className="divide-y divide-line rounded-2xl border border-line">
            {attention.map(({ conversation: c, agentName }) => (
              <li
                key={c.id}
                className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between"
              >
                <Link
                  href={`/dashboard/conversations/${c.id}`}
                  className="min-w-0 hover:text-ember"
                >
                  <span className="font-semibold">{c.customerLabel || "Customer"}</span>
                  <span className="text-ink-muted">
                    {" "}
                    · {CHANNEL_LABELS[c.channel]} · {agentName ?? "No agent"} · {when(c.startedAt)}
                    {c.outcome ? ` · ${OUTCOME_LABELS[c.outcome]}` : ""}
                  </span>
                  {c.summary && (
                    <span className="block truncate text-sm text-ink-muted">{c.summary}</span>
                  )}
                </Link>
                {c.agentId && page.can("agents.use", c.agentId) && (
                  <form action={resolveAction}>
                    <input type="hidden" name="back" value={back} />
                    <input type="hidden" name="conversationId" value={c.id} />
                    <button type="submit" className={secondary}>
                      Mark as done
                    </button>
                  </form>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
