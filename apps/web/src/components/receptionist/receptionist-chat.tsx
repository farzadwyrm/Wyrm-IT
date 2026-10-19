"use client";

import type { ChatMessage, Proposal, ToolEvent } from "@wyrm/ai";
import {
  type Booking,
  type ConversationState,
  formatDay,
  formatTime,
  greeting,
  initialState,
  respond,
  SERVICES,
  toDayString,
} from "@wyrm/receptionist";
import { type FormEvent, useEffect, useRef, useState } from "react";
import { primaryButton } from "@/components/scan/buttons";
import type { ReceptionistRequest, ReceptionistResponse } from "@/lib/receptionist-api";

/** Card shown under a message: a proposal waiting for a yes, or a booking change. */
type CardEvent = ToolEvent;

interface Message {
  id: number;
  from: "receptionist" | "visitor" | "system";
  text: string;
  events?: CardEvent[];
}

type Mode = "ai" | "basic";

const PROPOSAL_SUGGESTIONS = ["Yes, book it", "Can we change the time?"];

function clock(): ReceptionistRequest["clock"] {
  const now = new Date();
  return { day: toDayString(now), minutes: now.getHours() * 60 + now.getMinutes() };
}

/**
 * Chat with the receptionist. In "ai" mode each message goes to Claude (via our server) with
 * booking tools; if the AI is unavailable the chat switches to the rule-based receptionist,
 * which runs entirely in the browser.
 */
export function ReceptionistChat() {
  const [mode, setMode] = useState<Mode>("ai");
  const [messages, setMessages] = useState<Message[]>(() => [
    { id: 0, from: "receptionist", text: greeting().text },
  ]);
  const [suggestions, setSuggestions] = useState<string[]>(() => greeting().suggestions);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  // AI mode state (owned by the browser, sent with each turn).
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [pending, setPending] = useState<Proposal | null>(null);
  // Basic mode state.
  const [basicState, setBasicState] = useState<ConversationState>(initialState);

  const listRef = useRef<HTMLOListElement>(null);
  const nextId = useRef(1);

  useEffect(() => {
    const list = listRef.current;
    if (list && messages.length > 1) list.scrollTop = list.scrollHeight;
  }, [messages]);

  const add = (message: Omit<Message, "id">) =>
    setMessages((prev) => [...prev, { ...message, id: nextId.current++ }]);

  function sendBasic(text: string, state: ConversationState) {
    const turn = respond(state, text, new Date());
    setBasicState(turn.state);
    setSuggestions(turn.reply.suggestions);
    const event = turn.reply.event;
    add({
      from: "receptionist",
      text: turn.reply.text,
      ...(event
        ? {
            events: [
              event.type === "booked"
                ? { type: "booked", booking: event.booking }
                : { type: "cancelled", booking: event.booking },
            ],
          }
        : {}),
    });
  }

  async function send(text: string) {
    const trimmed = text.trim();
    if (!trimmed || busy) return;
    setInput("");
    const visitorMessage: Message = { id: nextId.current++, from: "visitor", text: trimmed };
    const nextMessages = [...messages, visitorMessage];
    setMessages(nextMessages);

    if (mode === "basic") {
      sendBasic(trimmed, basicState);
      return;
    }

    setBusy(true);
    setSuggestions([]);
    const history: ChatMessage[] = nextMessages
      .filter((m) => m.from !== "system")
      .map((m) => ({ role: m.from === "visitor" ? "visitor" : "receptionist", text: m.text }));

    let data: ReceptionistResponse;
    try {
      const response = await fetch("/api/receptionist", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          history,
          bookings,
          pending,
          clock: clock(),
        } satisfies ReceptionistRequest),
      });
      data = (await response.json()) as ReceptionistResponse;
    } catch {
      data = { status: "fallback", reason: "network" };
    }
    setBusy(false);

    if (data.status === "fallback") {
      setMode("basic");
      add({
        from: "system",
        text: "The AI receptionist is resting right now, so you're chatting with the basic version. It understands common phrasings only.",
      });
      sendBasic(trimmed, initialState());
      return;
    }

    let nextPending = pending;
    let nextBookings = bookings;
    for (const event of data.events) {
      if (event.type === "proposed") nextPending = event.proposal;
      if (event.type === "booked") {
        nextBookings = [...nextBookings, event.booking];
        nextPending = null;
      }
      if (event.type === "cancelled") {
        nextBookings = nextBookings.filter((b) => b.reference !== event.booking.reference);
      }
    }
    setPending(nextPending);
    setBookings(nextBookings);
    setSuggestions(data.events.at(-1)?.type === "proposed" ? PROPOSAL_SUGGESTIONS : []);
    add({
      from: "receptionist",
      text: data.text,
      ...(data.events.length > 0 ? { events: data.events } : {}),
    });
  }

  function onSubmit(event: FormEvent) {
    event.preventDefault();
    void send(input);
  }

  function restart() {
    setMessages([{ id: nextId.current++, from: "receptionist", text: greeting().text }]);
    setSuggestions(greeting().suggestions);
    setInput("");
    setBookings([]);
    setPending(null);
    setBasicState(initialState());
  }

  return (
    <section
      aria-label="Receptionist chat"
      className="flex h-[min(640px,75dvh)] flex-col overflow-hidden rounded-3xl border border-line bg-paper-raised"
    >
      <header className="flex items-center justify-between gap-3 border-b border-line px-5 py-3">
        <div>
          <p className="font-semibold">Harbor Lane Dental</p>
          <p className="text-xs text-ink-muted">
            Fictional clinic · {mode === "ai" ? "AI receptionist" : "basic receptionist (no AI)"}
          </p>
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
                  <EventCard
                    key={`${event.type}-${event.type === "proposed" ? event.proposal.id : event.booking.reference}`}
                    event={event}
                  />
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
              onClick={() => void send(suggestion)}
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
    </section>
  );
}

function EventCard({ event }: { event: CardEvent }) {
  const slot = event.type === "proposed" ? event.proposal : event.booking;
  const service = SERVICES.find((s) => s.id === slot.serviceId);
  const details = `${service?.name ?? "Visit"} · ${formatDay(slot.day)} · ${formatTime(slot.time)}`;

  if (event.type === "proposed") {
    return (
      <div className="mt-2 rounded-2xl border border-dashed border-ember p-4 text-sm">
        <p className="font-semibold text-ember">Waiting for your confirmation</p>
        <p className="mt-1">{details}</p>
        <p className="text-ink-muted">{slot.name}</p>
      </div>
    );
  }

  const cancelled = event.type === "cancelled";
  return (
    <div
      className={`mt-2 rounded-2xl border p-4 text-sm ${cancelled ? "border-line opacity-70" : "border-moss"}`}
    >
      <p className={`font-semibold ${cancelled ? "line-through" : "text-moss"}`}>
        {cancelled ? "Appointment cancelled" : "Appointment booked (demo)"}
      </p>
      <p className="mt-1">{details}</p>
      <p className="text-ink-muted">
        {slot.name} · ref {event.booking.reference}
      </p>
    </div>
  );
}
