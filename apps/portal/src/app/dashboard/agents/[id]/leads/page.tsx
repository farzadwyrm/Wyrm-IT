import { listLeads } from "@wyrm/core";
import type { Metadata } from "next";
import Link from "next/link";
import { requireTenant, when } from "@/lib/portal";
import { Badge, Empty, input, Notice, secondary } from "../../../ui";
import { leadStatusAction } from "./actions";

export const metadata: Metadata = { title: "Leads" };

const BUCKET: Record<string, { label: string; tone: "good" | "warn" | "plain" }> = {
  hot: { label: "Hot", tone: "good" },
  warm: { label: "Warm", tone: "warn" },
  not_fit: { label: "Not a fit", tone: "plain" },
};
const STATUSES = [
  ["new", "New"],
  ["contacted", "Contacted"],
  ["won", "Won"],
  ["lost", "Lost"],
] as const;

/** Leads the sales agent qualified: hot first by date, with the answers that scored them. */
export default async function LeadsPage({
  params,
  searchParams,
}: PageProps<"/dashboard/agents/[id]/leads">) {
  const page = await requireTenant();
  const { id } = await params;
  const query = await searchParams;
  const tests = query.tests === "1";
  const leads = await listLeads(page.ctx, page.tenantId, { agentId: id, includeTests: tests });
  const canUpdate = page.can("agents.use", id) && !page.readOnly;
  const counts = {
    hot: leads.filter((l) => l.bucket === "hot" && l.status === "new").length,
    open: leads.filter((l) => l.status === "new" || l.status === "contacted").length,
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <p className="max-w-2xl text-ink-muted">
          People your agent talked to, scored on your qualifying questions.{" "}
          {counts.hot > 0 ? (
            <strong className="text-ink">
              {counts.hot} hot lead{counts.hot === 1 ? "" : "s"} waiting for a call.
            </strong>
          ) : (
            `${counts.open} open.`
          )}
        </p>
        <Link
          href={`/dashboard/agents/${id}/leads${tests ? "" : "?tests=1"}`}
          className="text-sm font-semibold text-ember hover:underline"
        >
          {tests ? "Hide test chats" : "Show test chats"}
        </Link>
      </div>
      <Notice params={query} />

      {leads.length === 0 ? (
        <Empty>
          No leads yet. They appear here when your agent finishes qualifying someone.
          {tests ? "" : " Leads from test chats are hidden."}
        </Empty>
      ) : (
        <ul className="space-y-3">
          {leads.map((lead) => {
            const bucket = BUCKET[lead.bucket] ?? { label: lead.bucket, tone: "plain" as const };
            const answers = Object.entries((lead.answers ?? {}) as Record<string, string>);
            return (
              <li
                key={lead.id}
                className="space-y-3 rounded-2xl border border-line bg-paper-raised/80 p-4"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="font-semibold">
                      {lead.name || "No name given"}{" "}
                      <Badge tone={bucket.tone}>{bucket.label}</Badge>{" "}
                      {lead.isTest && <Badge>Test</Badge>}
                    </p>
                    <p className="text-sm text-ink-muted">
                      {lead.contact || "No contact given"} · {lead.score} points ·{" "}
                      {when(lead.createdAt)}
                    </p>
                  </div>
                  <form action={leadStatusAction} className="flex items-end gap-2">
                    <input type="hidden" name="agentId" value={id} />
                    <input type="hidden" name="leadId" value={lead.id} />
                    {tests && <input type="hidden" name="tests" value="1" />}
                    <label>
                      <span className="sr-only">Status of {lead.name || "this lead"}</span>
                      <select
                        name="status"
                        defaultValue={lead.status}
                        disabled={!canUpdate}
                        className={input}
                      >
                        {STATUSES.map(([value, label]) => (
                          <option key={value} value={value}>
                            {label}
                          </option>
                        ))}
                      </select>
                    </label>
                    {canUpdate && (
                      <button type="submit" className={secondary}>
                        Save
                      </button>
                    )}
                  </form>
                </div>
                {answers.length > 0 && (
                  <dl className="grid gap-x-4 gap-y-1 text-sm sm:grid-cols-[minmax(0,14rem)_1fr]">
                    {answers.map(([key, value]) => (
                      <div key={key} className="contents">
                        <dt className="text-ink-muted">
                          {key.replace(/^q_/, "").replace(/_/g, " ")}
                        </dt>
                        <dd>{value}</dd>
                      </div>
                    ))}
                  </dl>
                )}
                {lead.reasons.length > 0 && (
                  <details className="text-sm text-ink-muted">
                    <summary className="cursor-pointer font-semibold">Why this score</summary>
                    <ul className="mt-1 list-disc pl-5">
                      {lead.reasons.map((r) => (
                        <li key={r}>{r}</li>
                      ))}
                    </ul>
                  </details>
                )}
                <Link
                  href={`/dashboard/conversations/${lead.conversationId}`}
                  className="text-sm font-semibold text-ember hover:underline"
                >
                  Read the conversation →
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
