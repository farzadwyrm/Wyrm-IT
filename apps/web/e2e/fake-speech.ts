import type { Page } from "@playwright/test";

/**
 * Replaces the browser's speech recognition and speech synthesis with scripted fakes, so the
 * voice call can be tested end to end without a person speaking. Production code is unchanged:
 * it simply finds these objects where the real ones would be.
 *
 *   await installFakeSpeech(page);
 *   await say(page, "book a check-up");      // the "caller" speaks one sentence
 *   const spoken = await spokenTexts(page);  // what the receptionist said aloud
 */
export async function installFakeSpeech(page: Page, options: { recognition?: boolean } = {}) {
  await page.addInitScript((withRecognition: boolean) => {
    type Recognition = {
      onresult: ((e: unknown) => void) | null;
      onend: (() => void) | null;
      ended: boolean;
      emit(text: string): void;
    };
    const w = window as unknown as Record<string, unknown> & {
      __spoken: string[];
      __active: Recognition | null;
      __queue: string[];
      __fakeSay: (text: string) => void;
    };
    w.__spoken = [];
    w.__active = null;
    w.__queue = [];

    class FakeRecognition {
      lang = "en-GB";
      continuous = false;
      interimResults = true;
      maxAlternatives = 1;
      onresult: ((e: unknown) => void) | null = null;
      onerror: ((e: unknown) => void) | null = null;
      onend: (() => void) | null = null;
      ended = false;
      start() {
        w.__active = this as unknown as Recognition;
        const next = w.__queue.shift();
        if (next !== undefined) setTimeout(() => this.emit(next), 30);
      }
      emit(text: string) {
        if (this.ended) return;
        const result = Object.assign([{ transcript: text, confidence: 0.95 }], { isFinal: true });
        this.onresult?.({ resultIndex: 0, results: { length: 1, 0: result } });
        this.finish();
      }
      finish() {
        if (this.ended) return;
        this.ended = true;
        if (w.__active === (this as unknown as Recognition)) w.__active = null;
        this.onend?.();
      }
      stop() {
        this.finish();
      }
      abort() {
        this.finish();
      }
    }

    w.__fakeSay = (text: string) => {
      const active = w.__active;
      if (active && !active.ended) active.emit(text);
      else w.__queue.push(text);
    };

    if (withRecognition) {
      w.SpeechRecognition = FakeRecognition;
      w.webkitSpeechRecognition = FakeRecognition;
    } else {
      delete w.SpeechRecognition;
      delete w.webkitSpeechRecognition;
    }

    // Speech output: records what would be spoken and "plays" it quickly.
    let current: { onend?: (() => void) | null } | null = null;
    let timer: ReturnType<typeof setTimeout> | undefined;
    class FakeUtterance {
      text: string;
      voice: unknown = null;
      lang = "en-GB";
      rate = 1;
      pitch = 1;
      onstart: (() => void) | null = null;
      onend: (() => void) | null = null;
      onerror: (() => void) | null = null;
      onboundary: ((e: { name: string; charIndex: number }) => void) | null = null;
      constructor(text: string) {
        this.text = text;
      }
    }
    const synth = {
      getVoices: () => [
        { name: "Test Voice", lang: "en-GB", localService: true, default: true, voiceURI: "test" },
      ],
      addEventListener() {},
      removeEventListener() {},
      cancel() {
        clearTimeout(timer);
        const u = current;
        current = null;
        u?.onend?.();
      },
      speak(u: FakeUtterance) {
        current = u;
        w.__spoken.push(u.text);
        setTimeout(() => {
          u.onstart?.();
          u.onboundary?.({ name: "word", charIndex: 0 });
        }, 10);
        timer = setTimeout(() => {
          if (current === u) {
            current = null;
            u.onend?.();
          }
        }, 150);
      },
    };
    Object.defineProperty(window, "speechSynthesis", { value: synth, configurable: true });
    w.SpeechSynthesisUtterance = FakeUtterance;
  }, options.recognition ?? true);
}

export async function say(page: Page, text: string) {
  await page.evaluate(
    (t) => (window as unknown as { __fakeSay(s: string): void }).__fakeSay(t),
    text,
  );
}

export async function spokenTexts(page: Page): Promise<string[]> {
  return page.evaluate(() => (window as unknown as { __spoken: string[] }).__spoken);
}
