/**
 * Thin wrapper over the browser's Web Speech API speech recognition.
 * Chrome sends audio to Google's speech service; Edge can recognise English on the device;
 * Safari uses Apple's service; Firefox has no support (we show a text-chat fallback).
 */

interface RecognitionAlternative {
  transcript: string;
  confidence: number;
}
interface RecognitionResult {
  readonly isFinal: boolean;
  readonly length: number;
  [index: number]: RecognitionAlternative;
}
interface RecognitionEvent {
  readonly resultIndex: number;
  readonly results: { readonly length: number; [index: number]: RecognitionResult };
}
interface RecognitionErrorEvent {
  readonly error: string;
}

/** The subset of the (still vendor-prefixed) SpeechRecognition interface we use. */
interface BrowserRecognition {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  maxAlternatives: number;
  onresult: ((event: RecognitionEvent) => void) | null;
  onerror: ((event: RecognitionErrorEvent) => void) | null;
  onend: (() => void) | null;
  start(): void;
  stop(): void;
  abort(): void;
}

type RecognitionConstructor = new () => BrowserRecognition;

function recognitionConstructor(): RecognitionConstructor | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as {
    SpeechRecognition?: RecognitionConstructor;
    webkitSpeechRecognition?: RecognitionConstructor;
  };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

export function isRecognitionSupported(): boolean {
  return recognitionConstructor() !== null;
}

export type ListenOutcome =
  | { kind: "speech"; text: string }
  | { kind: "silence" }
  | { kind: "error"; reason: "not-allowed" | "network" | "unsupported" | "other" };

export interface ListenHandle {
  /** Resolves once the caller finishes a sentence, stays silent, or an error occurs. */
  result: Promise<ListenOutcome>;
  /** Stop listening now; resolves `result` with whatever was heard so far. */
  stop(): void;
  /** Abandon this turn entirely (call ended); resolves `result` with silence. */
  abort(): void;
}

/**
 * Listens for one caller utterance. The browser decides when the sentence ended
 * (a short pause); interim text is reported as the caller speaks for live captions.
 */
export function listenOnce(options: {
  lang?: string;
  onInterim?: (text: string) => void;
}): ListenHandle {
  const Recognition = recognitionConstructor();
  if (!Recognition) {
    return {
      result: Promise.resolve({ kind: "error", reason: "unsupported" }),
      stop() {},
      abort() {},
    };
  }

  const recognition = new Recognition();
  recognition.lang = options.lang ?? "en-GB";
  recognition.continuous = false;
  recognition.interimResults = true;
  recognition.maxAlternatives = 1;

  let finalText = "";
  let interimText = "";
  let aborted = false;
  let settle: (outcome: ListenOutcome) => void = () => {};
  const result = new Promise<ListenOutcome>((resolve) => {
    let done = false;
    settle = (outcome) => {
      if (done) return;
      done = true;
      resolve(outcome);
    };
  });

  recognition.onresult = (event) => {
    let interim = "";
    for (let i = event.resultIndex; i < event.results.length; i++) {
      const res = event.results[i];
      const text = res?.[0]?.transcript ?? "";
      if (res?.isFinal) finalText += text;
      else interim += text;
    }
    interimText = interim;
    options.onInterim?.(`${finalText}${interim}`.trim());
  };

  recognition.onerror = (event) => {
    if (event.error === "no-speech" || event.error === "aborted") return; // handled in onend
    const reason =
      event.error === "not-allowed" || event.error === "service-not-allowed"
        ? "not-allowed"
        : event.error === "network"
          ? "network"
          : "other";
    settle({ kind: "error", reason });
  };

  recognition.onend = () => {
    const text = (finalText || interimText).trim();
    settle(!aborted && text ? { kind: "speech", text } : { kind: "silence" });
  };

  try {
    recognition.start();
  } catch {
    settle({ kind: "error", reason: "other" });
  }

  return {
    result,
    stop() {
      try {
        recognition.stop();
      } catch {
        // Already stopped.
      }
    },
    abort() {
      aborted = true;
      try {
        recognition.abort();
      } catch {
        // Already stopped.
      }
      settle({ kind: "silence" });
    },
  };
}
