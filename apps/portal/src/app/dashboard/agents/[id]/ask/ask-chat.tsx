"use client";

import { useRef, useState } from "react";
import { askAction, rateAnswerAction } from "../documents/actions";

interface Citation {
  n: number;
  name: string;
  location: string | null;
  excerpt: string;
}

interface Turn {
  role: "user" | "agent";
  text: string;
  answered?: boolean;
  citations?: Citation[];
  questionId?: string | null;
  rated?: "up" | "down";
}

const ERRORS: Record<string, string> = {
  agent_paused: "This agent is paused. Ask whoever manages it to switch it back on.",
  forbidden: "You don't have access to ask this agent.",
  no_model: "The AI service is busy. Try again in a minute.",
  too_short: "Type a question first.",
};

/** Staff chat with the documents agent: answers with numbered sources you can open. */
export function AskChat({ agentId, examples }: { agentId: string; examples: string[] }) {
  const [turns, setTurns] = useState<Turn[]>([]);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const end = useRef<HTMLDivElement>(null);

  async function ask(question: string) {
    const q = question.trim();
    if (!q || busy) return;
    setBusy(true);
    setError(null);
    setText("");
    const history = turns.map((t) => ({ role: t.role, text: t.text }));
    setTurns((t) => [...t, { role: "user", text: q }]);
    const result = await askAction(agentId, q, history).catch(() => null);
    setBusy(false);
    if (!result?.ok) {
      setError(ERRORS[result?.error ?? ""] ?? "Something went wrong. Try again.");
      return;
    }
    const a = result.answer;
    setTurns((t) => [
      ...t,
      {
        role: "agent",
        text: a.reply,
        answered: a.answered,
        citations: a.citations,
        questionId: a.questionId,
      },
    ]);
    requestAnimationFrame(() => end.current?.scrollIntoView({ behavior: "smooth", block: "end" }));
  }

  async function rate(i: number, feedback: "up" | "down") {
    const id = turns[i]?.questionId;
    if (!id) return;
    setTurns((t) => t.map((x, j) => (j === i ? { ...x, rated: feedback } : x)));
    await rateAnswerAction(id, feedback);
  }

  return (
    <div className="flex min-h-[28rem] flex-col rounded-2xl border border-line bg-paper-raised/60">
      <div className="flex-1 space-y-4 p-4" aria-live="polite">
        {turns.length === 0 && (
          <div className="space-y-3 py-6 text-center">
            <p className="text-ink-muted">Ask anything your documents cover.</p>
            {examples.length > 0 && (
              <ul className="flex flex-wrap justify-center gap-2">
                {examples.map((e) => (
                  <li key={e}>
                    <button
                      type="button"
                      onClick={() => ask(e)}
                      className="min-h-11 rounded-full border border-line px-3 text-sm hover:border-ember"
                    >
                      {e}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
        {turns.map((t, i) =>
          t.role === "user" ? (
            <p
              // biome-ignore lint/suspicious/noArrayIndexKey: turns are append-only
              key={i}
              className="ml-auto max-w-[85%] rounded-2xl bg-ember px-4 py-2 text-paper"
            >
              {t.text}
            </p>
          ) : (
            // biome-ignore lint/suspicious/noArrayIndexKey: turns are append-only
            <div key={i} className="max-w-[92%] space-y-2">
              <div className="whitespace-pre-wrap rounded-2xl border border-line bg-paper px-4 py-3">
                {t.text}
              </div>
              {t.citations && t.citations.length > 0 && (
                <details className="text-sm">
                  <summary className="cursor-pointer text-ink-muted hover:text-ink">
                    Sources ({t.citations.length})
                  </summary>
                  <ol className="mt-2 space-y-2">
                    {t.citations.map((c) => (
                      <li key={c.n} className="rounded-xl border border-line p-3">
                        <p className="font-semibold">
                          [{c.n}]{" "}
                          {c.location?.startsWith("http") ? (
                            <a
                              href={c.location}
                              target="_blank"
                              rel="noreferrer noopener"
                              className="text-ember hover:underline"
                            >
                              {c.name}
                            </a>
                          ) : (
                            c.name
                          )}
                        </p>
                        <p className="mt-1 line-clamp-4 text-ink-muted">{c.excerpt}</p>
                      </li>
                    ))}
                  </ol>
                </details>
              )}
              {t.questionId && (
                <div className="flex items-center gap-2 text-xs text-ink-muted">
                  {t.rated ? (
                    <span>Thanks for the feedback.</span>
                  ) : (
                    <>
                      <span>Was this right?</span>
                      <button
                        type="button"
                        onClick={() => rate(i, "up")}
                        className="min-h-9 rounded-lg border border-line px-2 hover:border-moss"
                        aria-label="Yes, this answer was right"
                      >
                        👍
                      </button>
                      <button
                        type="button"
                        onClick={() => rate(i, "down")}
                        className="min-h-9 rounded-lg border border-line px-2 hover:border-node-output"
                        aria-label="No, this answer was wrong"
                      >
                        👎
                      </button>
                    </>
                  )}
                </div>
              )}
            </div>
          ),
        )}
        {busy && <p className="text-sm text-ink-muted">Searching your documents…</p>}
        {error && (
          <p role="alert" className="text-sm text-node-output">
            {error}
          </p>
        )}
        <div ref={end} />
      </div>
      <form
        className="flex gap-2 border-t border-line p-3"
        onSubmit={(e) => {
          e.preventDefault();
          ask(text);
        }}
      >
        <label className="sr-only" htmlFor="ask-input">
          Your question
        </label>
        <input
          id="ask-input"
          value={text}
          onChange={(e) => setText(e.target.value)}
          maxLength={1000}
          placeholder="e.g. How many holiday days do we get?"
          className="min-h-11 flex-1 rounded-xl border border-line bg-paper px-3 outline-none focus-visible:border-ember"
        />
        <button
          type="submit"
          disabled={busy || !text.trim()}
          className="inline-flex min-h-11 items-center rounded-lg bg-ember px-4 font-semibold text-paper hover:bg-ember-strong disabled:opacity-60"
        >
          Ask
        </button>
      </form>
    </div>
  );
}
