import Link from "next/link";
import { requireAccess } from "@/lib/auth";

export default async function DashboardPage() {
  const access = await requireAccess();

  return (
    <section>
      <p className="font-mono text-xs uppercase tracking-[0.2em] text-signal">dashboard</p>
      <h1 className="mt-3 font-display text-3xl font-semibold tracking-tight">Welcome back</h1>

      {access.orgs.length === 0 ? (
        <p className="mt-6 max-w-xl text-ink-muted">
          {access.isAdmin
            ? "You're Wyrm staff. Create a client in Admin to get started."
            : "Your account isn't linked to a business yet. Your Wyrm contact will set this up."}
        </p>
      ) : (
        <ul className="mt-8 grid gap-4 sm:grid-cols-2">
          {access.orgs.map((org) => (
            <li key={org.orgId} className="rounded-2xl border border-line bg-paper-raised/80 p-6">
              <p className="font-display text-xl font-semibold">{org.name}</p>
              <p className="mt-1 font-mono text-xs text-ink-muted">
                {org.role === "owner" ? "owner" : "team member"}
              </p>
              <p className="mt-4 text-sm text-ink-muted">
                Conversations, bookings and settings will appear here as your agents go live.
              </p>
            </li>
          ))}
        </ul>
      )}

      {access.isAdmin && (
        <p className="mt-10">
          <Link href="/admin" className="font-semibold text-ember hover:text-ember-strong">
            Go to admin →
          </Link>
        </p>
      )}
    </section>
  );
}
