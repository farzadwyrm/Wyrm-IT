import type Anthropic from "@anthropic-ai/sdk";
import { answerSimpleQuestion } from "@wyrm/receptionist";
import type Groq from "groq-sdk";
import { type AgentInput, type AgentOutcome, runReceptionistTurn } from "./agent";
import { runGroqReceptionistTurn } from "./groq-agent";

/** True when at least one AI provider is configured on the server. */
export function isAnyReceptionistAiConfigured(
  env: Record<string, string | undefined> = process.env,
) {
  return Boolean(env.ANTHROPIC_API_KEY || env.GROQ_API_KEY);
}

/**
 * The provider chain for the receptionist: Claude when a key exists (best quality), then the
 * free open models on Groq, then `unavailable` so the page falls back to the basic receptionist.
 * A provider that fails is skipped for this turn; the next one answers.
 */
export async function runReceptionist(
  input: AgentInput,
  options: {
    claude?: { client?: Anthropic; apiKey?: string | undefined };
    groq?: { client?: Groq; apiKey?: string | undefined; clock?: () => number };
  } = {},
): Promise<AgentOutcome> {
  // Cheapest path first: a short, plain question needs no model call at all.
  const latest = input.history.at(-1);
  if (latest?.role === "visitor" && !input.pending) {
    const instant = answerSimpleQuestion(latest.text, input.now, input.profile);
    if (instant)
      return { status: "ok", text: instant, events: [], costCents: 0, provider: "instant" };
  }

  let costCents = 0;
  const claude = await runReceptionistTurn(input, options.claude ?? {});
  if (claude.status === "ok") return claude;
  costCents += claude.costCents;

  const groq = await runGroqReceptionistTurn(input, options.groq ?? {});
  if (groq.status === "ok") return { ...groq, costCents: costCents + groq.costCents };

  const bothMissing = claude.reason === "not_configured" && groq.reason === "not_configured";
  return {
    status: "unavailable",
    reason: bothMissing
      ? "not_configured"
      : groq.reason === "not_configured"
        ? claude.reason
        : groq.reason,
    costCents,
  };
}
