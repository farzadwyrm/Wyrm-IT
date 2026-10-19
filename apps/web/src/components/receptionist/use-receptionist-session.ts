"use client";

import type { ChatMessage, Proposal, ToolEvent } from "@wyrm/ai";
import {
  type Booking,
  type ConversationState,
  greeting,
  initialState,
  respond,
  toDayString,
} from "@wyrm/receptionist";
import { useCallback, useRef, useState } from "react";
import type { ReceptionistRequest, ReceptionistResponse } from "@/lib/receptionist-api";

export interface SessionMessage {
  id: number;
  from: "receptionist" | "visitor" | "system";
  text: string;
  events?: ToolEvent[];
}

export type SessionMode = "ai" | "basic";
export type Channel = "chat" | "voice";

export interface SessionReply {
  text: string;
  events: ToolEvent[];
}

const PROPOSAL_SUGGESTIONS = ["Yes, book it", "Can we change the time?"];

/** Reasons the AI won't be back during this visit; anything else is retried next turn. */
const PERMANENT_FALLBACKS = new Set([
  "not_configured",
  "daily_budget_exhausted",
  "visitor_rate_limited",
  "invalid_request",
]);

function clock(): ReceptionistRequest["clock"] {
  const now = new Date();
  return { day: toDayString(now), minutes: now.getHours() * 60 + now.getMinutes() };
}

function basicEvents(event: ReturnType<typeof respond>["reply"]["event"]): ToolEvent[] {
  if (!event) return [];
  return [
    event.type === "booked"
      ? { type: "booked", booking: event.booking }
      : { type: "cancelled", booking: event.booking },
  ];
}

/**
 * One receptionist conversation, shared by the chat and call views. In "ai" mode each turn
 * goes to Claude via our server with booking tools; if the AI is unavailable the session
 * switches to the rule-based receptionist, which runs entirely in the browser.
 *
 * State lives in refs (the source of truth) mirrored into React state for rendering, so the
 * asynchronous voice loop never reads a stale conversation.
 */
export function useReceptionistSession() {
  const [messages, setMessages] = useState<SessionMessage[]>(() => [
    { id: 0, from: "receptionist", text: greeting().text },
  ]);
  const [suggestions, setSuggestions] = useState<string[]>(() => greeting().suggestions);
  const [busy, setBusy] = useState(false);
  const [mode, setModeState] = useState<SessionMode>("ai");
  /** Which AI answered last: Claude (paid) or a free open model on Groq. */
  const [provider, setProvider] = useState<"claude" | "groq" | null>(null);

  const messagesRef = useRef(messages);
  const modeRef = useRef<SessionMode>("ai");
  const bookingsRef = useRef<Booking[]>([]);
  const pendingRef = useRef<Proposal | null>(null);
  const basicRef = useRef<ConversationState>(initialState());
  const busyRef = useRef(false);
  /** Consecutive temporary AI failures; two in a row switch to the basic receptionist. */
  const glitchesRef = useRef(0);
  const nextId = useRef(1);
  const generation = useRef(0);

  const commit = useCallback((next: SessionMessage[]) => {
    messagesRef.current = next;
    setMessages(next);
  }, []);

  const append = useCallback(
    (message: Omit<SessionMessage, "id">) => {
      const next = [...messagesRef.current, { ...message, id: nextId.current++ }];
      commit(next);
    },
    [commit],
  );

  const setMode = useCallback((value: SessionMode) => {
    modeRef.current = value;
    setModeState(value);
  }, []);

  const replyBasic = useCallback(
    (text: string): SessionReply => {
      const turn = respond(basicRef.current, text, new Date());
      basicRef.current = turn.state;
      setSuggestions(turn.reply.suggestions);
      const events = basicEvents(turn.reply.event);
      append({ from: "receptionist", text: turn.reply.text, ...(events.length ? { events } : {}) });
      return { text: turn.reply.text, events };
    },
    [append],
  );

  /** Sends a visitor message; resolves with the receptionist's reply (null if ignored). */
  const send = useCallback(
    async (text: string, channel: Channel = "chat"): Promise<SessionReply | null> => {
      const trimmed = text.trim();
      if (!trimmed || busyRef.current) return null;
      const turnGeneration = generation.current;
      append({ from: "visitor", text: trimmed });

      if (modeRef.current === "basic") return replyBasic(trimmed);

      busyRef.current = true;
      setBusy(true);
      setSuggestions([]);
      const history: ChatMessage[] = messagesRef.current
        .filter((m) => m.from !== "system")
        .map((m) => ({ role: m.from === "visitor" ? "visitor" : "receptionist", text: m.text }));

      let data: ReceptionistResponse;
      try {
        const response = await fetch("/api/receptionist", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            history,
            bookings: bookingsRef.current,
            pending: pendingRef.current,
            clock: clock(),
            channel,
          } satisfies ReceptionistRequest),
        });
        data = (await response.json()) as ReceptionistResponse;
      } catch {
        data = { status: "fallback", reason: "network" };
      } finally {
        busyRef.current = false;
        setBusy(false);
      }

      // The conversation was restarted while we waited: drop the late reply.
      if (turnGeneration !== generation.current) return null;

      // A one-off glitch (network, an empty or refused reply) keeps the AI and the booking in
      // progress: the receptionist simply asks again. Only a switched-off or exhausted AI moves
      // the conversation to the basic receptionist for good.
      if (data.status === "ok") glitchesRef.current = 0;
      if (
        data.status === "fallback" &&
        !PERMANENT_FALLBACKS.has(data.reason) &&
        ++glitchesRef.current < 2
      ) {
        const text = "Sorry, I lost my train of thought for a second. Could you say that again?";
        append({ from: "receptionist", text });
        return { text, events: [] };
      }

      if (data.status === "fallback") {
        setMode("basic");
        append({
          from: "system",
          text: "The AI receptionist is resting right now, so you're talking to the basic version. It understands common phrasings only.",
        });
        basicRef.current = initialState();
        return replyBasic(trimmed);
      }

      setProvider(data.provider);
      for (const event of data.events) {
        if (event.type === "proposed") pendingRef.current = event.proposal;
        if (event.type === "booked") {
          bookingsRef.current = [...bookingsRef.current, event.booking];
          pendingRef.current = null;
        }
        if (event.type === "cancelled") {
          bookingsRef.current = bookingsRef.current.filter(
            (b) => b.reference !== event.booking.reference,
          );
        }
      }
      setSuggestions(data.events.at(-1)?.type === "proposed" ? PROPOSAL_SUGGESTIONS : []);
      append({
        from: "receptionist",
        text: data.text,
        ...(data.events.length > 0 ? { events: data.events } : {}),
      });
      return { text: data.text, events: data.events };
    },
    [append, replyBasic, setMode],
  );

  const restart = useCallback(() => {
    generation.current++;
    commit([{ id: nextId.current++, from: "receptionist", text: greeting().text }]);
    setSuggestions(greeting().suggestions);
    bookingsRef.current = [];
    pendingRef.current = null;
    basicRef.current = initialState();
  }, [commit]);

  return { messages, suggestions, busy, mode, provider, send, restart, append };
}

export type ReceptionistSession = ReturnType<typeof useReceptionistSession>;
