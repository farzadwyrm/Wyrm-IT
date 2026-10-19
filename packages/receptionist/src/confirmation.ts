/**
 * Deterministic check that a visitor's message is a clear "yes". The AI agent may only
 * book or cancel when this returns true for the visitor's latest message: the model
 * cannot talk itself past this rule.
 */

const AFFIRMATIVE =
  /\b(yes|yeah|yep|yup|ya|sure|correct|confirm|confirmed|ok|okay|go ahead|book it|book that|sounds good|perfect|please do|that works|that's right|thats right|right|great|absolutely|definitely|do it)\b/;

const HESITATION =
  /\b(no|nope|nah|not|don't|dont|wait|hold on|change|actually|instead|but|maybe|hmm|cancel)\b|\?/;

export function isClearYes(message: string): boolean {
  const t = message.toLowerCase().trim();
  if (t.length === 0 || t.length > 80) return false;
  return AFFIRMATIVE.test(t) && !HESITATION.test(t);
}

/** Clear yes to a cancellation: "cancel" is expected here, other hesitation is not. */
export function isClearYesToCancel(message: string): boolean {
  const t = message.toLowerCase().trim();
  if (t.length === 0 || t.length > 80) return false;
  const withoutCancel = t.replace(
    /\bcancel(led)?( it| that| my appointment| the appointment)?\b/g,
    "",
  );
  return AFFIRMATIVE.test(t) && !HESITATION.test(withoutCancel);
}
