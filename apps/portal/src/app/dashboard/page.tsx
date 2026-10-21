import {
  homeMetrics,
  listAgents,
  listApprovals,
  notableChange,
  setupStatus,
  unansweredTopics,
  usageSummary,
} from "@wyrm/core";
import Link from "next/link";
import { requireAccess } from "@/lib/auth";
import { money, requireTenant } from "@/lib/portal";
import { Badge, Card, Empty, Notice, PageHeader } from "./ui";

const TILES = [
  { key: "answered", label: "Conversations answered", href: "/dashboard/conversations" },
  { key: "booked", label: "Bookings made", href: "/dashboard/conversations?outcome=booked" },
  { key: "leads", label: "New leads", href: "/dashboard/conversations?outcome=lead" },
  {
    key: "handedOff",
    label: "Handed to a person",
    href: "/dashboard/conversations?outcome=handed_off",
  },
  {
    key: "confirmed",
    label: "Resolved, confirmed",
    href: "/dashboard/conversations?outcome=resolved_confirmed",
  },
  {
    key: "assumed",
    label: "Resolved, assumed",
    href: "/dashboard/conversations?outcome=resolved_assumed",
  },
] as const;

export default async function HomePage({ searchParams }: PageProps<"/dashboard">) {
  const access = await requireAccess();
  const actor = access.actor;
  if (actor?.kind !== "tenant" && actor?.kind !== "impersonating") {
    return (
      <section className="max-w-xl space-y-4">
        <h1 className="font-display text-3xl font-semibold">Welcome back</h1>
        <p className="text-ink-muted">
          {!access.dbReady
            ? "The portal can't reach its database right now. Try again shortly."
            : access.isAdmin
              ? "You're Wyrm staff. Manage clients in Admin."
              : "Your account has no active organisation. If your organisation was suspended, contact your Wyrm contact."}
        </p>
        {access.isAdmin && (
          <Link href="/admin" className="font-semibold text-ember hover:text-ember-strong">
            Go to admin →
          </Link>
        )}
      </section>
    );
  }

  const page = await requireTenant();
  const params = await searchParams;
  const [home, topics, agents, approvals] = await Promise.all([
    homeMetrics(page.ctx, page.tenantId),
    unansweredTopics(page.ctx, page.tenantId),
    listAgents(page.ctx, page.tenantId),
    listApprovals(page.ctx, page.tenantId),
  ]);
  const usage = page.can("billing.view") ? await usageSummary(page.ctx, page.tenantId) : null;
  const byKey = new Map(home.metrics.map((m) => [m.key, m]));
  const live = agents.filter((a) => a.agent.status === "live").length;
  const setups = await Promise.all(
    agents
      .filter((a) => a.agent.status !== "live" && page.can("agents.configure", a.agent.id))
      .slice(0, 4)
      .map(async ({ agent }) => ({
        agent,
        setup: await setupStatus(page.ctx, page.tenantId, agent.id),
      })),
  );

  return (
    <section className="space-y-8">
      <PageHeader
        title={page.tenantName}
        intro={`This week compared with last week. ${live} of ${agents.length} agent${agents.length === 1 ? "" : "s"} switched on.`}
      />
      <Notice params={params} />

      {home.needsAttention > 0 && (
        <Link
          href="/dashboard/todo"
          className="flex items-center justify-between gap-4 rounded-2xl border border-ember/50 bg-ember/10 p-4 hover:border-ember"
        >
          <span>
            <strong>{home.needsAttention}</strong> thing{home.needsAttention === 1 ? "" : "s"} need
            {home.needsAttention === 1 ? "s" : ""} your attention
            {approvals.length > 0
              ? `, including ${approvals.length} approval${approvals.length === 1 ? "" : "s"}`
              : ""}
            .
          </span>
          <span aria-hidden="true">→</span>
        </Link>
      )}

      {setups.map(({ agent, setup }) => (
        <Link
          key={agent.id}
          href={`/dashboard/agents/${agent.id}/launch`}
          className="block rounded-2xl border border-line bg-paper-raised/80 p-4 hover:border-ink-muted"
        >
          <span className="flex items-center justify-between gap-4">
            <span>
              <strong>Finish setting up {agent.name}</strong>: {setup.done} of {setup.total} steps
              done
              {setup.missing[0]
                ? `. Next: ${setup.missing[0].label.toLowerCase()}`
                : setup.signedOff
                  ? ". Ready to go live"
                  : ". Waiting for Wyrm's sign-off"}
              .
            </span>
            <span aria-hidden="true">→</span>
          </span>
          <span className="mt-2 block h-2 overflow-hidden rounded-full bg-line" aria-hidden="true">
            <span
              className="block h-full bg-moss"
              style={{ width: `${Math.round((setup.done / setup.total) * 100)}%` }}
            />
          </span>
        </Link>
      ))}

      <ul className="grid grid-cols-2 gap-3 lg:grid-cols-3">
        {TILES.map((tile) => {
          const m = byKey.get(tile.key) ?? { key: tile.key, current: 0, previous: 0 };
          const change = notableChange(m);
          const diff = m.current - m.previous;
          return (
            <li key={tile.key}>
              <Link
                href={tile.href}
                className="block h-full rounded-2xl border border-line bg-paper-raised/80 p-4 hover:border-ink-muted"
              >
                <p className="text-sm text-ink-muted">{tile.label}</p>
                <p className="mt-1 font-display text-3xl font-semibold">{m.current}</p>
                <p className="mt-1 text-xs text-ink-muted">
                  {diff === 0 ? "Same as last week" : `${diff > 0 ? "+" : ""}${diff} vs last week`}{" "}
                  {change && (
                    <Badge tone={change === "up" ? "good" : "warn"}>
                      {change === "up" ? "Big rise" : "Big drop"}
                    </Badge>
                  )}
                </p>
              </Link>
            </li>
          );
        })}
      </ul>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <h2 className="font-display text-xl font-semibold">Suggestions</h2>
          {topics.length === 0 ? (
            <p className="mt-3 text-ink-muted">No unanswered questions this month. Nice.</p>
          ) : (
            <ul className="mt-3 space-y-3">
              {topics.slice(0, 4).map((t) => (
                <li key={t.topic} className="flex items-start justify-between gap-3">
                  <span>
                    {t.n} customer{t.n === 1 ? "" : "s"} asked about <strong>{t.topic}</strong> and
                    didn't get an answer.
                  </span>
                  <Link
                    href={`/dashboard/teach?topic=${encodeURIComponent(t.topic)}${t.agentId ? `&agent=${t.agentId}` : ""}`}
                    className="shrink-0 font-semibold text-ember hover:text-ember-strong"
                  >
                    Add an answer
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Card>

        {usage ? (
          <Card>
            <h2 className="font-display text-xl font-semibold">AI usage this month</h2>
            <p className="mt-3 text-ink-muted">
              {money(usage.spentMonthMicros)} of {money(usage.budgetMicros)} budget · forecast{" "}
              {money(usage.projectedMonthMicros)}
            </p>
            {/* biome-ignore lint/a11y/useSemanticElements: a styled bar; aria attributes describe it */}
            <div
              className="mt-3 h-2 overflow-hidden rounded-full bg-line"
              role="meter"
              aria-label="Budget used"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={Math.min(
                100,
                Math.round((usage.spentMonthMicros / Math.max(1, usage.budgetMicros)) * 100),
              )}
            >
              <div
                className={`h-full ${usage.projectedMonthMicros > usage.budgetMicros * 0.8 ? "bg-signal" : "bg-moss"}`}
                style={{
                  width: `${Math.min(100, (usage.spentMonthMicros / Math.max(1, usage.budgetMicros)) * 100)}%`,
                }}
              />
            </div>
            {usage.projectedMonthMicros > usage.budgetMicros && (
              <p className="mt-3 text-sm text-signal">
                At this pace you'll reach the budget before the month ends. Agents then switch to
                free models and take messages.
              </p>
            )}
          </Card>
        ) : (
          <Card>
            <h2 className="font-display text-xl font-semibold">Your agents</h2>
            {agents.length === 0 ? (
              <Empty>No agents shared with you yet.</Empty>
            ) : (
              <ul className="mt-3 space-y-2">
                {agents.map(({ agent }) => (
                  <li key={agent.id} className="flex justify-between">
                    <span>{agent.name}</span>
                    <Badge tone={agent.status === "live" ? "good" : "plain"}>{agent.status}</Badge>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        )}
      </div>
    </section>
  );
}
