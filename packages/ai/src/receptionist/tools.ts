import type Anthropic from "@anthropic-ai/sdk";
import {
  addDays,
  type Booking,
  CLINIC,
  checkDay,
  formatDay,
  formatTime,
  freeTimes,
  isClearYes,
  isClearYesToCancel,
  nextOpenDays,
  SERVICES,
  toDayString,
} from "@wyrm/receptionist";

/** A booking the agent has read back to the visitor and is waiting for a yes on. */
export interface Proposal {
  id: string;
  serviceId: string;
  day: string;
  time: number;
  name: string;
}

/** Everything a tool may read or change. Owned by the visitor's browser, sent each turn. */
export interface ToolContext {
  now: Date;
  bookings: Booking[];
  /** Proposal shown in an earlier turn (only this one can be booked now). */
  pendingFromEarlierTurn: Proposal | null;
  /** The visitor's latest message: the only source of a yes. */
  latestVisitorMessage: string;
}

export type ToolEvent =
  | { type: "proposed"; proposal: Proposal }
  | { type: "booked"; booking: Booking }
  | { type: "cancelled"; booking: Booking };

export interface ToolOutput {
  /** JSON string returned to the model. */
  content: string;
  isError?: boolean;
  event?: ToolEvent;
}

const SERVICE_IDS = SERVICES.map((s) => s.id);
const DAY_PATTERN = "^\\d{4}-\\d{2}-\\d{2}$";

export const RECEPTIONIST_TOOLS: Anthropic.Tool[] = [
  {
    name: "check_availability",
    description:
      "Returns the free start times for a treatment on one day, or why the day cannot be booked (past, closed, too_far, full). Always call this before offering or accepting a time; never guess availability.",
    strict: true,
    input_schema: {
      type: "object",
      properties: {
        service_id: { type: "string", enum: SERVICE_IDS },
        day: { type: "string", description: "Calendar day as YYYY-MM-DD.", format: "date" },
      },
      required: ["service_id", "day"],
      additionalProperties: false,
    },
  },
  {
    name: "find_next_available_days",
    description:
      "Finds the next three days (from a given day, inclusive) that have free times for a treatment, with a few example times each. Use when the visitor has no day in mind or asks for the earliest slot.",
    strict: true,
    input_schema: {
      type: "object",
      properties: {
        service_id: { type: "string", enum: SERVICE_IDS },
        from_day: { type: "string", description: "YYYY-MM-DD", format: "date" },
      },
      required: ["service_id", "from_day"],
      additionalProperties: false,
    },
  },
  {
    name: "propose_booking",
    description:
      "Validates a complete booking (treatment, day, time, first name) and shows it to the visitor as a confirmation card. After calling this, read the details back and ask the visitor to confirm. It does not book anything.",
    strict: true,
    input_schema: {
      type: "object",
      properties: {
        service_id: { type: "string", enum: SERVICE_IDS },
        day: { type: "string", description: "YYYY-MM-DD", format: "date" },
        time: { type: "string", description: "Start time, 24-hour HH:MM, e.g. 09:30 or 14:00" },
        name: { type: "string", description: "Visitor's first name as they gave it." },
      },
      required: ["service_id", "day", "time", "name"],
      additionalProperties: false,
    },
  },
  {
    name: "book_appointment",
    description:
      "Books the proposal the visitor saw in an earlier turn. Only call this when the visitor's latest message clearly confirms it. The system independently checks the confirmation and the slot.",
    strict: true,
    input_schema: {
      type: "object",
      properties: {
        proposal_id: { type: "string" },
      },
      required: ["proposal_id"],
      additionalProperties: false,
    },
  },
  {
    name: "cancel_appointment",
    description:
      "Cancels one of the visitor's bookings from this conversation by reference. Ask first and only call this when the visitor's latest message clearly confirms the cancellation.",
    strict: true,
    input_schema: {
      type: "object",
      properties: {
        reference: { type: "string", description: "Booking reference, e.g. HL-1234" },
      },
      required: ["reference"],
      additionalProperties: false,
    },
  },
];

const toHHMM = (minutes: number) =>
  `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`;
const fromHHMM = (value: string) => {
  const [h, m] = value.split(":").map(Number);
  return (h ?? 0) * 60 + (m ?? 0);
};

const json = (value: unknown): string => JSON.stringify(value);
const error = (message: string): ToolOutput => ({
  content: json({ error: message }),
  isError: true,
});

function str(input: Record<string, unknown>, key: string): string | null {
  const value = input[key];
  return typeof value === "string" ? value : null;
}

const isDay = (value: string | null): value is string =>
  value !== null && new RegExp(DAY_PATTERN).test(value);

function makeReference(proposal: Proposal, bookings: readonly Booking[]): string {
  const seed =
    (Number(proposal.day.replaceAll("-", "")) + proposal.time * 7 + bookings.length * 131) % 9000;
  return `HL-${1000 + seed}`;
}

