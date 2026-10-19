/**
 * Simulated "speaking" loudness for the visualiser. The browser's speechSynthesis gives no
 * audio stream to analyse, so this envelope is procedural (a syllable-rate wobble) and is
 * nudged by word-boundary events when the voice provides them. It is a simulation, not an
 * analysis of the real audio.
 */
export interface SpeakingEnvelope {
  /** 0..1 at time `now` (ms). */
  level(now: number): number;
  /** A word started (from SpeechSynthesisUtterance boundary events). */
  word(now: number): void;
  /** Speech paused at punctuation. */
  pause(now: number): void;
  start(now: number): void;
  stop(now: number): void;
}

export function createSpeakingEnvelope(random: () => number = Math.random): SpeakingEnvelope {
  let speaking = false;
  let startedAt = 0;
  let stoppedAt = Number.NEGATIVE_INFINITY;
  let kick = 0;
  let kickAt = 0;
  let pauseUntil = 0;
  let lastLevel = 0;

  return {
    level(now) {
      if (!speaking) {
        // Release smoothly to zero over 200 ms after speech ends.
        const fade = Math.max(0, 1 - (now - stoppedAt) / 200);
        return lastLevel * fade;
      }
      const t = (now - startedAt) / 1000;
      const syllables = 0.5 + 0.5 * Math.sin(2 * Math.PI * 4.5 * t);
      const phrase = 0.75 + 0.25 * Math.sin(2 * Math.PI * 0.6 * t);
      const kickNow = kick * Math.exp(-(now - kickAt) / 120);
      const base = now < pauseUntil ? 0.1 : 0.3 + 0.35 * syllables * phrase;
      lastLevel = Math.min(1, Math.max(0, base + kickNow));
      return lastLevel;
    },
    word(now) {
      kick = 0.25 + 0.2 * random();
      kickAt = now;
    },
    pause(now) {
      pauseUntil = now + 250;
    },
    start(now) {
      speaking = true;
      startedAt = now;
    },
    stop(now) {
      speaking = false;
      stoppedAt = now;
    },
  };
}
