import { listAgents } from "@wyrm/core";
import Link from "next/link";
import { coreContext, requireAccess } from "@/lib/auth";

export default async function DashboardPage() {
  const access = await requireAccess();
  const tenantActor = access.actor?.kind === "tenant" ? access.actor : null;
  const agents = tenantActor ? await listAgents(await coreContext(access)) : [];
  const current = access.tenants.find((t) => t.tenantId === tenantActor?.tenantId);

  let message: string | null = null;
  if (!access.dbReady)
    message = "The portal can't reach its database right now. Try again shortly.";
  else if (access.isAdmin) message = "You're Wyrm staff. Manage clients in Admin.";
  else if (!tenantActor)
    message =
      "Your account has no active organisation. If your organisation was suspended, contact your Wyrm contact.";

  return (
    <section>
      <p className="font-mono text-xs uppercase tracking-[0.2em] text-signal">dashboard</p>
      <h1 className="mt-3 font-display text-3xl font-semibold tracking-tight">
        {current ? current.name : "Welcome back"}
      </h1>
      {current && <p className="mt-1 text-ink-muted">Signed in as {current.roleName}</p>}

      {message ? (
        <p className="mt-6 max-w-xl text-ink-muted">{message}</p>
      ) : (
        <div className="mt-8">
          <h2 className="font-display text-xl font-semibold">Your agents</h2>
          {agents.length === 0 ? (
            <p className="mt-3 text-ink-muted">No agents shared with you yet.</p>
          ) : (
            <ul className="mt-4 grid gap-4 sm:grid-cols-2">
              {agents.map(({ agent }) => (
                <li
                  key={agent.id}
                  className="rounded-2xl border border-line bg-paper-raised/80 p-6"
                >
                  <p className="font-display text-lg font-semibold">{agent.name}</p>
                  <p className="mt-1 font-mono text-xs text-ink-muted">
                    {agent.type} · {agent.status}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </div>
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
