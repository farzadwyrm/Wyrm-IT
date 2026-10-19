import Groq from "groq-sdk";
import type {
  ChatCompletionMessageParam,
  ChatCompletionTool,
} from "groq-sdk/resources/chat/completions";
import {
  type AgentInput,
  type AgentOutcome,
  CHANNEL_PROMPTS,
  type Channel,
  type ChatMessage,
  MAX_HISTORY,
  MAX_MESSAGE_CHARS,
  MAX_TOOL_ROUNDS,
  prepareTurn,
  RECEPTIONIST_SYSTEM_PROMPT,
  stateContext,
} from "./agent";
import { MAX_CORRECTIONS, reviewReply, safeReply } from "./reply-guard";
import { executeTool, type Proposal, RECEPTIONIST_TOOLS, type ToolEvent } from "./tools";

/**
 * The free "smart" receptionist: open models on Groq's free tier, tried in order. Each model has
 * its own daily allowance (about 1,000 requests / 200,000 tokens) and only 8,000 tokens a minute,
 * so when one is rate-limited the next one answers. Booking safety is identical to the Claude
 * agent because both use the same tools and checks (`tools.ts`).
 */
export interface GroqModel {
  id: string;
  /** Model-specific settings that hide internal reasoning from the reply. */
  params: {
    include_reasoning?: boolean;
    reasoning_format?: "hidden";
    reasoning_effort?: "none" | "low";
    parallel_tool_calls?: boolean;
  };
}

export const GROQ_MODELS: readonly GroqModel[] = [
  { id: "openai/gpt-oss-120b", params: { include_reasoning: false, reasoning_effort: "low" } },
  {
    id: "qwen/qwen3.8-27b",
    params: { reasoning_format: "hidden", reasoning_effort: "none", parallel_tool_calls: false },
  },
  { id: "openai/gpt-oss-20b", params: { include_reasoning: false, reasoning_effort: "low" } },
];

/** Models that hit a rate limit rest until this time (ms since epoch). Per server instance. */
const restingUntil = new Map<string, number>();

export function resetGroqCooldowns(): void {
  restingUntil.clear();
}

const GROQ_TOOLS: ChatCompletionTool[] = RECEPTIONIST_TOOLS.map((tool) => ({
  type: "function",
  function: {
    name: tool.name,
    description: tool.description ?? "",
    parameters: tool.input_schema as Record<string, unknown>,
  },
}));

/** Removes any reasoning a model leaks into its visible text. */
export function stripReasoning(text: string): string {
  return text
    .replace(/<think>[\s\S]*?(<\/think>|$)/gi, "")
    .replace(/<\/?think>/gi, "")
    .trim();
}

function toMessages(history: readonly ChatMessage[], system: string): ChatCompletionMessageParam[] {
  const trimmed = history
    .slice(-MAX_HISTORY)
    .map((m) => ({ ...m, text: m.text.slice(0, MAX_MESSAGE_CHARS) }));
  const firstVisitor = trimmed.findIndex((m) => m.role === "visitor");
  const messages: ChatCompletionMessageParam[] = [{ role: "system", content: system }];
  for (const m of firstVisitor === -1 ? [] : trimmed.slice(firstVisitor)) {
    const role = m.role === "visitor" ? "user" : "assistant";
    const last = messages.at(-1);
    if (last && last.role === role && typeof last.content === "string") {
      last.content = `${last.content}\n${m.text}`;
    } else {
      messages.push({ role, content: m.text });
    }
  }
  return messages;
}

function statusOf(err: unknown): number | undefined {
  return typeof err === "object" && err !== null && "status" in err
    ? (err as { status?: number }).status
    : undefined;
}

function retryAfterMs(err: unknown): number {
  const headers = (err as { headers?: { get?: (name: string) => string | null } }).headers;
  const seconds = Number(headers?.get?.("retry-after"));
  return Number.isFinite(seconds) && seconds > 0 ? seconds * 1000 : 60_000;
}

type ModelResult =
  | { kind: "ok"; text: string; events: ToolEvent[] }
  | { kind: "rate_limited"; retryMs: number }
  | { kind: "failed" };

