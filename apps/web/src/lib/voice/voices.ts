/**
 * Picks the most natural-sounding English voice the visitor's browser offers.
 * Pure scoring logic so it can be unit-tested without a browser.
 */

export interface VoiceInfo {
  name: string;
  lang: string;
  localService: boolean;
}

/** Higher is better. Neural/natural voices sound far more human than classic system voices. */
export function scoreVoice(voice: VoiceInfo): number {
  const name = voice.name.toLowerCase();
  const lang = voice.lang.toLowerCase().replace("_", "-");
  if (!lang.startsWith("en")) return -1;

  let score = 0;
  if (/natural|neural|premium|enhanced/.test(name)) score += 50;
  if (/^google /.test(name)) score += 30; // Chrome's online voices
  if (/sonia|libby|maisie|aria|jenny|emma|ava|serena|kate|samantha|female/.test(name)) score += 8;
  if (lang === "en-gb")
    score += 10; // the fictional clinic speaks British English
  else if (lang === "en-us") score += 6;
  else if (lang === "en-ie" || lang === "en-au") score += 4;
  if (/espeak|compact|novelty|whisper|bad news|bells|zarvox|trinoids|albert/.test(name))
    score -= 60;
  return score;
}

export function pickVoice<T extends VoiceInfo>(voices: readonly T[]): T | null {
  let best: T | null = null;
  let bestScore = -1;
  for (const voice of voices) {
    const score = scoreVoice(voice);
    if (score > bestScore) {
      best = voice;
      bestScore = score;
    }
  }
  return best;
}
