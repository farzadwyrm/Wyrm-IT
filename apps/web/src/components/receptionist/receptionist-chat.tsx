"use client";

import { type FormEvent, useEffect, useRef, useState } from "react";
import { primaryButton } from "@/components/buttons";
import { EventCard, eventKey } from "./event-card";
import type { ReceptionistSession } from "./use-receptionist-session";

/** Text chat over the shared receptionist session. */
export function ReceptionistChat({ session }: { session: ReceptionistSession }) {
  const { messages, suggestions, busy, send } = session;
  const [input, setInput] = useState("");
  const listRef = useRef<HTMLOListElement>(null);

  useEffect(() => {
    const list = listRef.current;
    if (list && messages.length > 1) list.scrollTop = list.scrollHeight;
  }, [messages]);

  function submit(text: string) {
    setInput("");
    void send(text, "chat");
  }

  function onSubmit(event: FormEvent) {
    event.preventDefault();
    submit(input);
  }

  return (
    <>
      <ol
        ref={listRef}
        aria-live="polite"
        aria-label="Conversation"
        className="flex-1 space-y-3 overflow-y-auto px-4 py-5"
      >
        {messages.map((message) =>
          message.from === "system" ? (
            <li key={message.id} className="text-center text-xs text-ink-muted">
              {message.text}
            </li>
          ) : (
            <li
              key={message.id}
              className={`flex ${message.from === "visitor" ? "justify-end" : "justify-start"}`}
            >
              <div className="max-w-[85%]">
                <p className="sr-only">{message.from === "visitor" ? "You:" : "Receptionist:"}</p>
                <p
                  className={`whitespace-pre-line rounded-2xl px-4 py-2.5 text-sm leading-relaxed ${
                    message.from === "visitor"
                      ? "rounded-br-sm bg-ember text-paper"
                      : "rounded-bl-sm border border-line bg-paper"
                  }`}
                >
                  {message.text}
                </p>
                {message.events?.map((event) => (
                  <EventCard key={eventKey(event)} event={event} />
                ))}
              </div>
            </li>
          ),
        )}
        {busy && (
          <li className="flex justify-start">
            <p className="animate-pulse rounded-2xl rounded-bl-sm border border-line bg-paper px-4 py-2.5 text-sm text-ink-muted">
              Receptionist is typing…
            </p>
          </li>
        )}
      </ol>

      {suggestions.length > 0 && !busy && (
        <fieldset className="flex flex-wrap gap-2 border-t border-line px-4 pt-3">
          <legend className="sr-only">Suggested replies</legend>
          {suggestions.map((suggestion) => (
            <button
              key={suggestion}
              type="button"
              onClick={() => submit(suggestion)}
              className="rounded-full border border-line px-3 py-1.5 text-sm hover:border-ember focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ember"
            >
              {suggestion}
            </button>
          ))}
        </fieldset>
      )}

      <form onSubmit={onSubmit} className="flex gap-2 p-4">
        <label htmlFor="receptionist-input" className="sr-only">
          Your message
        </label>
        <input
          id="receptionist-input"
          value={input}
          onChange={(event) => setInput(event.target.value)}
          autoComplete="off"
          placeholder="Ask anything, e.g. “Can I come in Thursday after work?”"
          maxLength={500}
          className="min-w-0 flex-1 rounded-full border border-line bg-paper px-4 py-2.5 text-sm focus-visible:outline-2 focus-visible:outline-ember"
        />
        <button type="submit" className={primaryButton} disabled={busy || input.trim() === ""}>
          Send
        </button>
      </form>
    </>
  );
}
