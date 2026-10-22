import { listAgentAccess, listStaff } from "@wyrm/core";
import type { TenantPage } from "@/lib/portal";
import { Card, input, secondary } from "../../../ui";
import { setAccessAction } from "./actions";

const LEVELS = [
  ["none", "No access"],
  ["view_logs", "See conversations"],
  ["use", "Use (ask questions, handle the inbox)"],
  ["configure", "Manage (change documents and settings)"],
] as const;

/**
 * Who can use this agent. Owners and admins see every agent; everyone else needs access here.
 * For a documents agent this is the permission boundary: only these people can ask it.
 */
export async function TeamAccess({ agentId, page }: { agentId: string; page: TenantPage }) {
  if (!page.can("agents.assign", agentId) || !page.can("staff.view")) return null;
  const [staff, access] = await Promise.all([
    listStaff(page.ctx, page.tenantId, { status: "active" }),
    listAgentAccess(page.ctx, page.tenantId, agentId),
  ]);
  const level = new Map(
    access.filter((a) => a.subjectType === "user").map((a) => [a.subjectId, a.level]),
  );
  const canEdit = !page.readOnly;

  return (
    <Card className="space-y-3">
      <h2 className="font-display text-xl font-semibold">Who can use this agent</h2>
      <p className="text-sm text-ink-muted">
        Owners and admins can use every agent. Choose access for everyone else. Keep sensitive
        documents (HR, finance) in their own agent and share it only with the right people.
      </p>
      <ul className="divide-y divide-line rounded-xl border border-line">
        {staff.map((s) => {
          const all = s.rolePermissions.includes("agents.view_all");
          return (
            <li
              key={s.id}
              className="flex flex-col gap-2 p-3 sm:flex-row sm:items-center sm:justify-between"
            >
              <span className="min-w-0">
                <span className="font-semibold break-all">{s.name || s.email}</span>
                <span className="block text-xs text-ink-muted">{s.roleName}</span>
              </span>
              {all ? (
                <span className="text-sm text-ink-muted">Every agent (by role)</span>
              ) : (
                <form action={setAccessAction} className="flex items-center gap-2">
                  <input type="hidden" name="agentId" value={agentId} />
                  <input type="hidden" name="tenantUserId" value={s.id} />
                  <label className="sr-only" htmlFor={`access-${s.id}`}>
                    Access for {s.email}
                  </label>
                  <select
                    id={`access-${s.id}`}
                    name="level"
                    defaultValue={level.get(s.id) ?? "none"}
                    disabled={!canEdit}
                    className={`${input} min-w-56 py-2`}
                  >
                    {LEVELS.map(([value, label]) => (
                      <option key={value} value={value}>
                        {label}
                      </option>
                    ))}
                  </select>
                  {canEdit && (
                    <button type="submit" className={secondary}>
                      Save
                    </button>
                  )}
                </form>
              )}
            </li>
          );
        })}
      </ul>
    </Card>
  );
}
