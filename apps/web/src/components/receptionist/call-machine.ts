/**
 * The voice call's state machine: pure, no DOM, so every transition is unit-tested.
 * Half-duplex: the microphone listens only while the receptionist is not speaking.
 */

export type CallPhase =
  | "idle"
  | "unsupported"
  | "requesting"
  | "denied"
  | "connecting"
  | "speaking"
  | "listening"
  | "thinking"
  | "error"
  | "ended";

export interface CallState {
  phase: CallPhase;
  muted: boolean;
  /** Consecutive silent listening turns, to prompt "are you still there?" then hang up. */
  silences: number;
}

export type CallEvent =
  | { type: "CALL" }
  | { type: "UNSUPPORTED" }
  | { type: "MIC_GRANTED" }
  | { type: "MIC_DENIED" }
  | { type: "SPEAK" } // receptionist starts a reply (greeting or answer)
  | { type: "SPOKEN" } // reply finished, or skipped by the visitor
  | { type: "HEARD" } // a visitor sentence was recognised
  | { type: "SILENCE" }
  | { type: "FAILED" }
  | { type: "TOGGLE_MUTE" }
  | { type: "END" }
  | { type: "RESET" };

export const initialCall: CallState = { phase: "idle", muted: false, silences: 0 };

/** Phases in which a call is in progress (End is available, the mic is open). */
export const LIVE_PHASES: readonly CallPhase[] = [
  "connecting",
  "speaking",
  "listening",
  "thinking",
];

export function callReducer(state: CallState, event: CallEvent): CallState {
  const live = LIVE_PHASES.includes(state.phase);
  switch (event.type) {
    case "CALL":
      return ["idle", "denied", "error", "ended"].includes(state.phase)
        ? { phase: "requesting", muted: false, silences: 0 }
        : state;
    case "UNSUPPORTED":
      return { ...state, phase: "unsupported" };
    case "MIC_GRANTED":
      return state.phase === "requesting" ? { ...state, phase: "connecting" } : state;
    case "MIC_DENIED":
      return state.phase === "requesting" ? { ...state, phase: "denied" } : state;
    case "SPEAK":
      return live ? { ...state, phase: "speaking" } : state;
    case "SPOKEN":
      return state.phase === "speaking" ? { ...state, phase: "listening" } : state;
    case "HEARD":
      return state.phase === "listening" ? { ...state, phase: "thinking", silences: 0 } : state;
    case "SILENCE":
      return state.phase === "listening" ? { ...state, silences: state.silences + 1 } : state;
    case "FAILED":
      return live ? { ...state, phase: "error" } : state;
    case "TOGGLE_MUTE":
      return live ? { ...state, muted: !state.muted } : state;
    case "END":
      return live || state.phase === "requesting"
        ? { ...state, phase: "ended", muted: false }
        : state;
    case "RESET":
      return initialCall;
  }
}

/** Short status text for each phase; the visual is never the only carrier of state. */
export function statusLabel(state: CallState, slowThinking: boolean): string {
  if (state.muted && LIVE_PHASES.includes(state.phase)) return "You're muted";
  switch (state.phase) {
    case "idle":
      return "Call the receptionist";
    case "unsupported":
      return "Voice calls need Chrome, Edge or Safari. You can use the chat instead.";
    case "requesting":
      return "Allow microphone access to start";
    case "denied":
      return "Microphone blocked. Allow it in the address bar, or use the chat.";
    case "connecting":
      return "Calling Harbor Lane Dental…";
    case "speaking":
      return "Receptionist is speaking";
    case "listening":
      return "Listening…";
    case "thinking":
      return slowThinking ? "Checking the calendar…" : "One moment…";
    case "error":
      return "Lost the connection. Try again, or type instead.";
    case "ended":
      return "Call ended";
  }
}
