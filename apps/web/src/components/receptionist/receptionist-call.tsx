"use client";

import type { ToolEvent } from "@wyrm/ai";
import { type FormEvent, useCallback, useEffect, useReducer, useRef, useState } from "react";
import { primaryButton, secondaryButton } from "@/components/scan/buttons";
import { createSpeakingEnvelope } from "@/lib/voice/envelope";
import { type MicMeter, openMicMeter } from "@/lib/voice/mic-level";
import { isRecognitionSupported, type ListenHandle, listenOnce } from "@/lib/voice/recognition";
import { chooseVoice, isSpeechOutputSupported, type SpeakHandle, speak } from "@/lib/voice/speak";
import { toSpeech } from "@/lib/voice/speech-text";
import { callReducer, initialCall, LIVE_PHASES, statusLabel } from "./call-machine";
import { EventCard, eventKey } from "./event-card";
import { type RingMode, TideRing } from "./tide-ring";
import type { ReceptionistSession } from "./use-receptionist-session";

const STILL_THERE = "Sorry, I didn't catch anything. Are you still there?";
const GOODBYE = "I'll let you go for now. Call back any time. Goodbye!";
const SAY_AGAIN = "Sorry, could you say that again?";

function spokenGreeting(): string {
  const hour = new Date().getHours();
  const part = hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";
  return `${part}, Harbor Lane Dental, you're speaking with the receptionist. How can I help?`;
}

/** Plays a short UK-style ringback tone (two quiet rings) through Web Audio. */
function playRingback(context: AudioContext): Promise<void> {
  const gain = context.createGain();
  gain.gain.value = 0;
  gain.connect(context.destination);
  const tones = [400, 450].map((frequency) => {
    const osc = context.createOscillator();
    osc.frequency.value = frequency;
    osc.connect(gain);
    osc.start();
    return osc;
  });
  const t0 = context.currentTime;
  for (const offset of [0, 0.6]) {
    gain.gain.setValueAtTime(0.04, t0 + offset);
    gain.gain.setValueAtTime(0, t0 + offset + 0.4);
  }
  return new Promise((resolve) =>
    setTimeout(() => {
      for (const osc of tones) osc.stop();
      gain.disconnect();
      resolve();
    }, 1300),
  );
}

const pad = (n: number) => String(n).padStart(2, "0");
const formatDuration = (seconds: number) => `${pad(Math.floor(seconds / 60))}:${pad(seconds % 60)}`;

/**
 * Simulated phone call with the receptionist. Turn by turn: the receptionist speaks, then the
 * microphone listens for one sentence, then the reply is fetched and spoken. The microphone is
 * paused while the receptionist speaks (half-duplex), which avoids it hearing itself.
 */
