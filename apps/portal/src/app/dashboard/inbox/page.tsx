import { homeMetrics, listAgents, listApprovals, listConversations } from "@wyrm/core";
import type { Metadata } from "next";
import Link from "next/link";
import { CHANNEL_LABELS, OUTCOME_LABELS, requireTenant, type TenantPage, when } from "@/lib/portal";
import { approveAction, resolveAction } from "../actions";
import {
  Badge,
  Card,
  Empty,
  input,
  Notice,
  outcomeTone,
  PageHeader,
  primary,
  secondary,
} from "../ui";

export const metadata: Metadata = { title: "Inbox" };

const PAGE = 25;
const OUTCOMES = Object.keys(OUTCOME_LABELS);
const CHANNELS = Object.keys(CHANNEL_LABELS);

/** Inbox: what needs a person (approvals, handoffs) and every conversation, in one place. */
export default async function InboxPage({ searchParams }: PageProps<"/dashboard/inbox">) {
  const page = await requireTenant();
  const params = await searchParams;
  const str = (k: string) => (typeof params[k] === "string" ? (params[k] as string) : "");
  const view = str("view") === "all" ? "all" : "needs";
  const home = await homeMetrics(page.ctx, page.tenantId);

  const tabs = [
    { key: "needs", label: "Needs you", count: home.needsAttention },
    { key: "all", label: "All conversations", count: 0 },
  ];

  return (
    <section className="space-y-6">
      <PageHeader
        title="Inbox"
        intro="Customers waiting for a person, actions waiting for your OK, and every conversation your agent had."
      />
      <Notice params={params} />
      <nav aria-label="Inbox views" className="flex gap-1 border-b border-line">
        {tabs.map((t) => (
          <Link
            key={t.key}
            href={`/dashboard/inbox?view=${t.key}`}
            aria-current={view === t.key ? "page" : undefined}
            className={`inline-flex min-h-11 items-center gap-2 border-b-2 px-3 text-sm font-semibold ${
              view === t.key ? "border-ember" : "border-transparent text-ink-muted hover:text-ink"
            }`}
          >
            {t.label}
            {t.count > 0 && (
              <span className="rounded-full bg-ember px-2 py-0.5 text-xs text-paper">
                {t.count}
              </span>
            )}
          </Link>
        ))}
      </nav>
      {view === "needs" ? <NeedsYou page={page} /> : <AllConversations page={page} str={str} />}
    </section>
  );
}

async function NeedsYou({ page }: { page: TenantPage }) {
  const [approvals, attention] = await Promise.all([
    listApprovals(page.ctx, page.tenantId),
    listConversations(page.ctx, page.tenantId, { needsAttention: true, limit: 50 }),
  ]);
  const back = "/dashboard/inbox";
  if (approvals.length === 0 && attention.length === 0)
    return (
      <Empty>
        Nothing needs you. When a customer asks for a person, or the agent wants your OK before
        something risky (like cancelling or quoting), it appears here.
      </Empty>
    );
  return (
    <div className="space-y-8">
      {approvals.length > 0 && (
        <div className="space-y-3">
          <h2 className="font-display text-xl font-semibold">Waiting for your OK</h2>
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
        </div>
      )}
      {attention.length > 0 && (
        <div className="space-y-3">
          <h2 className="font-display text-xl font-semibold">Customers waiting for a person</h2>
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
        </div>
      )}
    </div>
  );
}

