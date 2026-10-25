import { createHmac, timingSafeEqual } from "node:crypto";
import { ForbiddenError } from "@wyrm/auth";
import { agents, approvals, conversations, leads } from "@wyrm/db";
import { and, eq } from "drizzle-orm";
import { type Ctx, DomainError, guarded } from "./context";
import { askKnowledge, type KnowledgeDeps } from "./knowledge";
import { listLeads } from "./leads";
import { agentGate, hashPayload } from "./operations";
import { handleCustomerMessage, INTERNAL_AGENT_TYPES, type RuntimeDeps } from "./runtime";

/**
 * Wyrm's agents as MCP tools (phase 0, docs/research/reports/Wyrm agents over MCP.md). Five
 * coarse tools; the business rules stay in Wyrm's engine. The caller is a signed-in member of
 * one organisation (from the OAuth token, never from tool arguments), so every tool runs with
 * that member's permissions. Conversation handles only work for the member who started them,
 * and a booking needs the person's confirmation and then staff approval.
 */

export const MCP_PROTOCOL_VERSIONS = ["2026-07-28", "2025-11-25", "2025-06-18", "2025-03-26"];
export const MCP_SERVER_INFO = { name: "wyrm", title: "Wyrm AI agents", version: "0.1.0" };
export const MCP_INSTRUCTIONS =
  "Wyrm's AI agents for this business. Use wyrm_sales_qualify to talk to the sales agent on a customer's behalf, wyrm_knowledge_ask for questions about the business's documents, wyrm_booking_request to request (never confirm) an appointment, wyrm_request_status to follow it up, and wyrm_leads_search (owners) to list qualified leads. Replies are AI-generated; say so when you pass them to a customer.";

export interface McpCaller {
  tenantId: string;
  userId: string;
}

export interface McpDeps {
  runtime: RuntimeDeps;
  knowledge: KnowledgeDeps;
  /** Signs booking confirmations (server secret, never sent to clients). */
  secret: string;
  now?: () => Date;
}

type Json = Record<string, unknown>;

const text = (s: unknown) => (typeof s === "string" ? s.trim() : "");
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

export const MCP_TOOLS = [
  {
    name: "wyrm_sales_qualify",
    title: "Talk to the sales agent",
    description:
      "Send one customer message to the business's sales agent and get its reply. It asks the business's qualifying questions; when they are answered it records a scored lead (hot, warm or not a fit). Pass back conversation_id to continue the same conversation.",
    inputSchema: {
      type: "object",
      properties: {
        message: { type: "string", description: "What the customer says.", maxLength: 1000 },
        conversation_id: {
          type: "string",
          description: "From the previous call, to continue the conversation.",
        },
      },
      required: ["message"],
      additionalProperties: false,
    },
    annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: false },
  },
  {
    name: "wyrm_knowledge_ask",
    title: "Ask the business's documents",
    description:
      "Answer a question from the business's own documents, with the sources used. Says so when the documents don't cover it.",
    inputSchema: {
      type: "object",
      properties: { question: { type: "string", maxLength: 1000 } },
      required: ["question"],
      additionalProperties: false,
    },
    annotations: { readOnlyHint: true, openWorldHint: false },
  },
  {
    name: "wyrm_booking_request",
    title: "Request an appointment",
    description:
      "Request an appointment. Nothing is booked by this tool: the first call returns a summary and a confirm_token. Read the summary back to the person; only if they clearly say yes, call again with the same details plus confirm_token. The request then waits for the business's staff to approve it.",
    inputSchema: {
      type: "object",
      properties: {
        name: { type: "string", maxLength: 120 },
        contact: { type: "string", description: "Phone or email.", maxLength: 120 },
        service: { type: "string", maxLength: 120 },
        date: { type: "string", description: "YYYY-MM-DD", pattern: "^\\d{4}-\\d{2}-\\d{2}$" },
        time: { type: "string", description: "HH:MM (24h)", pattern: "^\\d{2}:\\d{2}$" },
        notes: { type: "string", maxLength: 500 },
        confirm_token: { type: "string" },
      },
      required: ["name", "contact", "service", "date", "time"],
      additionalProperties: false,
    },
    annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: false },
  },
  {
    name: "wyrm_request_status",
    title: "Check a request",
    description: "Status of a request made with wyrm_booking_request.",
    inputSchema: {
      type: "object",
      properties: { request_id: { type: "string" } },
      required: ["request_id"],
      additionalProperties: false,
    },
    annotations: { readOnlyHint: true, openWorldHint: false },
  },
  {
    name: "wyrm_leads_search",
    title: "List qualified leads",
    description:
      "Leads the sales agent qualified, newest first, with their answers and score. Business owners only.",
    inputSchema: {
      type: "object",
      properties: {
        bucket: { type: "string", enum: ["hot", "warm", "not_fit"] },
        status: { type: "string", enum: ["new", "contacted", "won", "lost"] },
        limit: { type: "integer", minimum: 1, maximum: 50 },
      },
      additionalProperties: false,
    },
    annotations: { readOnlyHint: true, openWorldHint: false },
  },
] as const;

