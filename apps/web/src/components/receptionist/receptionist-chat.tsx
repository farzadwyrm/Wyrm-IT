"use client";

import {
  type ConversationState,
  formatDay,
  formatTime,
  greeting,
  initialState,
  type Reply,
  respond,
  SERVICES,
} from "@wyrm/receptionist";
import { type FormEvent, useEffect, useRef, useState } from "react";
import { primaryButton } from "@/components/scan/buttons";

interface Message {
  id: number;
  from: "receptionist" | "visitor";
  text: string;
  event?: Reply["event"];
}

/** Chat with the rule-based receptionist. Runs fully in the browser; nothing is sent anywhere. */
export function ReceptionistChat() {
  const [state, setState] = useState<ConversationState>(initialState);
  const [messages, setMessages] = useState<Message[]>(() => [
    { id: 0, from: "receptionist", text: greeting().text },
  ]);
  const [suggestions, setSuggestions] = useState<string[]>(() => greeting().suggestions);
  const [input, setInput] = useState("");
  const listRef = useRef<HTMLOListElement>(null);
  const nextId = useRef(1);

  // Keep the newest message in view inside the chat window.
  useEffect(() => {
    const list = listRef.current;
    if (list && messages.length > 1) list.scrollTop = list.scrollHeight;
  }, [messages]);

  function send(text: string) {
    const trimmed = text.trim();
    if (!trimmed) return;
    const turn = respond(state, trimmed, new Date());
    setState(turn.state);
    setSuggestions(turn.reply.suggestions);
    setMessages((prev) => [
      ...prev,
      { id: nextId.current++, from: "visitor", text: trimmed },
      {
        id: nextId.current++,
        from: "receptionist",
        text: turn.reply.text,
        ...(turn.reply.event ? { event: turn.reply.event } : {}),
      },
    ]);
    setInput("");
  }

  function onSubmit(event: FormEvent) {
    event.preventDefault();
    send(input);
  }

  function restart() {
    setState(initialState());
    setMessages([{ id: nextId.current++, from: "receptionist", text: greeting().text }]);
    setSuggestions(greeting().suggestions);
    setInput("");
  }

  return (
    <section
      aria-label="Receptionist chat"
      className="flex h-[min(640px,75dvh)] flex-col overflow-hidden rounded-3xl border border-line bg-paper-raised"
    >
      <header className="flex items-center justify-between gap-3 border-b border-line px-5 py-3">
        <div>
          <p className="font-semibold">Harbor Lane Dental</p>
          <p className="text-xs text-ink-muted">Fictional clinic · demo receptionist</p>
        </div>
        <button type="button" onClick={restart} className="text-sm font-semibold text-ember">
          Restart
        </button>
      </header>

      <ol
        ref={listRef}
        aria-live="polite"
        aria-label="Conversation"
        className="flex-1 space-y-3 overflow-y-auto px-4 py-5"
      >
        {messages.map((message) => (
          <li
            key={message.id}
            className={`flex ${message.from === "visitor" ? "justify-end" : "justify-start"}`}
          >
            <div className="max-w-[85%]">
              <p className="sr-only">{message.from === "visitor" ? "You:" : "Receptionist:"}</p>
              <p
                className={`rounded-2xl px-4 py-2.5 text-sm leading-relaxed ${
                  message.from === "visitor"
                    ? "rounded-br-sm bg-ember text-paper"
                    : "rounded-bl-sm border border-line bg-paper"
                }`}
              >
                {message.text}
              </p>
              {message.event && <BookingCard event={message.event} />}
            </div>
          </li>
        ))}
      </ol>

      {suggestions.length > 0 && (
        <fieldset className="flex flex-wrap gap-2 border-t border-line px-4 pt-3">
          <legend className="sr-only">Suggested replies</legend>
          {suggestions.map((suggestion) => (
            <button
              key={suggestion}
              type="button"
              onClick={() => send(suggestion)}
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
          placeholder="Type a message, e.g. “Can I come in Thursday at 10?”"
          maxLength={300}
          className="min-w-0 flex-1 rounded-full border border-line bg-paper px-4 py-2.5 text-sm focus-visible:outline-2 focus-visible:outline-ember"
        />
        <button type="submit" className={primaryButton} disabled={input.trim() === ""}>
          Send
        </button>
      </form>
    </section>
  );
}

function BookingCard({ event }: { event: NonNullable<Reply["event"]> }) {
  const { booking } = event;
  const service = SERVICES.find((s) => s.id === booking.serviceId);
  const cancelled = event.type === "cancelled";
  return (
    <div
      className={`mt-2 rounded-2xl border p-4 text-sm ${cancelled ? "border-line opacity-70" : "border-moss"}`}
    >
      <p className={`font-semibold ${cancelled ? "line-through" : "text-moss"}`}>
        {cancelled ? "Appointment cancelled" : "Appointment booked (demo)"}
      </p>
      <p className="mt-1">
        {service?.name} · {formatDay(booking.day)} · {formatTime(booking.time)}
      </p>
      <p className="text-ink-muted">
        {booking.name} · ref {booking.reference}
      </p>
    </div>
  );
}