async function AllConversations({ page, str }: { page: TenantPage; str: (k: string) => string }) {
  const outcome = OUTCOMES.includes(str("outcome")) ? str("outcome") : "";
  const channel = CHANNELS.includes(str("channel")) ? str("channel") : "";
  const agentId = /^[0-9a-f-]{36}$/.test(str("agent")) ? str("agent") : "";
  const search = str("q").slice(0, 80);
  const pageNo = Math.max(0, Number.parseInt(str("page") || "0", 10) || 0);
  const [rows, agents] = await Promise.all([
    listConversations(page.ctx, page.tenantId, {
      ...(outcome ? { outcome: outcome as "booked" } : {}),
      ...(channel ? { channel: channel as "voice" } : {}),
      ...(agentId ? { agentId } : {}),
      ...(search ? { search } : {}),
      limit: PAGE + 1,
      offset: pageNo * PAGE,
    }),
    listAgents(page.ctx, page.tenantId),
  ]);
  const more = rows.length > PAGE;
  const link = (n: number) =>
    `/dashboard/inbox?${new URLSearchParams({
      view: "all",
      ...(outcome && { outcome }),
      ...(channel && { channel }),
      ...(agentId && { agent: agentId }),
      ...(search && { q: search }),
      page: String(n),
    }).toString()}`;
  const filtered = outcome || channel || agentId || search;

  return (
    <div className="space-y-4">
      <form
        className="flex flex-wrap items-end gap-2"
        aria-label="Filter conversations"
        action="/dashboard/inbox"
      >
        <input type="hidden" name="view" value="all" />
        <label className="min-w-48 flex-[2]">
          <span className="text-xs font-semibold text-ink-muted">Search</span>
          <input name="q" defaultValue={search} placeholder="Name or summary" className={input} />
        </label>
        <label className="min-w-36 flex-1">
          <span className="text-xs font-semibold text-ink-muted">Result</span>
          <select name="outcome" defaultValue={outcome} className={input}>
            <option value="">Any</option>
            {OUTCOMES.map((o) => (
              <option key={o} value={o}>
                {OUTCOME_LABELS[o]}
              </option>
            ))}
          </select>
        </label>
        {agents.length > 1 && (
          <label className="min-w-36 flex-1">
            <span className="text-xs font-semibold text-ink-muted">Agent</span>
            <select name="agent" defaultValue={agentId} className={input}>
              <option value="">All</option>
              {agents.map(({ agent }) => (
                <option key={agent.id} value={agent.id}>
                  {agent.name}
                </option>
              ))}
            </select>
          </label>
        )}
        <label className="min-w-36 flex-1">
          <span className="text-xs font-semibold text-ink-muted">Channel</span>
          <select name="channel" defaultValue={channel} className={input}>
            <option value="">All</option>
            {CHANNELS.map((c) => (
              <option key={c} value={c}>
                {CHANNEL_LABELS[c]}
              </option>
            ))}
          </select>
        </label>
        <button type="submit" className={secondary}>
          Filter
        </button>
        {filtered && (
          <Link
            href="/dashboard/inbox?view=all"
            className="inline-flex min-h-11 items-center px-2 text-sm text-ink-muted hover:text-ink"
          >
            Clear
          </Link>
        )}
      </form>

      {rows.length === 0 ? (
        <Empty>
          {filtered
            ? "No conversations match these filters."
            : "No conversations yet. When your agent talks to customers, they appear here."}
        </Empty>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-line">
          <table className="w-full min-w-[640px] text-left text-sm">
            <caption className="sr-only">Conversations, newest first</caption>
            <thead className="bg-paper-raised font-mono text-[11px] uppercase tracking-wider text-ink-muted">
              <tr>
                <th scope="col" className="px-4 py-3">
                  Customer
                </th>
                <th scope="col" className="px-4 py-3">
                  Summary
                </th>
                <th scope="col" className="px-4 py-3">
                  Channel
                </th>
                <th scope="col" className="px-4 py-3">
                  Result
                </th>
                <th scope="col" className="px-4 py-3 text-right">
                  When
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.slice(0, PAGE).map(({ conversation: c, agentName }) => (
                <tr key={c.id} className="border-t border-line hover:bg-paper-raised/60">
                  <td className="px-4 py-3">
                    <Link
                      href={`/dashboard/conversations/${c.id}`}
                      className="font-semibold hover:text-ember"
                    >
                      {c.customerLabel || "Customer"}
                    </Link>
                    {agents.length > 1 && (
                      <span className="block text-xs text-ink-muted">{agentName}</span>
                    )}
                  </td>
                  <td className="max-w-72 truncate px-4 py-3 text-ink-muted">{c.summary ?? ""}</td>
                  <td className="px-4 py-3 text-ink-muted">{CHANNEL_LABELS[c.channel]}</td>
                  <td className="px-4 py-3">
                    <span className="flex flex-wrap gap-1">
                      {c.outcome ? (
                        <Badge tone={outcomeTone(c.outcome)}>{OUTCOME_LABELS[c.outcome]}</Badge>
                      ) : (
                        <Badge>open</Badge>
                      )}
                      {c.flags.includes("needs_attention") && <Badge tone="warn">needs you</Badge>}
                    </span>
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-right text-ink-muted">
                    {when(c.startedAt)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <nav aria-label="Pages" className="flex justify-between">
        {pageNo > 0 ? (
          <Link href={link(pageNo - 1)} className={secondary}>
            ← Newer
          </Link>
        ) : (
          <span />
        )}
        {more && (
          <Link href={link(pageNo + 1)} className={secondary}>
            Older →
          </Link>
        )}
      </nav>
    </div>
  );
}
