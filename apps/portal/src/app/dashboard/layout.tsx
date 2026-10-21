import { homeMetrics } from "@wyrm/core";
import type { ReactNode } from "react";
import { coreContext, getAccess } from "@/lib/auth";
import { endViewAsAction } from "../admin/actions";
import { DashboardNav } from "./nav";

/**
 * Client-area frame. The navigation only shows for customer staff; every page still checks
 * access itself (`requireTenant`), since layouts are not a security boundary.
 */
export default async function DashboardLayout({ children }: { children: ReactNode }) {
  const access = await getAccess();
  const actor = access?.actor;
  const me = actor?.kind === "tenant" ? actor : actor?.kind === "impersonating" ? actor.as : null;
  let todo = 0;
  if (access && me) {
    try {
      todo = (await homeMetrics(await coreContext(access), me.tenantId)).needsAttention;
    } catch {
      todo = 0;
    }
  }
  return (
    <div className="space-y-8">
      {actor?.kind === "impersonating" && (
        <p role="status" className="rounded-xl border border-signal/60 bg-signal/10 p-3 text-sm">
          Wyrm staff view{actor.readOnly ? " (view only)" : ""}: you're seeing the portal as this
          client's team member. The session is logged in their activity log and ends at{" "}
          {actor.expiresAt.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}.{" "}
          <button type="submit" form="end-view-as" className="font-semibold text-ember underline">
            End now
          </button>
        </p>
      )}
      {actor?.kind === "impersonating" && <form id="end-view-as" action={endViewAsAction} />}
      {me && <DashboardNav todo={todo} />}
      {children}
    </div>
  );
}