export interface ToolResult {
  content: { type: "text"; text: string }[];
  structuredContent?: Json;
  isError?: boolean;
}

const ok = (summary: string, data: Json): ToolResult => ({
  content: [{ type: "text", text: `${summary}\n\n${JSON.stringify(data, null, 2)}` }],
  structuredContent: data,
});
const fail = (message: string): ToolResult => ({
  content: [{ type: "text", text: message }],
  isError: true,
});

async function agentOfType(ctx: Ctx, tenantId: string, types: string[]) {
  const rows = await ctx.db.select().from(agents).where(eq(agents.tenantId, tenantId));
  const usable = rows.filter((a) => types.includes(a.type));
  return usable.find((a) => a.status === "live") ?? usable[0] ?? null;
}

// --- Booking confirmations: signed, short-lived, bound to caller and details -----------------

const CONFIRM_SECONDS = 15 * 60;

function bookingHash(caller: McpCaller, details: Json) {
  return hashPayload({ tenant: caller.tenantId, user: caller.userId, ...details });
}

function signConfirm(secret: string, payloadHash: string, expires: number) {
  const body = `${payloadHash}.${expires}`;
  const sig = createHmac("sha256", secret).update(body).digest("base64url");
  return `${body}.${sig}`;
}

function checkConfirm(secret: string, token: string, payloadHash: string, now: Date) {
  const [hash, exp, sig] = token.split(".");
  if (!hash || !exp || !sig || hash !== payloadHash) return false;
  if (Number(exp) * 1000 < now.getTime()) return false;
  const expected = createHmac("sha256", secret).update(`${hash}.${exp}`).digest("base64url");
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

// --- Tools ----------------------------------------------------------------------------------

async function salesQualify(ctx: Ctx, caller: McpCaller, args: Json, deps: McpDeps) {
  const message = text(args.message).slice(0, 1000);
  if (!message) return fail("message is required.");
  const agent = await agentOfType(ctx, caller.tenantId, ["sales"]);
  if (!agent) return fail("This business has no sales agent.");
  agentGate(ctx, "agents.use", caller.tenantId, agent.id);
  const ref = `mcp:${caller.userId}`;
  const conversationId = text(args.conversation_id);
  if (conversationId) {
    // Handles only work for the member who started the conversation, in this organisation.
    const [mine] = UUID.test(conversationId)
      ? await ctx.db
          .select({ id: conversations.id })
          .from(conversations)
          .where(
            and(
              eq(conversations.id, conversationId),
              eq(conversations.tenantId, caller.tenantId),
              eq(conversations.customerRef, ref),
            ),
          )
      : [];
    if (!mine) return fail("Unknown conversation_id. Start a new conversation without it.");
  }
  // A draft agent can still be tried by its team; those leads are marked as tests.
  const test = agent.status !== "live";
  const result = await handleCustomerMessage(ctx.db, deps.runtime, {
    agentId: agent.id,
    conversationId: conversationId || null,
    text: message,
    channel: "web_chat",
    test,
    customerLabel: "Via an AI app (MCP)",
    customerRef: ref,
    ...(deps.now ? { now: deps.now() } : {}),
  });
  if (result.status !== "ok") return fail("The sales agent isn't available right now.");
  const [lead] = await ctx.db
    .select()
    .from(leads)
    .where(
      and(eq(leads.conversationId, result.conversationId), eq(leads.tenantId, caller.tenantId)),
    );
  return ok(result.reply, {
    conversation_id: result.conversationId,
    reply: result.reply,
    ai_generated: true,
    test_mode: test,
    finished: Boolean(lead),
    ...(lead ? { lead: { bucket: lead.bucket, score: lead.score, name: lead.name } } : {}),
  });
}

async function knowledgeAsk(ctx: Ctx, caller: McpCaller, args: Json, deps: McpDeps) {
  const question = text(args.question).slice(0, 1000);
  if (question.length < 2) return fail("question is required.");
  const agent = await agentOfType(ctx, caller.tenantId, INTERNAL_AGENT_TYPES as string[]);
  if (!agent) return fail("This business has no documents agent.");
  const answer = await askKnowledge(
    ctx,
    { tenantId: caller.tenantId, agentId: agent.id, question },
    deps.knowledge,
  );
  return ok(answer.reply, {
    answer: answer.reply,
    answered: answer.answered,
    ai_generated: true,
    sources: answer.citations.map((c) => ({ n: c.n, location: c.location, excerpt: c.excerpt })),
  });
}

async function bookingRequest(ctx: Ctx, caller: McpCaller, args: Json, deps: McpDeps) {
  const details = {
    name: text(args.name).slice(0, 120),
    contact: text(args.contact).slice(0, 120),
    service: text(args.service).slice(0, 120),
    date: text(args.date),
    time: text(args.time),
    notes: text(args.notes).slice(0, 500),
  };
  if (!details.name || !details.contact || !details.service)
    return fail("name, contact and service are required.");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(details.date) || !/^\d{2}:\d{2}$/.test(details.time))
    return fail("date must be YYYY-MM-DD and time HH:MM.");
  const agent = await agentOfType(ctx, caller.tenantId, ["receptionist", "scheduling", "sales"]);
  if (!agent) return fail("This business has no agent that takes bookings.");
  agentGate(ctx, "agents.use", caller.tenantId, agent.id);
  const now = deps.now?.() ?? new Date();
  const payloadHash = bookingHash(caller, details);
  const summary =
    `${details.service} for ${details.name} on ${details.date} at ${details.time} (${details.contact})`.slice(
      0,
      480,
    );
  const token = text(args.confirm_token);
  if (!token) {
    const expires = Math.floor(now.getTime() / 1000) + CONFIRM_SECONDS;
    return ok(
      `Please read this back to the person and ask them to confirm: ${summary}. Nothing is booked yet.`,
      {
        status: "needs_confirmation",
        summary,
        confirm_token: signConfirm(deps.secret, payloadHash, expires),
        expires_in_seconds: CONFIRM_SECONDS,
      },
    );
  }
  if (!checkConfirm(deps.secret, token, payloadHash, now))
    return fail(
      "The confirmation doesn't match these details or has expired. Call again without confirm_token.",
    );
  const [existing] = await ctx.db
    .select()
    .from(approvals)
    .where(
      and(
        eq(approvals.tenantId, caller.tenantId),
        eq(approvals.action, "booking.request"),
        eq(approvals.payloadHash, payloadHash),
        eq(approvals.status, "pending"),
      ),
    );
  const [row] = existing
    ? [existing]
    : await guarded(() =>
        ctx.db
          .insert(approvals)
          .values({
            tenantId: caller.tenantId,
            agentId: agent.id,
            action: "booking.request",
            riskTier: 2,
            summary: `Booking request (via AI app): ${summary}`.slice(0, 500),
            payload: { ...details, via: "mcp", requestedBy: caller.userId },
            payloadHash,
            requestedAt: now,
            expiresAt: new Date(now.getTime() + 7 * 86_400_000),
          })
          .returning(),
      );
  if (!row) return fail("Couldn't save the request. Try again.");
  return ok(
    "Request sent. The business's staff will confirm it; nothing is booked until they do.",
    { status: "pending_staff_approval", request_id: row.id, summary },
  );
}

