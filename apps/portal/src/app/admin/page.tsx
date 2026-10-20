import type { Metadata } from "next";
import { requireAdmin } from "@/lib/auth";
import { userClient } from "@/lib/supabase/server";
import { createClientOrg } from "./actions";

export const metadata: Metadata = { title: "Admin" };

const input =
  "w-full rounded-xl border border-line bg-paper px-4 py-2.5 outline-none focus-visible:border-ember";

export default async function AdminPage({ searchParams }: PageProps<"/admin">) {
  await requireAdmin();
  const params = await searchParams;
  const supabase = await userClient();
  // Admins see every organisation through row-level security; no secret key needed to read.
  const { data: orgs } = supabase
    ? await supabase
        .from("organizations")
        .select("id, name, slug, plan, created_at, memberships(count), agents(status)")
        .order("created_at", { ascending: false })
    : { data: [] };

  return (
    <section className="space-y-10">
      <div>
        <p className="font-mono text-xs uppercase tracking-[0.2em] text-signal">admin</p>
        <h1 className="mt-3 font-display text-3xl font-semibold tracking-tight">Clients</h1>
      </div>

      {typeof params.created === "string" && (
        <p role="status" className="rounded-xl border border-moss/50 bg-moss/10 p-4">
          Client "{params.created}" created and the owner has been invited by email.
        </p>
      )}
      {typeof params.error === "string" && (
        <p role="alert" className="rounded-xl border border-node-output/50 bg-node-output/10 p-4">
          {params.error}
        </p>
      )}

      <div className="overflow-x-auto rounded-2xl border border-line">
        <table className="w-full min-w-[560px] text-left text-sm">
          <thead className="bg-paper-raised font-mono text-[11px] uppercase tracking-wider text-ink-muted">
            <tr>
              <th scope="col" className="px-4 py-3">
                Business
              </th>
              <th scope="col" className="px-4 py-3">
                Plan
              </th>
              <th scope="col" className="px-4 py-3">
                People
              </th>
              <th scope="col" className="px-4 py-3">
                Agents
              </th>
            </tr>
          </thead>
          <tbody>
            {(orgs ?? []).length === 0 && (
              <tr>
                <td colSpan={4} className="px-4 py-6 text-ink-muted">
                  No clients yet.
                </td>
              </tr>
            )}
            {(orgs ?? []).map((org) => {
              const people = (org.memberships as unknown as { count: number }[])?.[0]?.count ?? 0;
              const agents = (org.agents as unknown as { status: string }[]) ?? [];
              return (
                <tr key={org.id} className="border-t border-line">
                  <td className="px-4 py-3">
                    <p className="font-semibold">{org.name}</p>
                    <p className="font-mono text-xs text-ink-muted">{org.slug}</p>
                  </td>
                  <td className="px-4 py-3">{org.plan}</td>
                  <td className="px-4 py-3">{people}</td>
                  <td className="px-4 py-3">{agents.map((a) => a.status).join(", ") || "none"}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <form
        action={createClientOrg}
        className="max-w-lg space-y-4 rounded-2xl border border-line bg-paper-raised/80 p-6"
      >
        <h2 className="font-display text-xl font-semibold">New client</h2>
        <div className="space-y-1">
          <label htmlFor="name" className="text-sm font-semibold">
            Business name
          </label>
          <input id="name" name="name" required maxLength={120} className={input} />
        </div>
        <div className="space-y-1">
          <label htmlFor="slug" className="text-sm font-semibold">
            Short name (optional)
          </label>
          <input
            id="slug"
            name="slug"
            maxLength={60}
            placeholder="made from the name"
            className={input}
          />
        </div>
        <div className="space-y-1">
          <label htmlFor="ownerEmail" className="text-sm font-semibold">
            Owner's email
          </label>
          <input id="ownerEmail" name="ownerEmail" type="email" required className={input} />
        </div>
        <p className="text-sm text-ink-muted">
          Creates the business with a draft receptionist and emails the owner an invitation.
        </p>
        <button
          type="submit"
          className="rounded-lg bg-ember px-5 py-2.5 font-semibold text-paper hover:bg-ember-strong"
        >
          Create client and invite owner
        </button>
      </form>
    </section>
  );
}
