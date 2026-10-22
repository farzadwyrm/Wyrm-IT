import { createDemoGuard } from "@wyrm/ai";
import { check } from "@wyrm/auth";
import type { Policy } from "@wyrm/brain";
import { draftPolicy, handleCustomerMessage, publicAgent } from "@wyrm/core";
import { type NextRequest, NextResponse } from "next/server";
import { coreContext, getAccess } from "@/lib/auth";
import { serverDb } from "@/lib/db";
import { modelDeps } from "@/lib/models";

/**
 * Customer chat with an organisation's agents, through the main brain. Public for live agents
 * (website chat); staff may also test draft agents from the portal ("Try it").
 * Abuse limits: 60 messages an hour per IP here, plus each organisation's AI budget in the brain.
 */

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const guard = createDemoGuard({ dailyBudgetCents: 500, requestsPerVisitorPerHour: 60 });
const json = (body: unknown, status = 200) =>
  NextResponse.json(body, { status, headers: { "Cache-Control": "no-store" } });

export async function POST(request: NextRequest) {
  const db = serverDb();
  if (!db) return json({ error: "unavailable" }, 503);

  let body: {
    agentId?: unknown;
    conversationId?: unknown;
    message?: unknown;
    test?: unknown;
    draft?: unknown;
  };
  try {
    body = await request.json();
  } catch {
    return json({ error: "bad_request" }, 400);
  }
  const agentId = typeof body.agentId === "string" && UUID.test(body.agentId) ? body.agentId : null;
  const conversationId =
    typeof body.conversationId === "string" && UUID.test(body.conversationId)
      ? body.conversationId
      : null;
  const message = typeof body.message === "string" ? body.message.trim() : "";
  if (!agentId || message.length === 0 || message.length > 1000)
    return json({ error: "bad_request" }, 400);

  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  const allowed = guard.check(ip, 1);
  if (!allowed.allowed) return json({ error: "slow_down" }, 429);

  // Test mode only for signed-in staff who may use this agent.
  let test = false;
  // "Try your draft": the unpublished settings, for staff who may see them.
  let policy: Policy | null = null;
  if (body.test === true) {
    const access = await getAccess();
    const agent = await publicAgent(db, agentId);
    const actor = access?.actor ?? null;
    const permitted =
      agent &&
      actor &&
      (actor.kind === "platform"
        ? check(actor, "platform_agents.view").allowed
        : check(actor, "agents.use", { tenantId: agent.tenantId, agentId }).allowed);
    if (!permitted) return json({ error: "forbidden" }, 403);
    test = true;
    if (body.draft === true && access && agent) {
      try {
        policy = await draftPolicy(await coreContext(access), agent.tenantId, agentId);
      } catch {
        return json({ error: "forbidden" }, 403);
      }
    }
  }

  try {
    const result = await handleCustomerMessage(db, modelDeps().deps, {
      agentId,
      conversationId,
      text: message,
      channel: "web_chat",
      test,
      policy,
    });
    guard.record(ip, 0);
    if (result.status !== "ok") return json({ error: "unavailable" }, 404);
    // Staff testing see why the agent answered (decisions only: no other customer's data).
    const trace = test
      ? result.trace.map((r) => ({
          decision: r.decision,
          outcome: r.outcome,
          reason: r.reason,
          rule: r.ruleId,
          tool: r.tool,
        }))
      : undefined;
    return json({ conversationId: result.conversationId, reply: result.reply, trace });
  } catch (error) {
    console.error("chat failed", error instanceof Error ? error.message : error);
    return json({ error: "failed" }, 500);
  }
}
