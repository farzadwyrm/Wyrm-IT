import { LEAD_STATUSES, leads } from "@wyrm/db";
import { and, desc, eq, inArray, type SQL, sql } from "drizzle-orm";
import { audit } from "./audit";
import { type Ctx, DomainError } from "./context";
import { agentGate, visibleAgentIds } from "./operations";

/**
 * Leads from sales agents (0010). The agent collects the answers and code scores them; the team
 * moves each lead along (new, contacted, won, lost). Visible to whoever may see the agent's
 * conversations; status changes need permission to use the agent.
 */

export type LeadStatus = (typeof LEAD_STATUSES)[number];

export async function listLeads(
  ctx: Ctx,
  tenantId: string,
  filter: { agentId?: string; includeTests?: boolean; limit?: number } = {},
) {
  const ids = visibleAgentIds(ctx, tenantId);
  if (filter.agentId) agentGate(ctx, "agents.logs", tenantId, filter.agentId);
  const where: (SQL | undefined)[] = [
    eq(leads.tenantId, tenantId),
    filter.agentId ? eq(leads.agentId, filter.agentId) : undefined,
    ids === null ? undefined : ids.length ? inArray(leads.agentId, ids) : sql`false`,
    filter.includeTests ? undefined : eq(leads.isTest, false),
  ];
  return ctx.db
    .select()
    .from(leads)
    .where(and(...where))
    .orderBy(desc(leads.createdAt))
    .limit(Math.min(filter.limit ?? 100, 200));
}

export async function setLeadStatus(
  ctx: Ctx,
  input: { tenantId: string; leadId: string; status: string },
) {
  if (!LEAD_STATUSES.includes(input.status as LeadStatus))
    throw new DomainError("bad_status", "Unknown lead status.");
  const [lead] = await ctx.db
    .select()
    .from(leads)
    .where(and(eq(leads.id, input.leadId), eq(leads.tenantId, input.tenantId)));
  if (!lead?.agentId) throw new DomainError("not_found", "Lead not found.");
  agentGate(ctx, "agents.use", input.tenantId, lead.agentId);
  const actor = ctx.actor;
  await ctx.db
    .update(leads)
    .set({
      status: input.status as LeadStatus,
      updatedBy: actor?.kind === "platform" || actor?.kind === "tenant" ? actor.userId : null,
    })
    .where(eq(leads.id, lead.id));
  await audit(ctx, {
    action: "lead.status_changed",
    tenantId: input.tenantId,
    targetType: "lead",
    targetId: lead.id,
    before: { status: lead.status },
    after: { status: input.status },
  });
}
