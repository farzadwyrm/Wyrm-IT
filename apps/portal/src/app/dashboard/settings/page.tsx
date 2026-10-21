import { listAudit, listRoles, listStaff, listSwitches, usageSummary } from "@wyrm/core";
import type { Metadata } from "next";
import Link from "next/link";
import { money, requireTenant, when } from "@/lib/portal";
import { budgetAction, pauseEverythingAction } from "../actions";
import { Badge, Card, input, Notice, PageHeader, primary, secondary } from "../ui";
import { InviteForm } from "./invite-form";

export const metadata: Metadata = { title: "Settings" };

export default async function SettingsPage({ searchParams }: PageProps<"/dashboard/settings">) {
  const page = await requireTenant();
  const params = await searchParams;
  const back = "/dashboard/settings";
  const canStaff = page.can("staff.view");
  const canInvite = page.can("staff.invite");
  const [staff, roles, switches, usage, audit] = await Promise.all([
    canStaff ? listStaff(page.ctx, page.tenantId) : Promise.resolve([]),
    canInvite ? listRoles(page.ctx, page.tenantId) : Promise.resolve([]),
    listSwitches(page.ctx, page.tenantId),
    page.can("billing.view") ? usageSummary(page.ctx, page.tenantId) : Promise.resolve(null),
    page.can("audit.view")
      ? listAudit(page.ctx.db, { tenantId: page.tenantId, limit: 15 })
      : Promise.resolve([]),
  ]);
  const pause = switches.find((s) => s.scope === "tenant" && s.tenantId === page.tenantId);
  const myRank = staff.find((s) => s.userId === page.access.userId)?.roleRank ?? 0;
  const invitable = roles
    .filter((r) => r.key !== "owner" && r.rank <= myRank)
    .map((r) => ({ id: r.id, name: r.name }));

  return (
    <section className="space-y-8">
      <PageHeader
        title="Settings"
        intro="Your team, AI budget, and the switch that pauses every assistant."
      />
      <Notice params={params} />

      <div className="grid gap-4 lg:grid-cols-2">
        {page.can("security.manage") && (
          <Card>
            <h2 className="font-display text-xl font-semibold">Pause all assistants</h2>
            <p className="mt-2 text-sm text-ink-muted">
              While paused, customers are told the assistant is unavailable and asked to leave a
              message.
            </p>
            <form action={pauseEverythingAction} className="mt-3 flex flex-wrap items-end gap-2">
              <input type="hidden" name="back" value={back} />
              {pause ? (
                <>
                  <input type="hidden" name="on" value="0" />
                  <input type="hidden" name="switchId" value={pause.id} />
                  <p className="w-full">
                    <Badge tone="warn">Paused</Badge> {pause.reason} · {when(pause.createdAt)}
                  </p>
                  <button type="submit" className={primary}>
                    Switch everything back on
                  </button>
                </>
              ) : (
                <>
                  <input type="hidden" name="on" value="1" />
                  <label className="min-w-48 flex-1">
                    <span className="text-sm font-semibold">Reason</span>
                    <input
                      name="reason"
                      maxLength={300}
                      className={input}
                      placeholder="e.g. Closed for the holidays"
                    />
                  </label>
                  <button type="submit" className={secondary}>
                    Pause everything
                  </button>
                </>
              )}
            </form>
          </Card>
        )}

        {usage && (
          <Card>
            <h2 className="font-display text-xl font-semibold">AI budget</h2>
            <p className="mt-2 text-sm text-ink-muted">
              {money(usage.spentMonthMicros)} spent this month ({usage.conversations}{" "}
              conversations). Today: {money(usage.spentTodayMicros)} of a{" "}
              {money(usage.dailyCapMicros)} daily cap.
            </p>
            {page.can("billing.manage") ? (
              <form action={budgetAction} className="mt-3 flex flex-wrap items-end gap-2">
                <input type="hidden" name="back" value={back} />
                <label>
                  <span className="text-sm font-semibold">Monthly budget (USD)</span>
                  <input
                    name="dollars"
                    type="number"
                    min={0}
                    max={1000}
                    step="0.5"
                    defaultValue={(usage.budgetMicros / 1_000_000).toFixed(2)}
                    className={input}
                  />
                </label>
                <button type="submit" className={secondary}>
                  Save
                </button>
              </form>
            ) : (
              <p className="mt-3">Budget: {money(usage.budgetMicros)} a month.</p>
            )}
          </Card>
        )}
      </div>

      {canStaff && (
        <div className="space-y-3">
          <h2 className="font-display text-xl font-semibold">Team</h2>
          <ul className="divide-y divide-line rounded-2xl border border-line">
            {staff.map((s) => (
              <li key={s.id} className="flex flex-wrap items-center justify-between gap-2 p-3">
                <span>
                  {s.name || s.email}
                  {s.name && <span className="text-ink-muted"> · {s.email}</span>}
                </span>
                <span className="flex items-center gap-2">
                  <Badge>{s.roleName}</Badge>
                  {s.status !== "active" && <Badge tone="bad">{s.status}</Badge>}
                </span>
              </li>
            ))}
          </ul>
          {canInvite && invitable.length > 0 && (
            <Card>
              <h3 className="mb-3 font-semibold">Invite someone</h3>
              <InviteForm roles={invitable} />
            </Card>
          )}
        </div>
      )}

      {audit.length > 0 && (
        <div className="space-y-3">
          <h2 className="font-display text-xl font-semibold">Recent activity</h2>
          <ul className="divide-y divide-line rounded-2xl border border-line text-sm">
            {audit.map((a) => (
              <li key={a.id} className="flex flex-wrap justify-between gap-2 p-3">
                <span>
                  {a.action.replace(/[._]/g, " ")}
                  {a.actorType === "platform" && <Badge tone="warn">Wyrm staff</Badge>}
                </span>
                <span className="text-ink-muted">{when(a.createdAt)}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <p>
        <Link href="/account/password" className="font-semibold text-ember hover:text-ember-strong">
          Change your password →
        </Link>
      </p>
    </section>
  );
}
