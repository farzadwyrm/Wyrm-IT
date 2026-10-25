"use server";

import { ForbiddenError } from "@wyrm/auth";
import { DomainError, setLeadStatus } from "@wyrm/core";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireTenant } from "@/lib/portal";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

/** Moves a lead along: new, contacted, won or lost. */
export async function leadStatusAction(form: FormData) {
  const agentId = String(form.get("agentId") ?? "");
  const leadId = String(form.get("leadId") ?? "");
  const tests = form.get("tests") === "1" ? "&tests=1" : "";
  if (!UUID.test(agentId) || !UUID.test(leadId)) redirect("/dashboard");
  const page = await requireTenant();
  let error = "";
  if (page.readOnly) error = "read_only";
  else {
    try {
      await setLeadStatus(page.ctx, {
        tenantId: page.tenantId,
        leadId,
        status: String(form.get("status") ?? ""),
      });
    } catch (e) {
      if (e instanceof DomainError) error = e.code;
      else if (e instanceof ForbiddenError) error = "forbidden";
      else {
        console.error("lead status failed", e instanceof Error ? e.message : e);
        error = "unknown";
      }
    }
  }
  revalidatePath(`/dashboard/agents/${agentId}/leads`);
  redirect(
    `/dashboard/agents/${agentId}/leads?${error ? `error=${error}` : "notice=lead_saved"}${tests}`,
  );
}
