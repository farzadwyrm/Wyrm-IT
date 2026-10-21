import type { FaqEntry } from "./types";

/** Deterministic rules that run before any model. Inputs are untrusted customer text. */

const normalize = (text: string) =>
  text.toLowerCase().normalize("NFKD").replace(/[̀-ͯ]/g, "").replace(/\s+/g, " ").trim();

const STOP = /^(stop|unsubscribe|stop all|cancel messages|opt out|optout|end)\.?$/;
const HUMAN =
  /\b(real person|human|someone real|speak to (a |an )?(person|agent|someone|staff|manager)|talk to (a |an )?(person|someone|staff|manager)|operator|receptionist please)\b/;

export function isStopRequest(text: string) {
  return STOP.test(normalize(text));
}

export function wantsHuman(text: string) {
  return HUMAN.test(normalize(text));
}

export function matchFaq(text: string, faq: readonly FaqEntry[]): FaqEntry | null {
  const t = normalize(text);
  if (t.length > 300) return null; // long messages need understanding, not keyword matching
  return faq.find((f) => f.keywords.length > 0 && f.keywords.every((k) => t.includes(k))) ?? null;
}

/**
 * Signs that a message tries to steer the AI or claim authority. They change nothing (text can
 * never approve or unlock anything) but are logged so staff can see attempts.
 */
const INJECTION: [RegExp, string][] = [
  [/ignore (all |any |the )?(previous|prior|above) (instructions|rules)/, "injection_override"],
  [/\b(system|developer) (prompt|message|instructions?)\b/, "injection_system"],
  [/\b(you are now|act as|pretend to be)\b/, "injection_roleplay"],
  [/\b(i am|i'm|this is) (the )?(owner|admin|manager|staff)\b/, "authority_claim"],
  [
    /\b(approve|authori[sz]e|confirm) (this|the) (refund|payment|cancellation|discount)\b/,
    "approval_claim",
  ],
];

export function guardrailFlags(text: string): string[] {
  const t = normalize(text);
  return INJECTION.filter(([pattern]) => pattern.test(t)).map(([, flag]) => flag);
}