async function runWithModel(
  client: Groq,
  model: GroqModel,
  input: AgentInput,
  channel: Channel,
  latest: ChatMessage,
): Promise<ModelResult> {
  const prepared = prepareTurn(input, latest);
  const { bookings, events, justBooked } = prepared;
  let pending: Proposal | null = prepared.pending;
  const spoken: string[] = [];
  let corrections = 0;
  const system = `${RECEPTIONIST_SYSTEM_PROMPT}\n\n${CHANNEL_PROMPTS[channel]}\n\n${stateContext(input.now, channel, bookings, pending, justBooked)}`;
  const messages = toMessages(input.history, system);

  try {
    for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
      const response = await client.chat.completions.create({
        model: model.id,
        messages,
        tools: GROQ_TOOLS,
        tool_choice: "auto",
        temperature: 0.6,
        max_completion_tokens: 1024,
        ...model.params,
      });
      const message = response.choices[0]?.message;
      if (!message) return { kind: "failed" };

      const text = stripReasoning(message.content ?? "");
      if (text) spoken.push(text);

      const calls = message.tool_calls ?? [];
      if (calls.length === 0) {
        const reply = spoken.join(" ").trim();
        if (!reply) return { kind: "failed" };
        const issue = reviewReply(reply, { eventsThisTurn: events, pending, bookings });
        if (!issue) return { kind: "ok", text: reply, events };
        if (corrections >= MAX_CORRECTIONS) {
          console.warn(`groq ${model.id} reply replaced after failed correction: ${issue.kind}`);
          return { kind: "ok", text: safeReply(pending, bookings), events };
        }
        // Let the model fix its own reply once, before anything reaches the visitor.
        corrections++;
        spoken.length = 0;
        messages.push({ role: "assistant", content: text });
        messages.push({ role: "user", content: issue.correction });
        continue;
      }

      messages.push({ role: "assistant", content: message.content ?? "", tool_calls: calls });
      for (const call of calls) {
        let args: Record<string, unknown> = {};
        try {
          args = JSON.parse(call.function.arguments || "{}") as Record<string, unknown>;
        } catch {
          args = {};
        }
        const output = executeTool(call.function.name, args, {
          now: input.now,
          bookings,
          // Only a proposal from an earlier turn can be booked: never one made this turn.
          pendingFromEarlierTurn: prepared.bookablePending,
          latestVisitorMessage: latest.text,
        });
        const event = output.event;
        if (event) {
          events.push(event);
          if (event.type === "proposed") pending = event.proposal;
          if (event.type === "booked") {
            bookings.push(event.booking);
            pending = null;
          }
          if (event.type === "cancelled") {
            const index = bookings.findIndex((b) => b.reference === event.booking.reference);
            if (index >= 0) bookings.splice(index, 1);
          }
        }
        messages.push({ role: "tool", tool_call_id: call.id, content: output.content });
      }
    }
    return { kind: "failed" };
  } catch (err) {
    if (statusOf(err) === 429) return { kind: "rate_limited", retryMs: retryAfterMs(err) };
    console.error(`groq ${model.id} turn failed: ${statusOf(err) ?? "network"}`);
    return { kind: "failed" };
  }
}

/** One receptionist turn on Groq's free models. Never throws; free, so cost is always 0. */
/** Longest the receptionist waits for a free model's per-minute allowance to refill. */
export const MAX_GROQ_WAIT_MS = 10_000;

export async function runGroqReceptionistTurn(
  input: AgentInput,
  options: {
    client?: Groq;
    apiKey?: string | undefined;
    clock?: () => number;
    sleep?: (ms: number) => Promise<void>;
  } = {},
): Promise<AgentOutcome> {
  const apiKey = options.apiKey ?? process.env.GROQ_API_KEY;
  if (!options.client && !apiKey) {
    return { status: "unavailable", reason: "not_configured", costCents: 0 };
  }
  const client = options.client ?? new Groq({ apiKey, maxRetries: 0, timeout: 20_000 });
  const clock = options.clock ?? Date.now;
  const sleep = options.sleep ?? ((ms: number) => new Promise<void>((r) => setTimeout(r, ms)));
  const latest = input.history.at(-1);
  if (latest?.role !== "visitor") return { status: "unavailable", reason: "error", costCents: 0 };
  const channel = input.channel ?? "chat";

  // Two passes: if every model is only briefly rate-limited (the per-minute token allowance),
  // wait for the soonest one to refill instead of giving up.
  for (let pass = 0; pass < 2; pass++) {
    for (const model of GROQ_MODELS) {
      if ((restingUntil.get(model.id) ?? 0) > clock()) continue;
      const result = await runWithModel(client, model, input, channel, latest);
      if (result.kind === "ok") {
        return {
          status: "ok",
          text: result.text,
          events: result.events,
          costCents: 0,
          provider: "groq",
        };
      }
      if (result.kind === "rate_limited") {
        console.warn(
          `groq ${model.id} rate-limited; resting ${Math.round(result.retryMs / 1000)}s`,
        );
        restingUntil.set(model.id, clock() + result.retryMs);
      }
    }
    const resting = GROQ_MODELS.map((m) => restingUntil.get(m.id) ?? 0).filter((t) => t > clock());
    if (pass > 0 || resting.length === 0) break;
    const wait = Math.min(...resting) - clock();
    if (wait > MAX_GROQ_WAIT_MS) break;
    await sleep(wait + 250);
  }
  return { status: "unavailable", reason: "error", costCents: 0 };
}
