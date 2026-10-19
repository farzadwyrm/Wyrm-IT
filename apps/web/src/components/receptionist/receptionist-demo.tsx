"use client";

import { useState } from "react";
import { ReceptionistCall } from "./receptionist-call";
import { ReceptionistChat } from "./receptionist-chat";
import { useReceptionistSession } from "./use-receptionist-session";

type View = "chat" | "call";

/**
 * The receptionist demo: one shared conversation, shown as a text chat or a simulated phone
 * call. Switching views keeps the conversation, the waiting proposal and any bookings.
 */
export function ReceptionistDemo() {
  const session = useReceptionistSession();
  const [view, setView] = useState<View>("chat");
  // Remounting the call view on restart guarantees the microphone and speech are released.
  const [callKey, setCallKey] = useState(0);

  function restart() {
    session.restart();
    setCallKey((k) => k + 1);
  }

  const tab = (value: View, label: string) => (
    <button
      type="button"
      aria-pressed={view === value}
      onClick={() => setView(value)}
      className="rounded-full px-3 py-1 text-sm font-semibold text-ink-muted aria-pressed:bg-paper aria-pressed:text-ink aria-pressed:shadow-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ember"
    >
      {label}
    </button>
  );

  return (
    <section
      aria-label="Receptionist demo"
      className="flex h-[min(680px,80dvh)] flex-col overflow-hidden rounded-3xl border border-line bg-paper-raised"
    >
      <header className="flex items-center justify-between gap-3 border-b border-line px-5 py-3">
        <div className="min-w-0">
          <p className="font-semibold">Harbor Lane Dental</p>
          <p className="truncate text-xs text-ink-muted">
            Fictional clinic ·{" "}
            {session.mode === "ai" ? "AI receptionist" : "basic receptionist (no AI)"}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <fieldset className="flex gap-1 rounded-full border border-line p-1">
            <legend className="sr-only">Talk by</legend>
            {tab("chat", "Chat")}
            {tab("call", "Call")}
          </fieldset>
          <button type="button" onClick={restart} className="text-sm font-semibold text-ember">
            Restart
          </button>
        </div>
      </header>

      {view === "chat" ? (
        <ReceptionistChat session={session} />
      ) : (
        <ReceptionistCall key={callKey} session={session} onUseChat={() => setView("chat")} />
      )}
    </section>
  );
}
