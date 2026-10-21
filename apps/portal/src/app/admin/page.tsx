import { listTenants, platformStats } from "@wyrm/core";
import type { Metadata } from "next";
import { coreContext, requireAdmin } from "@/lib/auth";
import { changeClientStatus } from "./actions";
import { CreateClientForm } from "./create-client-form";

export const metadata: Metadata = { title: "Admin" };

export default async function AdminPage() {
  const access = await requireAdmin();
  const ctx = await coreContext(access);
  const [stats, { rows, total }] = await Promise.all([
    platformStats(ctx),
    listTenants(ctx, { limit: 50 }),
  ]);
  const role = access.actor?.kind === "platform" ? access.actor.role.replace("_", " ") : "";

  const tiles = [
    ["Active clients", stats.activeTenants],
    ["Suspended", stats.suspendedTenants],
    ["Customer staff", stats.activeUsers],
    ["Live agents", stats.liveAgents],
  ] as const;

  return (
    <section className="space-y-10">
      <div>
        <p className="font-mono text-xs uppercase tracking-[0.2em] text-signal">admin · {role}</p>
        <h1 className="mt-3 font-display text-3xl font-semibold tracking-tight">Clients</h1>
      </div>

      <ul className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {tiles.map(([label, value]) => (
          <li key={label} className="rounded-2xl border border-line bg-paper-raised/80 p-4">
            <p className="text-sm text-ink-muted">{label}</p>
            <p className="mt-1 font-display text-2xl font-semibold">{value}</p>
          </li>
        ))}
      </ul>

      <div className="overflow-x-auto rounded-2xl border border-line">
        <table className="w-full min-w-[560px] text-left text-sm">
          <caption className="sr-only">{total} clients</caption>
          <thead className="bg-paper-raised font-mono text-[11px] uppercase tracking-wider text-ink-muted">
            <tr>
              <th scope="col" className="px-4 py-3">
                Business
              </th>
              <th scope="col" className="px-4 py-3">
                Plan
              </th>
              <th scope="col" className="px-4 py-3">
                Seats
              </th>
              <th scope="col" className="px-4 py-3">
                Status
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr>
                <td colSpan={4} className="px-4 py-6 text-ink-muted">
                  No clients yet.
                </td>
              </tr>
            )}
            {rows.map((t) => (
              <tr key={t.id} className="border-t border-line">
                <td className="px-4 py-3">
                  <p className="font-semibold">{t.name}</p>
                  <p className="font-mono text-xs text-ink-muted">{t.slug}</p>
                </td>
                <td className="px-4 py-3">{t.plan}</td>
                <td className="px-4 py-3">{t.seatLimit}</td>
                <td className="px-4 py-3">
                  <form action={changeClientStatus} className="flex items-center gap-3">
                    <input type="hidden" name="tenantId" value={t.id} />
                    <input
                      type="hidden"
                      name="status"
                      value={t.status === "active" ? "suspended" : "active"}
                    />
                    <span>{t.status}</span>
                    <button type="submit" className="text-ember hover:text-ember-strong">
                      {t.status === "active" ? "Suspend" : "Reactivate"}
                    </button>
                  </form>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <CreateClientForm />
    </section>
  );
}