const STATUS_TEXT: Record<string, string> = {
  pending: "Waiting for the business's staff to approve.",
  approved: "Approved by the business.",
  rejected: "Declined by the business.",
  expired: "Expired without a decision.",
  executed: "Done.",
};

async function requestStatus(ctx: Ctx, caller: McpCaller, args: Json) {
  const id = text(args.request_id);
  const [row] = UUID.test(id)
    ? await ctx.db
        .select()
        .from(approvals)
        .where(and(eq(approvals.id, id), eq(approvals.tenantId, caller.tenantId)))
    : [];
  if (!row) return fail("Unknown request_id.");
  if (row.agentId) agentGate(ctx, "agents.logs", caller.tenantId, row.agentId);
  return ok(STATUS_TEXT[row.status] ?? row.status, {
    request_id: row.id,
    status: row.status,
    summary: row.summary,
    ...(row.status === "rejected" && row.decisionReason ? { reason: row.decisionReason } : {}),
  });
}

async function leadsSearch(ctx: Ctx, caller: McpCaller, args: Json) {
  const actor = ctx.actor;
  if (actor?.kind !== "tenant" || actor.role.key !== "owner")
    return fail("Only the business owner can list leads.");
  const rows = await listLeads(ctx, caller.tenantId, { limit: 200 });
  const bucket = text(args.bucket);
  const status = text(args.status);
  const limit = Math.min(Math.max(Number(args.limit) || 20, 1), 50);
  const found = rows
    .filter((l) => (!bucket || l.bucket === bucket) && (!status || l.status === status))
    .slice(0, limit);
  return ok(`${found.length} lead${found.length === 1 ? "" : "s"}.`, {
    leads: found.map((l) => ({
      name: l.name,
      contact: l.contact,
      bucket: l.bucket,
      score: l.score,
      status: l.status,
      answers: l.answers,
      created_at: l.createdAt.toISOString(),
    })),
  });
}

