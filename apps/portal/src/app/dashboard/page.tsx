import {
  activityByDay,
  calendarStatus,
  homeMetrics,
  listAgents,
  listConversations,
  listSwitches,
  setupStatus,
  unansweredTopics,
  usageSummary,
} from "@wyrm/core";
import Link from "next/link";
import { requireAccess } from "@/lib/auth";
import { CHANNEL_LABELS, money, OUTCOME_LABELS, requireTenant, when } from "@/lib/portal";
import { ActivityChart } from "./activity-chart";
import { agentState, STATE } from "./agent-state";
import { Badge, Card, Notice, outcomeTone } from "./ui";

interface Alert {
  tone: "bad" | "warn" | "plain";
  text: string;
  href: string;
  action: string;
}

const pct = (part: number, whole: number) => (whole ? Math.round((part / whole) * 100) : 0);

/** Overview: how the agents are doing (monitoring). Configuration lives under My agent. */
export default async function OverviewPage({ searchParams }: PageProps<"/dashboard">) {
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
              ? "You're Wyrm staff. Your clients are in the back office."
              : "Your account has no active organisation. If your organisation was suspended, contact your Wyrm contact."}
        </p>
        {access.isAdmin && (
          <Link href="/admin" className="font-semibold text-ember hover:text-ember-strong">
            Go to the back office →
          </Link>
        )}
      </section>
    );
  }

  const page = await requireTenant();
  const params = await searchParams;
  const [home, days, topics, agents, switches, recent] = await Promise.all([
    homeMetrics(page.ctx, page.tenantId),
    activityByDay(page.ctx, page.tenantId, 14),
    unansweredTopics(page.ctx, page.tenantId),
    listAgents(page.ctx, page.tenantId),
    listSwitches(page.ctx, page.tenantId),
    listConversations(page.ctx, page.tenantId, { limit: 6 }),
  ]);
  const usage = page.can("billing.view") ? await usageSummary(page.ctx, page.tenantId) : null;
  const pausedAll = switches.find((s) => s.scope === "tenant" || s.scope === "global");
  const details = await Promise.all(
    agents.map(async ({ agent }) => {
      const stop = switches.find((s) => s.scope === "agent" && s.agentId === agent.id);
      const configure = page.can("agents.configure", agent.id);
      const [calendar, setup] = await Promise.all([
        configure ? calendarStatus(page.ctx, page.tenantId, agent.id) : null,
        configure && agent.status !== "live"
          ? setupStatus(page.ctx, page.tenantId, agent.id)
          : null,
      ]);
      return {
        agent,
        stop,
        calendar,
        setup,
        state: agentState(agent.status, !!(stop || pausedAll)),
      };
    }),
  );

  const m = (key: string) =>
    home.metrics.find((x) => x.key === key) ?? { key, current: 0, previous: 0 };
  const answered = m("answered");
  const handled = ["confirmed", "assumed", "booked", "leads"].reduce(
    (t, k) => ({ current: t.current + m(k).current, previous: t.previous + m(k).previous }),
    { current: 0, previous: 0 },
  );
  const tiles = [
    {
      label: "Conversations",
      value: String(answered.current),
      diff: answered.current - answered.previous,
      href: "/dashboard/inbox?view=all",
    },
    {
      label: "Handled by your agent",
      value: `${pct(handled.current, answered.current)}%`,
      note: `${handled.current} of ${answered.current}`,
      href: "/dashboard/inbox?view=all",
    },
    {
      label: "Bookings",
      value: String(m("booked").current),
      diff: m("booked").current - m("booked").previous,
      href: "/dashboard/inbox?view=all&outcome=booked",
    },
    {
      label: "Handed to you",
      value: String(m("handedOff").current),
      diff: m("handedOff").current - m("handedOff").previous,
      href: "/dashboard/inbox?view=all&outcome=handed_off",
    },
  ];

  const alerts: Alert[] = [];
  if (home.needsAttention > 0)
    alerts.push({
      tone: "warn",
      text: `${home.needsAttention} thing${home.needsAttention === 1 ? "" : "s"} waiting for you${home.pendingApprovals ? `, including ${home.pendingApprovals} approval${home.pendingApprovals === 1 ? "" : "s"}` : ""}.`,
      href: "/dashboard/inbox",
      action: "Open inbox",
    });
  if (pausedAll)
    alerts.push({
      tone: "bad",
      text: "Every assistant is paused: customers are asked to leave a message.",
      href: "/dashboard/settings",
      action: "Settings",
    });
  for (const d of details) {
    if (d.stop)
      alerts.push({
        tone: "bad",
        text: `${d.agent.name} was stopped: ${d.stop.reason}`,
        href: `/dashboard/agents/${d.agent.id}`,
        action: "Open agent",
      });
    if (d.calendar && d.calendar.status !== "ok")
      alerts.push({
        tone: "bad",
        text: `${d.agent.name} can't reach your Google Calendar. Bookings come to your inbox instead.`,
        href: `/dashboard/agents/${d.agent.id}/launch`,
        action: "Reconnect",
      });
    if (d.setup)
      alerts.push({
        tone: "plain",
        text: `${d.agent.name} isn't live yet: ${d.setup.done} of ${d.setup.total} must-do steps done${d.setup.missingBeforeSignOff[0] ? `. Next: ${d.setup.missingBeforeSignOff[0].label.toLowerCase()}` : d.setup.signedOff ? ". Ready to go live" : ". Waiting for Wyrm's sign-off"}.`,
        href: `/dashboard/agents/${d.agent.id}/launch`,
        action: "Continue setup",
      });
  }
  if (usage && usage.projectedMonthMicros > usage.budgetMicros)
    alerts.push({
      tone: "warn",
      text: `At this pace AI spend reaches your ${money(usage.budgetMicros)} budget before the month ends. Agents then use free models and take messages.`,
      href: "/dashboard/settings",
      action: "Budget",
    });

  return (
    <section className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-semibold tracking-tight">Overview</h1>
          <p className="mt-1 text-ink-muted">Last 7 days, compared with the week before.</p>
        </div>
        <ul className="flex flex-wrap gap-2">
          {details.map((d) => (
            <li key={d.agent.id}>
              <Link
                href={`/dashboard/agents/${d.agent.id}`}
                className="inline-flex min-h-11 items-center gap-2 rounded-full border border-line px-3 text-sm hover:border-ink-muted"
              >
                <span aria-hidden="true" className={`size-2 rounded-full ${STATE[d.state].dot}`} />
                {d.agent.name}: {STATE[d.state].label}
              </Link>
            </li>
          ))}
        </ul>
      </div>
      <Notice params={params} />

      {alerts.length === 0 ? (
        <p
          role="status"
          className="flex items-center gap-2 rounded-xl border border-moss/40 bg-moss/5 p-3 text-sm"
        >
          <span aria-hidden="true" className="text-moss">
            ✓
          </span>
          All good. Nothing needs you right now.
        </p>
      ) : (
        <ul className="space-y-2">
          {alerts.map((a) => (
            <li key={a.text}>
              <Link
                href={a.href}
                className={`flex items-center justify-between gap-4 rounded-xl border p-3 text-sm hover:border-ink-muted ${
                  a.tone === "bad"
                    ? "border-node-output/50 bg-node-output/5"
                    : a.tone === "warn"
                      ? "border-ember/50 bg-ember/5"
                      : "border-line bg-paper-raised/60"
                }`}
              >
                <span className="flex items-start gap-2">
                  <span aria-hidden="true">
                    {a.tone === "bad" ? "⚠" : a.tone === "warn" ? "●" : "○"}
                  </span>
                  {a.text}
                </span>
                <span className="shrink-0 font-semibold text-ember">{a.action} →</span>
              </Link>
            </li>
          ))}
        </ul>
      )}

      <ul className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        {tiles.map((t) => (
          <li key={t.label}>
            <Link
              href={t.href}
              className="block h-full rounded-2xl border border-line bg-paper-raised/80 p-4 hover:border-ink-muted"
            >
              <p className="text-sm text-ink-muted">{t.label}</p>
              <p className="mt-1 font-display text-3xl font-semibold">{t.value}</p>
              <p className="mt-1 text-xs text-ink-muted">
                {t.note ??
                  (t.diff === 0
                    ? "Same as last week"
                    : `${(t.diff ?? 0) > 0 ? "+" : ""}${t.diff} vs last week`)}
              </p>
            </Link>
          </li>
        ))}
      </ul>

      <Card>
        <ActivityChart days={days} />
      </Card>

      <div className="grid gap-4 xl:grid-cols-[3fr_2fr]">
        <Card className="space-y-3">
          <div className="flex items-center justify-between gap-2">
            <h2 className="font-display text-lg font-semibold">Latest conversations</h2>
            <Link href="/dashboard/inbox?view=all" className="text-sm font-semibold text-ember">
              See all →
            </Link>
          </div>
          {recent.length === 0 ? (
            <p className="text-sm text-ink-muted">None yet.</p>
          ) : (
            <ul className="divide-y divide-line">
              {recent.map(({ conversation: c, agentName }) => (
                <li key={c.id}>
                  <Link
                    href={`/dashboard/conversations/${c.id}`}
                    className="flex items-center justify-between gap-3 py-2.5 hover:text-ember"
                  >
                    <span className="min-w-0">
                      <span className="font-semibold">{c.customerLabel || "Customer"}</span>
                      <span className="block truncate text-sm text-ink-muted">
                        {c.summary || `${CHANNEL_LABELS[c.channel]} · ${agentName ?? "Agent"}`}
                      </span>
                    </span>
                    <span className="flex shrink-0 flex-col items-end gap-1 text-xs text-ink-muted">
                      {c.outcome ? (
                        <Badge tone={outcomeTone(c.outcome)}>{OUTCOME_LABELS[c.outcome]}</Badge>
                      ) : (
                        <Badge>open</Badge>
                      )}
                      {when(c.startedAt)}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <div className="space-y-4">
          <Card className="space-y-3">
            <h2 className="font-display text-lg font-semibold">Questions it couldn't answer</h2>
            {topics.length === 0 ? (
              <p className="text-sm text-ink-muted">None in the last 30 days.</p>
            ) : (
              <ul className="space-y-2 text-sm">
                {topics.slice(0, 5).map((t) => (
                  <li key={t.topic} className="flex items-center justify-between gap-3">
                    <span>
                      <strong>{t.topic}</strong>{" "}
                      <span className="text-ink-muted">
                        · {t.n} customer{t.n === 1 ? "" : "s"}
                      </span>
                    </span>
                    {t.agentId && (
                      <Link
                        href={`/dashboard/agents/${t.agentId}/answers?topic=${encodeURIComponent(t.topic)}#answer`}
                        className="shrink-0 font-semibold text-ember"
                      >
                        Add answer
                      </Link>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </Card>
          {usage && (
            <Card className="space-y-2">
              <h2 className="font-display text-lg font-semibold">AI spend this month</h2>
              <p className="text-sm text-ink-muted">
                {money(usage.spentMonthMicros)} of {money(usage.budgetMicros)} · forecast{" "}
                {money(usage.projectedMonthMicros)}
              </p>
              {/* biome-ignore lint/a11y/useSemanticElements: a styled bar; aria attributes describe it */}
              <div
                className="h-2 overflow-hidden rounded-full bg-line"
                role="meter"
                aria-label="Budget used"
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={Math.min(100, pct(usage.spentMonthMicros, usage.budgetMicros))}
              >
                <div
                  className={`h-full ${usage.projectedMonthMicros > usage.budgetMicros * 0.8 ? "bg-signal" : "bg-moss"}`}
                  style={{
                    width: `${Math.min(100, pct(usage.spentMonthMicros, usage.budgetMicros))}%`,
                  }}
                />
              </div>
            </Card>
          )}
        </div>
      </div>
    </section>
  );
}
