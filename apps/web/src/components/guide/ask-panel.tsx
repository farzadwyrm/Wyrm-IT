"use client";

import Link from "next/link";
import { type FormEvent, useCallback, useEffect, useId, useRef, useState } from "react";
import type { AskRequest, AskResponse } from "@/lib/ask-api";

interface Turn {
  id: number;
  role: "visitor" | "assistant";
  text: string;
  source?: { title: string; href: string } | null;
  failed?: boolean;
}

const GENERAL_STARTERS = [
  "Where should a 10-person company start?",
  "What happens if a laptop is stolen?",
  "Is it safe to use ChatGPT with client files?",
];

const AREA_STARTERS = [
  "What should we do first?",
  "What should I ask my IT person?",
  "How would I know we have a problem here?",
];

/** Shows "- item" / "• item" lines as a list and everything else as paragraphs. */
function AnswerText({ text }: { text: string }) {
  const blocks: (string | string[])[] = [];
  for (const line of text
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean)) {
    const item = /^[-•*]\s+(.*)$/.exec(line)?.[1];
    const last = blocks.at(-1);
    if (item !== undefined) {
      if (Array.isArray(last)) last.push(item);
      else blocks.push([item]);
    } else blocks.push(line);
  }
  return (
    <div className="space-y-2">
      {blocks.map((block, i) =>
        Array.isArray(block) ? (
          // biome-ignore lint/suspicious/noArrayIndexKey: static text, order never changes
          <ul key={i} className="list-disc space-y-1 pl-5">
            {block.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        ) : (
          // biome-ignore lint/suspicious/noArrayIndexKey: static text, order never changes
          <p key={i}>{block}</p>
        ),
      )}
    </div>
  );
}

/**
 * "Ask about IT": a small chat grounded in the guide. On an area page it asks about that area;
 * on the guide index it covers everything and can take a first question from `?q=`.
 */
export function AskPanel({
  areaSlug,
  areaTitle,
  askFromUrl = false,
}: {
  areaSlug?: string;
  areaTitle?: string;
  askFromUrl?: boolean;
}) {
  const [turns, setTurns] = useState<Turn[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const nextId = useRef(0);
  const turnsRef = useRef<Turn[]>([]);
  const inputId = useId();

  const ask = useCallback(
    async (raw: string) => {
      const question = raw.trim().slice(0, 500);
      if (!question || busy) return;
      const history = turnsRef.current
        .filter((t) => !t.failed)
        .map(({ role, text }) => ({ role, text }));
      const withQuestion = [
        ...turnsRef.current,
        { id: nextId.current++, role: "visitor" as const, text: question },
      ];
      turnsRef.current = withQuestion;
      setTurns(withQuestion);
      setInput("");
      setBusy(true);

      let reply: Turn;
      try {
        const response = await fetch("/api/ask", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            question,
            history,
            ...(areaSlug ? { areaSlug } : {}),
          } satisfies AskRequest),
        });
        const data = (await response.json()) as AskResponse;
        reply =
          data.status === "error"
            ? {
                id: nextId.current++,
                role: "assistant",
                text: "I couldn't answer that. Try a shorter question.",
                failed: true,
              }
            : { id: nextId.current++, role: "assistant", text: data.text, source: data.source };
      } catch {
        reply = {
          id: nextId.current++,
          role: "assistant",
          text: "I couldn't answer just now. Please try again in a moment.",
          failed: true,
        };
      }
      turnsRef.current = [...turnsRef.current, reply];
      setTurns(turnsRef.current);
      setBusy(false);
    },
    [areaSlug, busy],
  );

  // The home page's ask bar sends visitors here as /guide?q=...
  const askedFromUrl = useRef(false);
  useEffect(() => {
    if (!askFromUrl || askedFromUrl.current) return;
    askedFromUrl.current = true;
    const q = new URLSearchParams(window.location.search).get("q");
    if (q) void ask(q);
  }, [askFromUrl, ask]);

  const onSubmit = (event: FormEvent) => {
    event.preventDefault();
    void ask(input);
  };

  const starters = areaSlug ? AREA_STARTERS : GENERAL_STARTERS;

  return (
    <div className="rounded-2xl border border-line bg-paper-raised p-5">
      <h2 className="font-display text-xl font-semibold">
        {areaTitle ? "Ask about this" : "Ask anything about IT"}
      </h2>
      <p className="mt-1 text-sm text-ink-muted">
        {areaTitle
          ? `Questions about ${areaTitle.toLowerCase()}, in plain words.`
          : "Our AI answers in plain words, using this guide."}{" "}
        Please don't share passwords or personal details.
      </p>

      <div role="log" aria-live="polite" aria-busy={busy} className="mt-4 space-y-3 text-sm">
        {turns.map((turn) =>
          turn.role === "visitor" ? (
            <p key={turn.id} className="ml-8 rounded-xl bg-ink px-3 py-2 text-paper">
              {turn.text}
            </p>
          ) : (
            <div
              key={turn.id}
              className={`mr-4 rounded-xl border border-line bg-paper px-3 py-2 ${turn.failed ? "text-ink-muted" : ""}`}
            >
              <AnswerText text={turn.text} />
              {turn.source && turn.source.href !== `/guide/${areaSlug}` && (
                <p className="mt-2 text-xs">
                  From:{" "}
                  <Link
                    href={turn.source.href}
                    className="font-semibold text-ember hover:text-ember-strong"
                  >
                    {turn.source.title}
                  </Link>
                </p>
              )}
            </div>
          ),
        )}
        {busy && (
          <p className="text-ink-muted">
            <span className="motion-safe:animate-pulse">Thinking…</span>
          </p>
        )}
      </div>

      {turns.length === 0 && (
        <ul className="mt-2 flex flex-wrap gap-2" aria-label="Example questions">
          {starters.map((starter) => (
            <li key={starter}>
              <button
                type="button"
                onClick={() => void ask(starter)}
                className="rounded-full border border-line px-3 py-1.5 text-left text-sm hover:border-ember hover:text-ember"
              >
                {starter}
              </button>
            </li>
          ))}
        </ul>
      )}

      <form onSubmit={onSubmit} className="mt-4 flex gap-2">
        <label htmlFor={inputId} className="sr-only">
          Your question
        </label>
        <input
          id={inputId}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          maxLength={500}
          placeholder="Type your question"
          className="min-w-0 flex-1 rounded-xl border border-line bg-paper px-3 py-2 text-sm outline-none focus-visible:border-ember"
        />
        <button
          type="submit"
          disabled={busy || !input.trim()}
          className="rounded-xl bg-ember px-4 py-2 text-sm font-semibold text-paper hover:bg-ember-strong disabled:opacity-50"
        >
          Ask
        </button>
      </form>
      <p className="mt-3 text-xs text-ink-muted">
        AI answers can be wrong. Check with an expert before acting.
      </p>
    </div>
  );
}
