import { DomainError, getTenant, listAgents, listConversations, listStaff } from "@wyrm/core";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ChatBox } from "@/components/chat-box";
import { coreContext, requireAdmin } from "@/lib/auth";
import { OUTCOME_LABELS, when } from "@/lib/portal";
import { adminAgentStatus, viewAsAction } from "../../actions";

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
  const [agents, staff, recent] = await Promise.all([
    listAgents(ctx, id),
    listStaff(ctx, id),
    listConversations(ctx, id, { limit: 10 }),
  ]);
  const canImpersonate = ["super_admin", "platform_admin", "support"].includes(access.actor.role);

  return (
    <section className="space-y-8">
      <Link href="/admin" className="text-sm text-ink-muted hover:text-ink">
        ← All clients
      </Link>
      <div>
        <h1 className="font-display text-3xl font-semibold">{tenant.name}</h1>
        <p className="mt-1 text-ink-muted">
          {tenant.slug} · {tenant.plan} · {tenant.status} · {tenant.seatLimit} seats ·{" "}
          {tenant.agentLimit} agents
        </p>
      </div>
      {typeof query.error === "string" && (
        <p role="alert" className="rounded-xl border border-node-output/50 bg-node-output/10 p-3">
          {query.error.slice(0, 200)}
        </p>
      )}

      <div className="space-y-3">
        <h2 className="font-display text-xl font-semibold">Agents</h2>
        {agents.length === 0 && <p className="text-ink-muted">No agents yet.</p>}
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
              <ChatBox agentId={agent.id} test title={`Try ${agent.name} (test chat)`} />
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
    </section>
  );
}