export function ReceptionistCall({
  session,
  onUseChat,
}: {
  session: ReceptionistSession;
  onUseChat: () => void;
}) {
  const [call, dispatch] = useReducer(callReducer, initialCall);
  const [caption, setCaption] = useState<{ who: "receptionist" | "visitor"; text: string } | null>(
    null,
  );
  const [cards, setCards] = useState<ToolEvent[]>([]);
  const [booked, setBooked] = useState<ToolEvent[]>([]);
  const [pulse, setPulse] = useState(0);
  const [slowThinking, setSlowThinking] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [typed, setTyped] = useState("");
  const [showTyping, setShowTyping] = useState(false);

  const mic = useRef<MicMeter | null>(null);
  const voice = useRef<SpeechSynthesisVoice | null>(null);
  const envelope = useRef(createSpeakingEnvelope());
  const speech = useRef<SpeakHandle | null>(null);
  const listening = useRef<ListenHandle | null>(null);
  const nextSpeech = useRef<{ text: string; after: "listen" | "hang-up" }>({
    text: "",
    after: "listen",
  });
  const startedAt = useRef(0);
  const endButton = useRef<HTMLButtonElement>(null);
  const live = LIVE_PHASES.includes(call.phase);

  // Detect support after mount (never during server rendering).
  useEffect(() => {
    if (!isRecognitionSupported() || !isSpeechOutputSupported()) dispatch({ type: "UNSUPPORTED" });
  }, []);

  const say = useCallback((text: string, after: "listen" | "hang-up" = "listen") => {
    nextSpeech.current = { text, after };
    setCaption({ who: "receptionist", text });
    dispatch({ type: "SPEAK" });
  }, []);

  const handleEvents = useCallback((events: ToolEvent[]) => {
    if (events.length === 0) return;
    setCards(events);
    const newlyBooked = events.filter((e) => e.type === "booked");
    if (newlyBooked.length > 0) {
      setBooked((prev) => [...prev, ...newlyBooked]);
      setPulse((p) => p + 1);
    }
  }, []);

  /** Sends what the visitor said (or typed) and queues the spoken reply. */
  const respondTo = useCallback(
    async (text: string) => {
      setCaption({ who: "visitor", text });
      dispatch({ type: "HEARD" });
      const reply = await session.send(text, "voice");
      if (!reply) {
        say(SAY_AGAIN);
        return;
      }
      handleEvents(reply.events);
      say(reply.text);
    },
    [session, say, handleEvents],
  );

  // Speaking: play the queued reply, animate the envelope, then listen (or hang up).
  useEffect(() => {
    if (call.phase !== "speaking") return;
    let cancelled = false;
    const { text, after } = nextSpeech.current;
    const env = envelope.current;
    const handle = speak(toSpeech(text), voice.current, {
      onStart: () => env.start(performance.now()),
      onWord: (index) => {
        const now = performance.now();
        if (/[,.?!]/.test(text.charAt(index - 2))) env.pause(now);
        env.word(now);
      },
    });
    env.start(performance.now()); // in case onstart never fires
    speech.current = handle;
    void handle.done.then(() => {
      env.stop(performance.now());
      if (cancelled) return;
      dispatch({ type: after === "hang-up" ? "END" : "SPOKEN" });
    });
    return () => {
      cancelled = true;
      handle.stop();
      env.stop(performance.now());
    };
  }, [call.phase]);

  // Listening: one sentence at a time, paused while muted.
  useEffect(() => {
    if (call.phase !== "listening" || call.muted) return;
    let cancelled = false;
    const handle = listenOnce({
      onInterim: (text) => {
        if (!cancelled && text) setCaption({ who: "visitor", text });
      },
    });
    listening.current = handle;
    void handle.result.then((outcome) => {
      if (cancelled) return;
      if (outcome.kind === "speech") {
        void respondTo(outcome.text);
      } else if (outcome.kind === "silence") {
        dispatch({ type: "SILENCE" });
      } else if (outcome.reason === "not-allowed") {
        dispatch({ type: "FAILED" });
      } else {
        dispatch({ type: "FAILED" });
      }
    });
    return () => {
      cancelled = true;
      handle.abort();
    };
  }, [call.phase, call.muted, respondTo]);

  // Silence handling: ask once, then say goodbye.
  useEffect(() => {
    if (call.phase !== "listening" || call.silences === 0) return;
    if (call.silences === 1) say(STILL_THERE);
    else say(GOODBYE, "hang-up");
  }, [call.silences, call.phase, say]);

  // "Checking the calendar…" only if the request really takes a while.
  useEffect(() => {
    if (call.phase !== "thinking") {
      setSlowThinking(false);
      return;
    }
    const timer = setTimeout(() => setSlowThinking(true), 2500);
    return () => clearTimeout(timer);
  }, [call.phase]);

  // Call timer, updated once a second (not in the animation loop).
  useEffect(() => {
    if (!live) return;
    const timer = setInterval(
      () => setElapsed(Math.floor((Date.now() - startedAt.current) / 1000)),
      1000,
    );
    return () => clearInterval(timer);
  }, [live]);

  // Mute: silence the microphone tracks too, so the browser's indicator reflects it.
  useEffect(() => {
    mic.current?.setMuted(call.muted);
  }, [call.muted]);

  // Hang up: release the microphone and stop any speech.
  useEffect(() => {
    if (call.phase !== "ended" && call.phase !== "error") return;
    listening.current?.abort();
    speech.current?.stop();
    mic.current?.close();
    mic.current = null;
  }, [call.phase]);

  // Leaving the page or the Call tab always releases the microphone.
  useEffect(
    () => () => {
      listening.current?.abort();
      speech.current?.stop();
      mic.current?.close();
    },
    [],
  );

  async function startCall() {
    // Create audio in the click handler so browsers allow it to play.
    const AudioCtx =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    const ringContext = AudioCtx ? new AudioCtx() : null;

    dispatch({ type: "CALL" });
    setCards([]);
    setBooked([]);
    setCaption(null);
    setElapsed(0);
    const meter = await openMicMeter();
    if ("error" in meter) {
      void ringContext?.close();
      dispatch({ type: "MIC_DENIED" });
      return;
    }
    mic.current = meter;
    dispatch({ type: "MIC_GRANTED" });
    startedAt.current = Date.now();
    endButton.current?.focus();
    const [chosen] = await Promise.all([
      chooseVoice(),
      ringContext ? playRingback(ringContext) : Promise.resolve(),
    ]);
    void ringContext?.close();
    voice.current = chosen;
    say(spokenGreeting());
  }

  function endCall() {
    dispatch({ type: "END" });
  }

  function skipSpeech() {
    speech.current?.stop();
  }

  function sendTyped(event: FormEvent) {
    event.preventDefault();
    const text = typed.trim();
    if (!text || call.phase !== "listening") return;
    setTyped("");
    listening.current?.abort();
    void respondTo(text);
  }

  function confirmByButton(text: string) {
    if (call.phase !== "listening") return;
    listening.current?.abort();
    void respondTo(text);
  }

  const ringMode: RingMode =
    call.muted && live
      ? "muted"
      : call.phase === "speaking" ||
          call.phase === "listening" ||
          call.phase === "thinking" ||
          call.phase === "connecting"
        ? call.phase
        : call.phase === "ended"
          ? "ended"
          : "idle";

  const getLevel = useCallback(() => {
    if (ringMode === "speaking") return envelope.current.level(performance.now());
    if (ringMode === "listening") return mic.current?.level() ?? 0;
    return 0;
  }, [ringMode]);

  const status = statusLabel(call, slowThinking);
  const proposal = cards.find((c) => c.type === "proposed");

  return (
    <div className="flex flex-1 flex-col overflow-y-auto">
      <div className="flex items-center justify-between gap-3 px-5 pt-4 text-sm">
        <p role="status" aria-live="polite" className="font-medium">
          {live && (
            <span className="mr-2 inline-flex items-center gap-1.5 text-ink-muted">
              <span aria-hidden="true" className="inline-block size-2 rounded-full bg-moss" />
              {formatDuration(elapsed)} ·
            </span>
          )}
          {status}
        </p>
        {call.phase === "speaking" && (
          <button
            type="button"
            onClick={skipSpeech}
            className="text-sm font-semibold text-ember hover:text-ember-strong"
          >
            Skip
          </button>
        )}
      </div>

      <div className="flex justify-center py-4">
        <TideRing mode={ringMode} getLevel={getLevel} pulse={pulse} size={220} />
      </div>

      <div className="min-h-16 px-5 text-center" aria-live="off">
        {caption && (
          <p className={caption.who === "visitor" ? "text-ink-muted italic" : "text-ink"}>
            <span className="sr-only">
              {caption.who === "visitor" ? "You said: " : "Receptionist: "}
            </span>
            {caption.who === "visitor" ? `“${caption.text}”` : caption.text}
          </p>
        )}
      </div>

      <div className="px-5">
        {cards.map((event) => (
          <EventCard key={eventKey(event)} event={event} />
        ))}
        {proposal && call.phase === "listening" && (
          <div className="mt-2 flex flex-wrap gap-2">
            <button
              type="button"
              className={primaryButton}
              onClick={() => confirmByButton("Yes, book it")}
            >
              Yes, book it
            </button>
            <button
              type="button"
              className={secondaryButton}
              onClick={() => confirmByButton("Can we change the time?")}
            >
              Change it
            </button>
          </div>
        )}
      </div>

      {call.phase === "ended" && (
        <section
          aria-label="Call summary"
          className="mx-5 mt-4 rounded-2xl border border-line p-4 text-sm"
        >
          <p className="font-semibold">Call ended · {formatDuration(elapsed)}</p>
          {booked.length === 0 ? (
            <p className="mt-1 text-ink-muted">No appointment was booked on this call.</p>
          ) : (
            booked.map((event) => <EventCard key={eventKey(event)} event={event} />)
          )}
        </section>
      )}

      <div className="mt-auto space-y-3 p-4">
        {showTyping && live && (
          <form onSubmit={sendTyped} className="flex gap-2">
            <label htmlFor="call-typed" className="sr-only">
              Type instead of speaking
            </label>
            <input
              id="call-typed"
              value={typed}
              onChange={(e) => setTyped(e.target.value)}
              placeholder={call.phase === "listening" ? "Type your answer…" : "Wait for your turn…"}
              maxLength={500}
              className="min-w-0 flex-1 rounded-full border border-line bg-paper px-4 py-2.5 text-sm focus-visible:outline-2 focus-visible:outline-ember"
            />
            <button
              type="submit"
              className={primaryButton}
              disabled={call.phase !== "listening" || !typed.trim()}
            >
              Send
            </button>
          </form>
        )}

        {live ? (
          <div className="flex flex-wrap justify-center gap-2">
            <button
              type="button"
              aria-pressed={call.muted}
              onClick={() => dispatch({ type: "TOGGLE_MUTE" })}
              className={`${secondaryButton} min-h-12`}
            >
              {call.muted ? "Unmute" : "Mute"}
            </button>
            <button
              type="button"
              aria-pressed={showTyping}
              onClick={() => setShowTyping((v) => !v)}
              className={`${secondaryButton} min-h-12`}
            >
              Type instead
            </button>
            <button
              ref={endButton}
              type="button"
              onClick={endCall}
              className="inline-flex min-h-12 items-center justify-center rounded-full bg-ember-strong px-6 py-2.5 text-sm font-semibold text-paper focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ember"
            >
              End call
            </button>
          </div>
        ) : call.phase === "unsupported" ? (
          <div className="flex justify-center">
            <button type="button" onClick={onUseChat} className={primaryButton}>
              Use the chat instead
            </button>
          </div>
        ) : call.phase === "requesting" ? (
          <p className="text-center text-sm text-ink-muted">Waiting for microphone permission…</p>
        ) : (
          <div className="flex flex-col items-center gap-3">
            <button
              type="button"
              onClick={() => void startCall()}
              className={`${primaryButton} min-h-12 px-8`}
            >
              {call.phase === "ended"
                ? "Call again"
                : call.phase === "denied" || call.phase === "error"
                  ? "Try again"
                  : "Start call"}
            </button>
            {call.phase === "ended" ? (
              <button
                type="button"
                onClick={onUseChat}
                className="text-sm font-semibold text-ember"
              >
                Continue in chat
              </button>
            ) : (
              <p className="max-w-sm text-center text-xs text-ink-muted">
                Uses your microphone; headphones work best. Your browser turns speech into text (in
                Chrome this uses Google's speech service). Fictional clinic: nothing is really
                booked.
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
