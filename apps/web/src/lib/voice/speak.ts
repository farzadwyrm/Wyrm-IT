import { pickVoice } from "./voices";

/** Loads the browser's voices (Chrome fills the list asynchronously). */
export function loadVoices(timeoutMs = 1500): Promise<SpeechSynthesisVoice[]> {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) return Promise.resolve([]);
  const synth = window.speechSynthesis;
  const now = synth.getVoices();
  if (now.length > 0) return Promise.resolve(now);
  return new Promise((resolve) => {
    const done = () => {
      synth.removeEventListener("voiceschanged", done);
      resolve(synth.getVoices());
    };
    synth.addEventListener("voiceschanged", done);
    setTimeout(done, timeoutMs);
  });
}

export function isSpeechOutputSupported(): boolean {
  return typeof window !== "undefined" && "speechSynthesis" in window;
}

export interface SpeakHandle {
  /** Resolves when the receptionist has finished speaking (or was stopped). */
  done: Promise<void>;
  stop(): void;
}

/**
 * Speaks text with the most natural available voice. `onWord` fires at word boundaries
 * (where the browser supports it) so the visualiser can pulse with the speech.
 */
export function speak(
  text: string,
  voice: SpeechSynthesisVoice | null,
  callbacks: { onStart?: () => void; onWord?: (charIndex: number) => void } = {},
): SpeakHandle {
  if (!isSpeechOutputSupported() || text.trim() === "") {
    return { done: Promise.resolve(), stop() {} };
  }
  const synth = window.speechSynthesis;
  const utterance = new SpeechSynthesisUtterance(text);
  if (voice) {
    utterance.voice = voice;
    utterance.lang = voice.lang;
  } else {
    utterance.lang = "en-GB";
  }
  utterance.rate = 1.02;
  utterance.pitch = 1;

  const done = new Promise<void>((resolve) => {
    // Chrome sometimes never fires `end` for long utterances; a generous fallback timer
    // based on text length keeps the call from getting stuck.
    const fallback = setTimeout(resolve, 2000 + text.length * 90);
    const finish = () => {
      clearTimeout(fallback);
      resolve();
    };
    utterance.onend = finish;
    utterance.onerror = finish;
  });
  utterance.onstart = () => callbacks.onStart?.();
  utterance.onboundary = (event) => {
    if (event.name === "word") callbacks.onWord?.(event.charIndex);
  };

  synth.cancel(); // never queue behind a previous reply
  synth.speak(utterance);
  return {
    done,
    stop() {
      synth.cancel();
    },
  };
}

export async function chooseVoice(): Promise<SpeechSynthesisVoice | null> {
  return pickVoice(await loadVoices());
}
