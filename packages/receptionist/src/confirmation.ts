/**
 * Deterministic check that a visitor's message is a plain "yes". The AI agent may only book or
 * cancel when this returns true for the visitor's latest message, so the model cannot talk itself
 * past this rule. Messages often come from speech recognition, which adds no question marks, so a
 * yes that also asks something, changes something or mentions a day or time is NOT a plain yes.
 */

const AFFIRMATIVE =
  /\b(yes|yeah|yep|yup|ya|aye|sure|correct|confirm|confirmed|ok|okay|go ahead|go on|book it|book that|sounds good|perfect|please do|that works|that's right|thats right|that's it|thats it|right|great|absolutely|definitely|do it|fine|lovely|brilliant|uh huh|mm-?hmm)\b/;

// Polite phrases that contain hesitation words but mean yes.
const HARMLESS = /\b(no problem|not a problem|no worries|why not|go on then|mm-?hmm)\b/g;

const HESITATION = new RegExp(
  [
    // Disagreement or doubt.
    "\\b(no|nope|nah|not|don't|dont|wait|hold on|hang on|change|actually|instead|but|maybe|hmm|cancel|rather|unless|though|better|else|different|another|other)\\b",
    // Questions, even without a question mark.
    "\\b(what|how|when|which|where|why|who|can|could|would|will|is there|are there|do you|does)\\b",
    // Any day or time means they're specifying something, not just agreeing.
    "\\b(today|tomorrow|tonight|morning|afternoon|evening|noon|midday|monday|tuesday|wednesday|thursday|friday|saturday|sunday|mon|tue|tues|wed|thu|thur|thurs|fri|sat|sun|week|weekend|am|pm|o'?clock|half|quarter|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve)\\b",
    "\\d",
    "\\?",
  ].join("|"),
);

function isPlainAgreement(t: string): boolean {
  if (t.length === 0 || t.length > 80) return false;
  const withoutHarmless = t.replace(HARMLESS, "");
  return AFFIRMATIVE.test(t) && !HESITATION.test(withoutHarmless);
}

export function isClearYes(message: string): boolean {
  return isPlainAgreement(message.toLowerCase().trim());
}

/** Clear yes to a cancellation: "cancel" is expected here, other hesitation is not. */
export function isClearYesToCancel(message: string): boolean {
  const t = message.toLowerCase().trim();
  const withoutCancel = t.replace(
    /\b(please )?cancel(led)?( it| that| my appointment| the appointment| the booking)?( please)?\b/g,
    "",
  );
  return AFFIRMATIVE.test(t) && isPlainAgreement(withoutCancel.trim() || "ok");
}
