import { check } from "@wyrm/auth";
import {
  customerHealth,
  DomainError,
  getTenant,
  listAgents,
  listConversations,
  listInvitations,
  listStaff,
  setupStatus,
} from "@wyrm/core";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ChatBox } from "@/components/chat-box";
import { coreContext, requireAdmin } from "@/lib/auth";
import { clientHealth } from "@/lib/health";
import { money, OUTCOME_LABELS, when } from "@/lib/portal";
import {
  addAgentAction,
  adminAgentStatus,
  changeClientStatus,
  deleteClientAction,
  signOffAction,
  viewAsAction,
} from "../../actions";
import { InviteLink } from "./invite-link";

export const metadata: Metadata = { title: "Client" };

const input =
  "w-full rounded-xl border border-line bg-paper px-3 py-2.5 outline-none focus-visible:border-ember";
const button =
  "inline-flex min-h-11 items-center rounded-lg border border-line px-4 font-semibold hover:border-ink-muted";

/** One client for Wyrm staff: agents (on/off, try them), staff ("view as"), recent conversations. */
export default async function TenantPage({
  params,
  searchParams,
}: PageProps<"/admin/tenants/[id]">) {
  const access = await requireAdmin();
  if (access.actor?.kind !== "platform") redirect("/admin");
  const { id } = await params;
  const query = await searchParams;
  if (!/^[0-9a-f-]{36}$/.test(id)) notFound();
  const ctx = await coreContext(access);
  let tenant: Awaited<ReturnType<typeof getTenant>>;
  try {
    tenant = await getTenant(ctx, id);
  } catch (e) {
    if (e instanceof DomainError) notFound();
    throw e;
  }
  const [agents, staff, recent, healthRows, invites] = await Promise.all([
    listAgents(ctx, id),
    listStaff(ctx, id),
    listConversations(ctx, id, { limit: 10 }),
    customerHealth(ctx),
    // Roles without access to client users simply don't see invitations.
    listInvitations(ctx, id).catch(() => []),
  ]);
  const waitingInvites = invites.filter((i) => i.status === "pending" || i.status === "expired");
  const row = healthRows.find((r) => r.tenantId === id);
  const health = row ? clientHealth(row) : null;
  const setups = new Map(
    await Promise.all(
      agents.map(async ({ agent }) => [agent.id, await setupStatus(ctx, id, agent.id)] as const),
    ),
  );
  const canImpersonate = ["super_admin", "platform_admin", "support"].includes(access.actor.role);

  return (
    <section className="space-y-8">
      <Link href="/admin" className="text-sm text-ink-muted hover:text-ink">
        ← Back office
      </Link>
      <div>
        <h1 className="font-display text-3xl font-semibold">{tenant.name}</h1>
        <p className="mt-1 text-ink-muted">
          {tenant.slug} · {tenant.plan} · {tenant.status} · {tenant.seatLimit} seats ·{" "}
          {tenant.agentLimit} agents
        </p>
      </div>
      {row && health && (
        <div className="space-y-3">
          <p
            className={`rounded-xl border p-3 text-sm ${
              health.tone === "bad"
                ? "border-node-output/50 bg-node-output/5"
                : health.tone === "warn"
                  ? "border-signal/50 bg-signal/5"
                  : health.tone === "good"
                    ? "border-moss/40 bg-moss/5"
                    : "border-line"
            }`}
          >
            <strong>{health.label}</strong>
            {health.issues.length > 0 ? `: ${health.issues.join(" · ")}` : ""}
          </p>
          <ul className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {[
              ["Agents live", `${row.liveAgents} of ${row.agents}`],
              ["Chats (7 days)", String(row.conversations7d)],
              ["Waiting for client", String(row.waiting + row.pendingApprovals)],
              [
                "AI spend this month",
                `${money(row.spendMonthMicros)} / ${money(row.budgetMicros)}`,
              ],
            ].map(([label, value]) => (
              <li key={label} className="rounded-2xl border border-line bg-paper-raised/80 p-3">
                <p className="text-xs text-ink-muted">{label}</p>
                <p className="mt-1 font-display text-xl font-semibold">{value}</p>
              </li>
            ))}
          </ul>
        </div>
      )}
      {typeof query.error === "string" && (
        <p role="alert" className="rounded-xl border border-node-output/50 bg-node-output/10 p-3">
          {query.error.slice(0, 200)}
        </p>
      )}

      <div className="space-y-3">
        <h2 className="font-display text-xl font-semibold">Agents</h2>
        {agents.length === 0 && <p className="text-ink-muted">No agents yet.</p>}
        <form
          action={addAgentAction}
          className="flex flex-wrap items-end gap-2 rounded-2xl border border-dashed border-line p-3"
        >
          <input type="hidden" name="tenantId" value={id} />
          <label>
            <span className="text-sm font-semibold">Add an agent from a template</span>
            <select name="type" className={input} defaultValue="knowledge">
              <option value="knowledge">Ask your documents (internal, staff only)</option>
              <option value="receptionist">Receptionist (customer-facing)</option>
              <option value="sales">Sales agent (qualifies leads)</option>
            </select>
          </label>
          <label className="min-w-48 flex-1">
            <span className="text-sm font-semibold">Name (optional)</span>
            <input
              name="name"
              maxLength={80}
              className={input}
              placeholder="e.g. Ask the handbook"
            />
          </label>
          <button type="submit" className={button}>
            Add agent
          </button>
        </form>
        <ul className="grid gap-4 lg:grid-cols-2">
          {agents.map(({ agent }) => (
            <li key={agent.id} className="space-y-3 rounded-2xl border border-line p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="font-semibold">
                  {agent.name}{" "}
                  <span className="text-ink-muted">
                    · {agent.type} · {agent.status}
                  </span>
                </p>
                <form action={adminAgentStatus}>
                  <input type="hidden" name="tenantId" value={id} />
                  <input type="hidden" name="agentId" value={agent.id} />
                  <input
                    type="hidden"
                    name="status"
                    value={agent.status === "live" ? "paused" : "live"}
                  />
                  <button type="submit" className={button}>
                    {agent.status === "live" ? "Pause" : "Switch on"}
                  </button>
                </form>
              </div>
              {agent.status === "live" && (
                <p className="text-sm text-ink-muted">
                  Public chat:{" "}
                  <Link href={`/chat/${agent.id}`} className="break-all text-ember">
                    /chat/{agent.id}
                  </Link>
                </p>
              )}
              {(() => {
                const setup = setups.get(agent.id);
                if (!setup) return null;
                return (
                  <div className="space-y-2 rounded-xl border border-line p-3 text-sm">
                    <p>
                      Must do: {setup.done} of {setup.total} done
                      {setup.missingBeforeSignOff.length > 0 && (
                        <span className="text-ink-muted">
                          {" "}
                          · client still to do:{" "}
                          {setup.missingBeforeSignOff.map((m) => m.label.toLowerCase()).join(", ")}
                        </span>
                      )}
                    </p>
                    {setup.missingBeforeSignOff.length > 0 ? (
                      <p className="text-ink-muted">
                        Sign-off opens once the client finishes the required steps. The agent can't
                        go live before then.
                      </p>
                    ) : setup.signedOff ? (
                      <p className="text-moss">
                        Signed off{setup.launch?.note ? `: ${setup.launch.note}` : ""}
                      </p>
                    ) : (
                      <form action={signOffAction} className="flex flex-wrap items-end gap-2">
                        <input type="hidden" name="tenantId" value={id} />
                        <input type="hidden" name="agentId" value={agent.id} />
                        <input
                          name="note"
                          required
                          minLength={3}
                          maxLength={500}
                          className={input}
                          placeholder="Sign-off note, e.g. facts and tests reviewed"
                          aria-label="Sign-off note"
                        />
                        <button type="submit" className={button}>
                          Sign off for launch
                        </button>
                      </form>
                    )}
                  </div>
                );
              })()}
              {agent.type === "knowledge" ? (
                <p className="text-sm text-ink-muted">
                  Internal agent: staff ask it in their portal (My agent → Ask). Use "View as" below
                  to try it with their documents.
                </p>
              ) : (
                <ChatBox agentId={agent.id} test title={`Try ${agent.name} (test chat)`} />
              )}
            </li>
          ))}
        </ul>
      </div>

      <div className="space-y-3">
        <h2 className="font-display text-xl font-semibold">Staff</h2>
        {staff.length === 0 && (
          <p className="text-ink-muted">
            Nobody has joined yet. Send the owner their invitation link.
          </p>
        )}
        {waitingInvites.length > 0 && (
          <div className="space-y-2">
            <h3 className="font-semibold">Invitations not accepted yet</h3>
            <ul className="divide-y divide-line rounded-2xl border border-line">
              {waitingInvites.map((inv) => (
                <InviteLink
                  key={inv.id}
                  tenantId={id}
                  invitationId={inv.id}
                  email={inv.email}
                  status={
                    inv.status === "pending" && inv.expiresAt <= new Date() ? "expired" : inv.status
                  }
                />
              ))}
            </ul>
          </div>
        )}
        <ul className="divide-y divide-line rounded-2xl border border-line">
          {staff.map((s) => (
            <li
              key={s.id}
              className="flex flex-col gap-3 p-4 lg:flex-row lg:items-end lg:justify-between"
            >
              <span>
                {s.email}{" "}
                <span className="text-ink-muted">
                  · {s.roleName} · {s.status}
                </span>
              </span>
              {canImpersonate && s.status === "active" && (
                <form action={viewAsAction} className="flex flex-wrap items-end gap-2">
                  <input type="hidden" name="tenantId" value={id} />
                  <input type="hidden" name="tenantUserId" value={s.id} />
                  <label>
                    <span className="text-sm font-semibold">
                      Reason (logged, shown to the client)
                    </span>
                    <input name="reason" required minLength={5} maxLength={500} className={input} />
                  </label>
                  <button type="submit" className={button}>
                    View as
                  </button>
                </form>
              )}
            </li>
          ))}
        </ul>
      </div>

      <div className="space-y-3">
        <h2 className="font-display text-xl font-semibold">Recent conversations</h2>
        {recent.length === 0 ? (
          <p className="text-ink-muted">None yet. Use "Try" above or the public chat link.</p>
        ) : (
          <ul className="divide-y divide-line rounded-2xl border border-line text-sm">
            {recent.map(({ conversation: c, agentName }) => (
              <li key={c.id} className="flex flex-wrap justify-between gap-2 p-3">
                <span>
                  {c.customerLabel} · {agentName ?? "No agent"} · {c.summary ?? ""}
                </span>
                <span className="text-ink-muted">
                  {c.outcome ? OUTCOME_LABELS[c.outcome] : "open"} · {when(c.startedAt)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>

      {check(access.actor, "tenants.delete").allowed && (
        <div className="space-y-3 rounded-2xl border border-node-output/50 p-4">
          <h2 className="font-display text-xl font-semibold">Delete client</h2>
          <p className="text-sm text-ink-muted">
            Permanently deletes {tenant.name}: its agents, settings, conversations, leads, documents
            and staff access. This can't be undone.
          </p>
          {tenant.status !== "suspended" ? (
            <form action={changeClientStatus} className="flex flex-wrap items-center gap-3">
              <input type="hidden" name="tenantId" value={id} />
              <input type="hidden" name="status" value="suspended" />
              <p className="text-sm">Suspend the client first. That stops its agents and logins.</p>
              <button type="submit" className={button}>
                Suspend client
              </button>
            </form>
          ) : (
            <form action={deleteClientAction} className="flex flex-wrap items-end gap-2">
              <input type="hidden" name="tenantId" value={id} />
              <label className="min-w-64 flex-1">
                <span className="text-sm font-semibold">
                  Type <code className="rounded bg-paper px-1">{tenant.slug}</code> to confirm
                </span>
                <input
                  name="confirm"
                  required
                  autoComplete="off"
                  pattern={tenant.slug.replace(/[.*+?^${}()|[\]\\-]/g, "\\$&")}
                  className={input}
                />
              </label>
              <button
                type="submit"
                className="inline-flex min-h-11 items-center rounded-lg border border-node-output/60 px-4 font-semibold text-node-output hover:bg-node-output/10"
              >
                Delete permanently
              </button>
            </form>
          )}
        </div>
      )}
    </section>
  );
}
