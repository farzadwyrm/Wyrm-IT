import type { ChatMessage, Proposal, ToolEvent } from "@wyrm/ai";
import type { Booking } from "@wyrm/receptionist";

/** Body of POST /api/receptionist. All conversation state lives in the visitor's browser. */
export interface ReceptionistRequest {
  history: ChatMessage[];
  bookings: Booking[];
  pending: Proposal | null;
  /** The visitor's local date and time, so "today" and "tomorrow" mean what they expect. */
  clock: { day: string; minutes: number };
}

export type ReceptionistResponse =
  | { status: "ok"; text: string; events: ToolEvent[] }
  /** The AI is off, over budget or failed: the page switches to the basic receptionist. */
  | { status: "fallback"; reason: string };
