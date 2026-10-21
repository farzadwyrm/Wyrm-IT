import { listAgents, listConversations } from "@wyrm/core";
import type { Metadata } from "next";
import Link from "next/link";
import { CHANNEL_LABELS, OUTCOME_LABELS, requireTenant, when } from "@/lib/portal";
import { Badge, Empty, input, Notice, PageHeader, secondary } from "../ui";

export const metadata: Metadata = { title: "Conversations" };

const PAGE = 25;
const OUTCOMES = Object.keys(OUTCOME_LABELS);
const CHANNELS = Object.keys(CHANNEL_LABELS);

const outcomeTone = (o: string | null) =>
  o === "booked" || o === "lead" || o === "resolved_confirmed"
    ? "good"
    : o === "handed_off"
      ? "warn"
      : o === "failed"
        ? "bad"
        : "plain";

export default async function ConversationsPage({
  searchParams,
}: PageProps<"/dashboard/conversations">) {
  const page = await requireTenant();
  const params = await searchParams;
  const str = (k: string) => (typeof params[k] === "string" ? (params[k] as string) : "");
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
  const link = (n: number) => {
    const q = new URLSearchParams({
      ...(outcome && { outcome }),
      ...(channel && { channel }),
      ...(agentId && { agent: agentId }),
      ...(search && { q: search }),
      page: String(n),
    });
    return `/dashboard/conversations?${q.toString()}`;
  };

  return (
    <section className="space-y-6">
      <PageHeader
        title="Conversations"
        intro="Every call and message your agents handled. Open one to see what happened and why."
      />
      <Notice params={params} />

      <form
        className="grid gap-3 rounded-2xl border border-line bg-paper-raised/60 p-4 sm:grid-cols-5"
        aria-label="Filter conversations"
      >
        <label className="sm:col-span-2">
          <span className="text-sm font-semibold">Search</span>
          <input name="q" defaultValue={search} placeholder="Name or summary" className={input} />
        </label>
        <label>
          <span className="text-sm font-semibold">Result</span>
          <select name="outcome" defaultValue={outcome} className={input}>
            <option value="">Any</option>
            {OUTCOMES.map((o) => (
              <option key={o} value={o}>
                {OUTCOME_LABELS[o]}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span className="text-sm font-semibold">Agent</span>
          <select name="agent" defaultValue={agentId} className={input}>
            <option value="">All</option>
            {agents.map(({ agent }) => (
              <option key={agent.id} value={agent.id}>
                {agent.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span className="text-sm font-semibold">Channel</span>
          <select name="channel" defaultValue={channel} className={input}>
            <option value="">All</option>
            {CHANNELS.map((c) => (
              <option key={c} value={c}>
                {CHANNEL_LABELS[c]}
              </option>
            ))}
          </select>
        </label>
        <div className="flex gap-2 sm:col-span-5">
          <button type="submit" className={secondary}>
            Apply filters
          </button>
          {(outcome || channel || agentId || search) && (
            <Link
              href="/dashboard/conversations"
              className="inline-flex min-h-11 items-center px-2 text-ink-muted hover:text-ink"
            >
              Clear
            </Link>
          )}
        </div>
      </form>

      {rows.length === 0 ? (
        <Empty>No conversations match. When your agents talk to customers, they appear here.</Empty>
      ) : (
        <ul className="divide-y divide-line rounded-2xl border border-line">
          {rows.slice(0, PAGE).map(({ conversation: c, agentName }) => (
            <li key={c.id}>
              <Link
                href={`/dashboard/conversations/${c.id}`}
                className="flex flex-col gap-1 p-4 hover:bg-paper-raised sm:flex-row sm:items-center sm:justify-between"
              >
                <span className="min-w-0">
                  <span className="font-semibold">{c.customerLabel || "Customer"}</span>
                  <span className="text-ink-muted">
                    {" "}
                    · {CHANNEL_LABELS[c.channel]} · {agentName ?? "No agent"}
                  </span>
                  {c.summary && (
                    <span className="mt-1 block truncate text-sm text-ink-muted">{c.summary}</span>
                  )}
                </span>
                <span className="flex shrink-0 items-center gap-2 text-sm">
                  {c.flags.includes("needs_attention") && <Badge tone="warn">To-do</Badge>}
                  {c.outcome && (
                    <Badge tone={outcomeTone(c.outcome)}>{OUTCOME_LABELS[c.outcome]}</Badge>
                  )}
                  <span className="text-ink-muted">{when(c.startedAt)}</span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
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
    </section>
  );
}
