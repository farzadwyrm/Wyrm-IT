import { customerHealth, platformStats } from "@wyrm/core";
import type { Metadata } from "next";
import Link from "next/link";
import { coreContext, requireAdmin } from "@/lib/auth";
import { clientHealth, type HealthTone } from "@/lib/health";
import { money, when } from "@/lib/portal";
import { changeClientStatus, endViewAsAction } from "./actions";
import { CreateClientForm } from "./create-client-form";

export const metadata: Metadata = { title: "Back office" };

const TONE: Record<HealthTone, { dot: string; text: string }> = {
  bad: { dot: "bg-node-output", text: "text-node-output" },
  warn: { dot: "bg-signal", text: "text-signal" },
  plain: { dot: "bg-ink-muted", text: "text-ink-muted" },
  good: { dot: "bg-moss", text: "text-moss" },
};
const ORDER: Record<HealthTone, number> = { bad: 0, warn: 1, plain: 2, good: 3 };

/**
 * Wyrm's back office (staff only; clients never see it): every client's health, what needs us,
 * and the client list. Each client's page has sign-off, "view as" and their agents.
 */
export default async function AdminPage({ searchParams }: PageProps<"/admin">) {
  const access = await requireAdmin();
  if (access.actor?.kind === "impersonating") {
    return (
      <section className="max-w-xl space-y-4">
        <h1 className="font-display text-3xl font-semibold">You're viewing as a client</h1>
        <p className="text-ink-muted">End the "view as" session to use the back office again.</p>
        <form action={endViewAsAction}>
          <button
            type="submit"
            className="rounded-lg bg-ember px-5 py-2.5 font-semibold text-paper"
          >
            End view as
          </button>
        </form>
      </section>
    );
  }
  const query = await searchParams;
  const filter = typeof query.show === "string" ? query.show : "all";
  const ctx = await coreContext(access);
  // Each part has a time limit, so a slow query shows a notice instead of a blank page.
  const timed = <T,>(label: string, work: Promise<T>, fallback: T) =>
    Promise.race([
      work,
      new Promise<never>((_, reject) => setTimeout(() => reject(new Error(label)), 8000)),
    ]).catch((e: unknown) => {
      console.error("admin: part failed", label, e instanceof Error ? e.message : "unknown");
      degraded = true;
      return fallback;
    });
  let degraded = false;
  const started = Date.now();
  const [stats, rows] = await Promise.all([
    timed("platformStats", platformStats(ctx), {
      activeTenants: 0,
      suspendedTenants: 0,
      activeUsers: 0,
      liveAgents: 0,
      newTenantsThisWeek: 0,
      signupsThisWeek: 0,
    }),
    timed("customerHealth", customerHealth(ctx), []),
  ]);
  console.info("admin: loaded", { ms: Date.now() - started, clients: rows.length, degraded });
  const role = access.actor?.kind === "platform" ? access.actor.role.replace("_", " ") : "";
  const clients = rows
    .map((r) => ({ ...r, health: clientHealth(r) }))
    .sort((a, b) => ORDER[a.health.tone] - ORDER[b.health.tone] || a.name.localeCompare(b.name));
  const attention = clients.filter((c) => c.health.tone === "bad" || c.health.tone === "warn");
  const shown =
    filter === "attention"
      ? attention
      : filter === "setup"
        ? clients.filter((c) => c.liveAgents === 0 && c.status === "active")
        : clients;
  const sum = (k: "conversations7d" | "spendMonthMicros" | "handedOff7d") =>
    rows.reduce((t, r) => t + r[k], 0);

  const tiles = [
    ["Active clients", String(stats.activeTenants), `${stats.newTenantsThisWeek} new this week`],
    ["Live agents", String(stats.liveAgents), `${stats.suspendedTenants} clients suspended`],
    [
      "Conversations (7 days)",
      String(sum("conversations7d")),
      `${sum("handedOff7d")} handed to people`,
    ],
    ["AI spend this month", money(sum("spendMonthMicros")), "across all clients"],
  ] as const;

  return (
    <section className="space-y-8">
      <div>
        <p className="font-mono text-xs uppercase tracking-[0.2em] text-signal">
          Wyrm back office · {role}
        </p>
        <h1 className="mt-2 font-display text-3xl font-semibold tracking-tight">Clients</h1>
        <p className="mt-1 max-w-2xl text-ink-muted">
          Only Wyrm staff see this. Clients manage their own agents in their portal; here you watch
          every client, sign agents off for launch, and help when something breaks.
        </p>
      </div>

      <ul className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {tiles.map(([label, value, note]) => (
          <li key={label} className="rounded-2xl border border-line bg-paper-raised/80 p-4">
            <p className="text-sm text-ink-muted">{label}</p>
            <p className="mt-1 font-display text-3xl font-semibold">{value}</p>
            <p className="mt-1 text-xs text-ink-muted">{note}</p>
          </li>
        ))}
      </ul>

      {degraded && (
        <p role="alert" className="rounded-xl border border-signal/60 bg-signal/10 p-3 text-sm">
          Some numbers didn't load in time. Refresh in a minute; the client list may be incomplete.
        </p>
      )}

      <div className="space-y-3">
        <h2 className="font-display text-xl font-semibold">Needs you</h2>
        {attention.length === 0 ? (
          <p className="rounded-xl border border-moss/40 bg-moss/5 p-3 text-sm">
            <span aria-hidden="true" className="text-moss">
              ✓
            </span>{" "}
            Every client is fine.
          </p>
        ) : (
          <ul className="space-y-2">
            {attention.slice(0, 8).map((c) => (
              <li key={c.tenantId}>
                <Link
                  href={`/admin/tenants/${c.tenantId}`}
                  className="flex items-center justify-between gap-4 rounded-xl border border-line bg-paper-raised/60 p-3 text-sm hover:border-ink-muted"
                >
                  <span className="flex items-start gap-2">
                    <span
                      aria-hidden="true"
                      className={`mt-1.5 size-2 shrink-0 rounded-full ${TONE[c.health.tone].dot}`}
                    />
                    <span>
                      <strong>{c.name}</strong>
                      <span className="text-ink-muted"> · {c.health.issues.join(" · ")}</span>
                    </span>
                  </span>
                  <span className="shrink-0 font-semibold text-ember">Open →</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="font-display text-xl font-semibold">All clients</h2>
          <nav aria-label="Filter clients" className="flex gap-1 text-sm">
            {[
              ["all", `All (${clients.length})`],
              ["attention", `Needs you (${attention.length})`],
              ["setup", "Not live yet"],
            ].map(([key, label]) => (
              <Link
                key={key}
                href={key === "all" ? "/admin" : `/admin?show=${key}`}
                aria-current={filter === key ? "page" : undefined}
                className={`inline-flex min-h-9 items-center rounded-full border px-3 ${
                  filter === key
                    ? "border-ember text-ink"
                    : "border-line text-ink-muted hover:text-ink"
                }`}
              >
                {label}
              </Link>
            ))}
          </nav>
        </div>
        <div className="overflow-x-auto rounded-2xl border border-line">
          <table className="w-full min-w-[860px] text-left text-sm">
            <caption className="sr-only">{shown.length} clients</caption>
            <thead className="bg-paper-raised font-mono text-[11px] uppercase tracking-wider text-ink-muted">
              <tr>
                <th scope="col" className="px-4 py-3">
                  Client
                </th>
                <th scope="col" className="px-4 py-3">
                  Health
                </th>
                <th scope="col" className="px-4 py-3">
                  Agents live
                </th>
                <th scope="col" className="px-4 py-3 text-right">
                  Chats 7d
                </th>
                <th scope="col" className="px-4 py-3 text-right">
                  Waiting
                </th>
                <th scope="col" className="px-4 py-3">
                  AI spend / budget
                </th>
                <th scope="col" className="px-4 py-3">
                  Last chat
                </th>
                <th scope="col" className="px-4 py-3">
                  <span className="sr-only">Account</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {shown.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-4 py-6 text-ink-muted">
                    No clients here.
                  </td>
                </tr>
              )}
              {shown.map((c) => (
                <tr key={c.tenantId} className="border-t border-line hover:bg-paper-raised/60">
                  <td className="px-4 py-3">
                    <Link
                      href={`/admin/tenants/${c.tenantId}`}
                      className="font-semibold hover:text-ember"
                    >
                      {c.name}
                    </Link>
                    <p className="font-mono text-xs text-ink-muted">
                      {c.slug} · {c.plan}
                    </p>
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-flex items-center gap-1.5 font-semibold ${TONE[c.health.tone].text}`}
                      title={c.health.issues.join(" · ") || undefined}
                    >
                      <span
                        aria-hidden="true"
                        className={`size-2 rounded-full ${TONE[c.health.tone].dot}`}
                      />
                      {c.health.label}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    {c.liveAgents} of {c.agents}
                  </td>
                  <td className="px-4 py-3 text-right">{c.conversations7d}</td>
                  <td className="px-4 py-3 text-right">{c.waiting + c.pendingApprovals}</td>
                  <td className="px-4 py-3">
                    {money(c.spendMonthMicros)}{" "}
                    <span className="text-ink-muted">/ {money(c.budgetMicros)}</span>
                  </td>
                  <td className="px-4 py-3 text-ink-muted">
                    {c.lastConversationAt ? when(c.lastConversationAt) : "never"}
                  </td>
                  <td className="px-4 py-3">
                    <form action={changeClientStatus}>
                      <input type="hidden" name="tenantId" value={c.tenantId} />
                      <input
                        type="hidden"
                        name="status"
                        value={c.status === "active" ? "suspended" : "active"}
                      />
                      <button type="submit" className="text-xs text-ink-muted hover:text-ember">
                        {c.status === "active" ? "Suspend" : "Reactivate"}
                      </button>
                    </form>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <details className="rounded-2xl border border-line p-4">
        <summary className="cursor-pointer font-display text-lg font-semibold">
          Add a new client
        </summary>
        <div className="mt-4">
          <CreateClientForm />
        </div>
      </details>
    </section>
  );
}
