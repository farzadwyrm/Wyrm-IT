import {
  type Booking,
  type BusinessProfile,
  DEMO_PROFILE,
  formatDay,
  formatTime,
} from "@wyrm/receptionist";
import type { Proposal, ToolEvent } from "./tools";

/**
 * Checks a receptionist reply against what actually happened this turn, before the visitor sees
 * or hears it. Models (especially small free ones) sometimes say "you're booked" when nothing was
 * booked, or read back a new time without formally proposing it. Code catches that; the model
 * gets one chance to correct itself, then a safe, honest line is used instead.
 */

/** How many times a model may rewrite a reply that failed the check. */
export const MAX_CORRECTIONS = 1;

export type ReplyIssue =
  | { kind: "false_booking_claim"; correction: string }
  | { kind: "internal_id"; correction: string }
  | { kind: "unproposed_read_back"; correction: string };

const CLAIMS_BOOKING =
  /\b(you'?re (all )?(booked|set)|(is|are|has been|have been|now|all) (booked|confirmed|scheduled)|all (done|set)|booked (you|it|that) (in|for)|i'?ve (booked|scheduled|confirmed)|your (booking|appointment) (is|has been) (confirmed|made|booked)|reference (number )?(is )?(hl|p)-)/i;

const ASKS_TO_CONFIRM =
  /\b(is that (right|correct|ok|okay)|shall i (book|go ahead|confirm)|should i (book|go ahead)|does that (sound|look) (right|good|ok)|want me to (book|go ahead)|would you like me to book|can i (book|confirm))\b/i;

const INTERNAL_ID = /\bP-\d{8}-\d{4}-[a-z]+\b/i;

const MENTIONS_TIME =
  /\b\d{1,2}(:\d{2})?\s?(am|pm|a\.m\.|p\.m\.)|\b\d{1,2}:\d{2}\b|\b(noon|midday)\b/i;

function mentions(text: string, slot: { day: string; time: number }): boolean {
  const t = text.toLowerCase();
  const time = formatTime(slot.time).toLowerCase(); // "4 pm", "9:30 am"
  const hour = time.split(/[\s:]/)[0] ?? "";
  const day = String(Number(slot.day.slice(8)));
  const timeSaid = t.includes(time) || new RegExp(`\\b${hour}\\b`).test(t);
  return timeSaid && new RegExp(`\\b${day}(st|nd|rd|th)?\\b`).test(t);
}

export function reviewReply(
  text: string,
  context: {
    eventsThisTurn: readonly ToolEvent[];
    pending: Proposal | null;
    bookings: readonly Booking[];
    profile?: BusinessProfile;
  },
): ReplyIssue | null {
  const bookedNow = context.eventsThisTurn.some((e) => e.type === "booked");
  const proposedNow = context.eventsThisTurn.some((e) => e.type === "proposed");

  if (INTERNAL_ID.test(text)) {
    return {
      kind: "internal_id",
      correction:
        "Automatic check (not from the visitor): your reply contains an internal proposal id. Never mention proposal ids; only booking references from book_appointment (like HL-1234) may be given. Rewrite your reply.",
    };
  }

  // Talking about a booking that really exists (e.g. the goodbye summary) is fine.
  const aboutRealBooking = context.bookings.some(
    (b) => text.toUpperCase().includes(b.reference) || mentions(text, b),
  );
  if (!bookedNow && !aboutRealBooking && CLAIMS_BOOKING.test(text)) {
    return {
      kind: "false_booking_claim",
      correction:
        "Automatic check (not from the visitor): your reply says the appointment is booked or confirmed, but nothing was booked this turn. Don't claim a booking. If they agreed to specific details, call propose_booking with exactly those details and ask if that's right; otherwise answer what they said. Rewrite your reply.",
    };
  }

  // A read-back must match a real proposal: either one made this turn, or the waiting one.
  if (!proposedNow && ASKS_TO_CONFIRM.test(text) && MENTIONS_TIME.test(text)) {
    const pending = context.pending;
    if (!pending || !mentions(text, pending)) {
      return {
        kind: "unproposed_read_back",
        correction:
          "Automatic check (not from the visitor): you asked the visitor to confirm booking details that haven't been proposed. Call propose_booking with the exact treatment, day, time and first name first (check availability if needed), then read it back. Rewrite your reply after that.",
      };
    }
  }
  return null;
}

/** An honest reply to use if the model still gets it wrong after a correction. */
export function safeReply(
  pending: Proposal | null,
  bookings: readonly Booking[],
  profile: BusinessProfile = DEMO_PROFILE,
): string {
  if (pending) {
    const service =
      profile.services.find((s) => s.id === pending.serviceId)?.name.toLowerCase() ?? "visit";
    return `Just to be sure, nothing is booked yet. Would you like me to book a ${service} on ${formatDay(pending.day)} at ${formatTime(pending.time)} for ${pending.name}?`;
  }
  if (bookings.length > 0) {
    const last = bookings.at(-1) as Booking;
    return `Your appointment on ${formatDay(last.day)} at ${formatTime(last.time)} is booked, reference ${last.reference}. Is there anything else I can help with?`;
  }
  return "Sorry, I haven't booked anything yet. Which day and time would you like?";
}