/** Runs one tool call against the demo calendar. Never throws. */
export function executeTool(
  name: string,
  input: Record<string, unknown>,
  ctx: ToolContext,
): ToolOutput {
  const service = SERVICES.find((s) => s.id === str(input, "service_id"));

  switch (name) {
    case "check_availability": {
      const day = str(input, "day");
      if (!service || !isDay(day)) return error("Invalid service_id or day.");
      const check = checkDay(day, service, ctx.now, ctx.bookings);
      const free = check.ok ? freeTimes(day, service, ctx.now, ctx.bookings) : [];
      return {
        content: json({
          day,
          day_label: formatDay(day),
          service: service.name,
          status: check.ok ? "available" : check.reason,
          free_times: free.map(toHHMM),
        }),
      };
    }

    case "find_next_available_days": {
      const from = str(input, "from_day");
      if (!service || !isDay(from)) return error("Invalid service_id or from_day.");
      const today = toDayString(ctx.now);
      const start = from < today ? today : from;
      const days = nextOpenDays(start, service, ctx.now, ctx.bookings).map((day) => {
        const free = freeTimes(day, service, ctx.now, ctx.bookings);
        return {
          day,
          day_label: formatDay(day),
          example_times: free.slice(0, 4).map(toHHMM),
          free_count: free.length,
        };
      });
      return { content: json({ service: service.name, days }) };
    }

    case "propose_booking": {
      const day = str(input, "day");
      const time = str(input, "time");
      const name = str(input, "name")?.trim() ?? "";
      if (!service || !isDay(day) || !time || !/^\d{2}:\d{2}$/.test(time)) {
        return error("Invalid service_id, day or time.");
      }
      if (!/^[\p{L}][\p{L}' -]{0,38}$/u.test(name)) {
        return error("Ask the visitor for a first name (letters only) before proposing.");
      }
      const minutes = fromHHMM(time);
      const check = checkDay(day, service, ctx.now, ctx.bookings);
      if (!check.ok) return error(`Day not bookable: ${check.reason}.`);
      if (!freeTimes(day, service, ctx.now, ctx.bookings).includes(minutes)) {
        return error("That time is not free. Call check_availability and offer free times.");
      }
      const proposal: Proposal = {
        id: `P-${day.replaceAll("-", "")}-${time.replace(":", "")}-${service.id}`,
        serviceId: service.id,
        day,
        time: minutes,
        name,
      };
      return {
        content: json({
          proposal_id: proposal.id,
          read_back: `${service.name} on ${formatDay(day)} at ${formatTime(minutes)} for ${name}, about ${service.minutes} minutes, ${service.price}.`,
          next_step:
            "Read this back and ask the visitor to confirm. Book only after a clear yes in their next message.",
        }),
        event: { type: "proposed", proposal },
      };
    }

    case "book_appointment": {
      const pending = ctx.pendingFromEarlierTurn;
      if (!pending || pending.id !== str(input, "proposal_id")) {
        return error(
          "No matching proposal was shown to the visitor in an earlier turn. Call propose_booking first and ask them to confirm.",
        );
      }
      if (!isClearYes(ctx.latestVisitorMessage)) {
        return error(
          "The visitor has not clearly confirmed. Ask them to confirm with a yes, or what to change.",
        );
      }
      const pendingService = SERVICES.find((s) => s.id === pending.serviceId);
      if (
        !pendingService ||
        !freeTimes(pending.day, pendingService, ctx.now, ctx.bookings).includes(pending.time)
      ) {
        return error("That slot is no longer free. Offer other times.");
      }
      const booking: Booking = {
        reference: makeReference(pending, ctx.bookings),
        serviceId: pending.serviceId,
        day: pending.day,
        time: pending.time,
        name: pending.name,
      };
      return {
        content: json({ booked: true, reference: booking.reference }),
        event: { type: "booked", booking },
      };
    }

    case "cancel_appointment": {
      const reference = str(input, "reference")?.toUpperCase();
      const booking = ctx.bookings.find((b) => b.reference === reference);
      if (!booking) return error("No booking with that reference in this conversation.");
      if (!isClearYesToCancel(ctx.latestVisitorMessage)) {
        return error("Ask the visitor to confirm the cancellation first.");
      }
      return {
        content: json({ cancelled: true, reference }),
        event: { type: "cancelled", booking },
      };
    }

    default:
      return error(`Unknown tool ${name}.`);
  }
}

/** Two weeks of dates with weekday names, so the model never does calendar arithmetic. */
export function calendarContext(now: Date): string {
  const today = toDayString(now);
  const minutes = now.getHours() * 60 + now.getMinutes();
  const days = Array.from({ length: 14 }, (_, i) => {
    const day = addDays(today, i);
    return `${formatDay(day)} = ${day}`;
  });
  return [
    `Current local time: ${formatDay(today)} (${today}), ${formatTime(minutes - (minutes % 5))}.`,
    `Bookings are possible up to ${CLINIC.bookingWindowDays} days ahead.`,
    "Upcoming days:",
    ...days,
  ].join("\n");
}
