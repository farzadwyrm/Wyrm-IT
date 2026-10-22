"use client";

import { useRef, useState } from "react";
import { explainReason } from "@/lib/reasons";

interface Step {
  decision: string;
  outcome: string;
  reason: string;
  rule: string | null;
  tool: string | null;
}

interface Line {
  role: "customer" | "agent";
  text: string;
  /** Why the agent answered (test chats only). */
  trace?: Step[];
}

const ERRORS: Record<string, string> = {
  slow_down: "Too many messages. Please wait a few minutes.",
  forbidden: "You need access to this agent to test it.",
  unavailable: "This assistant isn't available right now.",
};

/** A small chat window that talks to /api/chat (used by the public page and "Try it"). */
export function ChatBox({
  agentId,
  test = false,
  draft = false,
  title,
}: {
  agentId: string;
  test?: boolean;
  /** Test chats only: answer with the unpublished settings. */
  draft?: boolean;
  title: string;
}) {
  const [lines, setLines] = useState<Line[]>([]);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const field = useRef<HTMLInputElement>(null);

  async function send(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const message = field.current?.value.trim() ?? "";
    if (!message || busy) return;
    setBusy(true);
    setError(null);
    setLines((l) => [...l, { role: "customer", text: message }]);
    if (field.current) field.current.value = "";
    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ agentId, conversationId, message, test, draft: test && draft }),
      });
      const data = (await response.json()) as {
        reply?: string;
        conversationId?: string;
        error?: string;
        trace?: Step[];
      };
      if (!response.ok || !data.reply) {
        setError(ERRORS[data.error ?? ""] ?? "Something went wrong. Try again.");
      } else {
        setConversationId(data.conversationId ?? null);
        setLines((l) => [
          ...l,
          {
            role: "agent",
            text: data.reply as string,
            ...(data.trace ? { trace: data.trace } : {}),
          },
        ]);
      }
    } catch {
      setError("Couldn't reach the assistant. Check your connection.");
    } finally {
      setBusy(false);
      field.current?.focus();
    }
  }

  return (
    <section
      aria-label={title}
      className="flex flex-col rounded-2xl border border-line bg-paper-raised/80"
    >
      <div className="flex items-center justify-between gap-2 border-b border-line px-4 py-3">
        <h2 className="font-semibold">{title}</h2>
        {test && lines.length > 0 && (
          <button
            type="button"
            onClick={() => {
              setLines([]);
              setConversationId(null);
              setError(null);
            }}
            className="text-sm font-semibold text-ember hover:underline"
          >
            Restart
          </button>
        )}
      </div>
      <ol aria-live="polite" className="flex max-h-96 min-h-40 flex-col gap-2 overflow-y-auto p-4">
        {lines.length === 0 && <li className="text-sm text-ink-muted">Say hello to start.</li>}
        {lines.map((line, i) => (
          <li
            // biome-ignore lint/suspicious/noArrayIndexKey: messages are append-only
            key={i}
            className={`max-w-[85%] whitespace-pre-wrap rounded-2xl px-3 py-2 ${
              line.role === "customer"
                ? "self-end bg-ember text-paper"
                : "self-start border border-line bg-paper"
            }`}
          >
            <span className="sr-only">{line.role === "customer" ? "You: " : "Assistant: "}</span>
            {line.text}
            {line.trace && line.trace.length > 0 && (
              <details className="mt-2 text-xs text-ink-muted">
                <summary className="cursor-pointer font-semibold">Why?</summary>
                <ol className="mt-1 space-y-1">
                  {line.trace.map((step, n) => (
                    // biome-ignore lint/suspicious/noArrayIndexKey: steps are fixed per reply
                    <li key={n}>
                      {explainReason(step.reason)}
                      {step.rule
                        ? ` (${step.rule.replace(/^limit:/, "limit: ").replace(/^procedure:/, "procedure: ")})`
                        : ""}
                    </li>
                  ))}
                </ol>
              </details>
            )}
          </li>
        ))}
        {busy && <li className="self-start text-sm text-ink-muted">Typing…</li>}
      </ol>
      {error && (
        <p
          role="alert"
          className="mx-4 mb-2 rounded-xl border border-node-output/50 bg-node-output/10 p-2 text-sm"
        >
          {error}
        </p>
      )}
      <form onSubmit={send} className="flex gap-2 border-t border-line p-3">
        <label htmlFor={`chat-${agentId}`} className="sr-only">
          Your message
        </label>
        <input
          id={`chat-${agentId}`}
          ref={field}
          maxLength={1000}
          autoComplete="off"
          className="min-h-11 flex-1 rounded-xl border border-line bg-paper px-3 outline-none focus-visible:border-ember"
          placeholder="Type a message"
        />
        <button
          type="submit"
          disabled={busy}
          className="min-h-11 rounded-lg bg-ember px-4 font-semibold text-paper hover:bg-ember-strong disabled:opacity-60"
        >
          Send
        </button>
      </form>
    </section>
  );
}