/** Runs one tool for the caller. Domain and permission errors become tool errors. */
export async function callMcpTool(
  ctx: Ctx,
  caller: McpCaller,
  name: string,
  args: Json,
  deps: McpDeps,
): Promise<ToolResult> {
  try {
    switch (name) {
      case "wyrm_sales_qualify":
        return await salesQualify(ctx, caller, args, deps);
      case "wyrm_knowledge_ask":
        return await knowledgeAsk(ctx, caller, args, deps);
      case "wyrm_booking_request":
        return await bookingRequest(ctx, caller, args, deps);
      case "wyrm_request_status":
        return await requestStatus(ctx, caller, args);
      case "wyrm_leads_search":
        return await leadsSearch(ctx, caller, args);
      default:
        return fail(`Unknown tool: ${name.slice(0, 60)}`);
    }
  } catch (e) {
    if (e instanceof DomainError) return fail(e.message);
    if (e instanceof ForbiddenError) return fail("You don't have permission to use this agent.");
    throw e;
  }
}

// --- JSON-RPC (Streamable HTTP, stateless: every request stands alone) -----------------------

export type RpcResponse =
  | { jsonrpc: "2.0"; id: string | number | null; result: unknown }
  | { jsonrpc: "2.0"; id: string | number | null; error: { code: number; message: string } };

const rpcError = (id: string | number | null, code: number, message: string): RpcResponse => ({
  jsonrpc: "2.0",
  id,
  error: { code, message },
});

function serverDescription(requested: unknown) {
  const version =
    typeof requested === "string" && MCP_PROTOCOL_VERSIONS.includes(requested)
      ? requested
      : MCP_PROTOCOL_VERSIONS[0];
  return {
    protocolVersion: version,
    capabilities: { tools: { listChanged: false } },
    serverInfo: MCP_SERVER_INFO,
    instructions: MCP_INSTRUCTIONS,
  };
}

/** One JSON-RPC message. Returns null for notifications (HTTP 202, no body). */
export async function handleMcpMessage(
  ctx: Ctx,
  caller: McpCaller,
  message: unknown,
  deps: McpDeps,
): Promise<RpcResponse | null> {
  const m = (message ?? {}) as { jsonrpc?: unknown; id?: unknown; method?: unknown; params?: Json };
  if (m.jsonrpc !== "2.0" || typeof m.method !== "string")
    return rpcError(null, -32600, "Invalid request");
  const isNotification = m.id === undefined;
  if (isNotification) return null;
  const id = typeof m.id === "string" || typeof m.id === "number" ? m.id : null;
  const params = (m.params ?? {}) as Json;
  switch (m.method) {
    case "initialize":
      return { jsonrpc: "2.0", id, result: serverDescription(params.protocolVersion) };
    case "server/discover":
      return { jsonrpc: "2.0", id, result: serverDescription(params.protocolVersion) };
    case "ping":
      return { jsonrpc: "2.0", id, result: {} };
    case "tools/list":
      return { jsonrpc: "2.0", id, result: { tools: MCP_TOOLS } };
    case "tools/call": {
      const name = typeof params.name === "string" ? params.name : "";
      const args = (params.arguments ?? {}) as Json;
      return { jsonrpc: "2.0", id, result: await callMcpTool(ctx, caller, name, args, deps) };
    }
    default:
      return rpcError(id, -32601, "Method not found");
  }
}

/** The caller's actor must be an active member of the token's organisation. */
export function assertMcpActor(ctx: Ctx, caller: McpCaller) {
  const actor = ctx.actor;
  if (
    actor?.kind !== "tenant" ||
    actor.tenantId !== caller.tenantId ||
    actor.userId !== caller.userId ||
    !actor.active ||
    !actor.tenantActive
  )
    throw new DomainError("forbidden", "This login can't use this organisation's agents.");
}
