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
  type Service,
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

type PartOfDay = "any" | "morning" | "afternoon" | "evening";

const SERVICE_IDS = SERVICES.map((s) => s.id);
const PARTS: PartOfDay[] = ["any", "morning", "afternoon", "evening"];
const DAY_PATTERN = "^\\d{4}-\\d{2}-\\d{2}$";

const partOfDayProperty = {
  type: "string",
  enum: PARTS,
  description:
    "Use morning (before 12), afternoon (12 to 5 pm) or evening (from 5 pm) when the visitor asked for one; otherwise any.",
} as const;

export const RECEPTIONIST_TOOLS: Anthropic.Tool[] = [
  {
    name: "check_availability",
    description:
      "Returns the free start times for one treatment on one specific day, or why that day can't be booked (past, closed, too_far, full). Use it before offering or accepting any specific day or time, and never offer a time it didn't return. Each time comes with a 'say' label to use in your reply.",
    strict: true,
    input_schema: {
      type: "object",
      properties: {
        service_id: { type: "string", enum: SERVICE_IDS },
        day: { type: "string", description: "Calendar day as YYYY-MM-DD.", format: "date" },
        part_of_day: partOfDayProperty,
      },
      required: ["service_id", "day", "part_of_day"],
      additionalProperties: false,
    },
  },
  {
    name: "find_next_available_days",
    description:
      "Finds the next three days, from a given day inclusive, that have free times for a treatment, with up to four times spread across each day. Use it when the visitor has no day in mind, asks for the earliest slot, or the day they wanted is full. Don't use it to check one specific day.",
    strict: true,
    input_schema: {
      type: "object",
      properties: {
        service_id: { type: "string", enum: SERVICE_IDS },
        from_day: { type: "string", description: "YYYY-MM-DD", format: "date" },
        part_of_day: partOfDayProperty,
      },
      required: ["service_id", "from_day", "part_of_day"],
      additionalProperties: false,
    },
  },
  {
    name: "propose_booking",
    description:
      "Validates a complete booking (treatment, day, time, first name) and shows it to the visitor as a confirmation card. Call it only once the visitor has chosen the time themselves, not when you are just suggesting one. Then read the details back in one natural sentence and ask if that's right. It does not book anything.",
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
      "Books the waiting proposal. Call it only when the visitor's latest message is a plain yes to that proposal, with no change and no question. If they asked or changed something, handle that and propose again instead. The system independently checks the confirmation and the slot.",
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
      "Cancels one of the visitor's bookings from this conversation by reference. Confirm which booking first, and call this only when the visitor's latest message clearly confirms the cancellation.",
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

function partOf(input: Record<string, unknown>): PartOfDay {
  const value = str(input, "part_of_day");
  return PARTS.includes(value as PartOfDay) ? (value as PartOfDay) : "any";
}

function inPart(minutes: number, part: PartOfDay): boolean {
  if (part === "morning") return minutes < 12 * 60;
  if (part === "afternoon") return minutes >= 12 * 60 && minutes < 17 * 60;
  if (part === "evening") return minutes >= 17 * 60;
  return true;
}

/** Up to `count` times spread across the list, so options aren't all at opening time. */
function spreadTimes(times: readonly number[], count: number): number[] {
  if (times.length <= count) return [...times];
  const step = (times.length - 1) / (count - 1);
  return Array.from({ length: count }, (_, i) => times[Math.round(i * step)] as number);
}

const slot = (minutes: number) => ({ time: toHHMM(minutes), say: formatTime(minutes) });

/** "Thursday 22 October" -> "Thursday the 22nd of October": how a person says a date. */
export function sayDay(day: string): string {
  const [weekday, date, month] = formatDay(day).split(" ");
  const n = Number(date);
  const suffix =
    n % 100 >= 11 && n % 100 <= 13 ? "th" : ({ 1: "st", 2: "nd", 3: "rd" }[n % 10] ?? "th");
  return `${weekday} the ${n}${suffix} of ${month}`;
}

function makeReference(proposal: Proposal, bookings: readonly Booking[]): string {
  const seed =
    (Number(proposal.day.replaceAll("-", "")) + proposal.time * 7 + bookings.length * 131) % 9000;
  return `HL-${1000 + seed}`;
}

function freeIn(day: string, service: Service, ctx: ToolContext, part: PartOfDay): number[] {
  return freeTimes(day, service, ctx.now, ctx.bookings).filter((t) => inPart(t, part));
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
      const part = partOf(input);
      const check = checkDay(day, service, ctx.now, ctx.bookings);
      const free = check.ok ? freeIn(day, service, ctx, part) : [];
      return {
        content: json({
          day,
          day_label: formatDay(day),
          day_say: sayDay(day),
          service: service.name,
          part_of_day: part,
          status: !check.ok
            ? check.reason
            : free.length === 0
              ? "none_in_that_part_of_day"
              : "available",
          free_times: free.map(slot),
        }),
      };
    }

    case "find_next_available_days": {
      const from = str(input, "from_day");
      if (!service || !isDay(from)) return error("Invalid service_id or from_day.");
      const part = partOf(input);
      const today = toDayString(ctx.now);
      let cursor = from < today ? today : from;
      const days: {
        day: string;
        day_label: string;
        day_say: string;
        times: ReturnType<typeof slot>[];
      }[] = [];
      // Walk forward through open days until three have times in the requested part of the day.
      for (let guard = 0; guard < 12 && days.length < 3; guard++) {
        const [next] = nextOpenDays(cursor, service, ctx.now, ctx.bookings, 1);
        if (!next) break;
        const free = freeIn(next, service, ctx, part);
        if (free.length > 0) {
          days.push({
            day: next,
            day_label: formatDay(next),
            day_say: sayDay(next),
            times: spreadTimes(free, 4).map(slot),
          });
        }
        cursor = addDays(next, 1);
      }
      return { content: json({ service: service.name, part_of_day: part, days }) };
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
      if (!check.ok)
        return error(`Day not bookable: ${check.reason}. Offer the nearest alternatives.`);
      if (!freeTimes(day, service, ctx.now, ctx.bookings).includes(minutes)) {
        return error("That time isn't free. Check availability and offer free times instead.");
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
          summary_say: `a ${service.name.toLowerCase()} on ${sayDay(day)} at ${formatTime(minutes)} for ${name}`,
          duration_say: `about ${service.minutes} minutes`,
          price_say: service.price,
          next_step:
            "Read this back in one natural sentence and ask if that's right. Book only after a plain yes in their next message.",
        }),
        event: { type: "proposed", proposal },
      };
    }

    case "book_appointment": {
      const pending = ctx.pendingFromEarlierTurn;
      if (!pending || pending.id !== str(input, "proposal_id")) {
        return error(
          "Not booked: no matching proposal was shown to the visitor in an earlier turn. Propose the booking first and ask if it's right.",
        );
      }
      if (!isClearYes(ctx.latestVisitorMessage)) {
        return error(
          "Not booked: their last message wasn't a plain yes. Deal with what they asked or changed, or ask naturally whether to go ahead, e.g. 'Shall I book that for you?'",
        );
      }
      const pendingService = SERVICES.find((s) => s.id === pending.serviceId);
      if (
        !pendingService ||
        !freeTimes(pending.day, pendingService, ctx.now, ctx.bookings).includes(pending.time)
      ) {
        return error("Not booked: that slot has just been taken. Apologise and offer other times.");
      }
      const booking: Booking = {
        reference: makeReference(pending, ctx.bookings),
        serviceId: pending.serviceId,
        day: pending.day,
        time: pending.time,
        name: pending.name,
      };
      return {
        content: json({
          booked: true,
          reference: booking.reference,
          reference_say: booking.reference
            .split("")
            .filter((c) => c !== "-")
            .join(" "),
        }),
        event: { type: "booked", booking },
      };
    }

    case "cancel_appointment": {
      const reference = str(input, "reference")?.toUpperCase();
      const booking = ctx.bookings.find((b) => b.reference === reference);
      if (!booking) return error("No booking with that reference in this conversation.");
      if (!isClearYesToCancel(ctx.latestVisitorMessage)) {
        return error("Not cancelled yet: ask them to confirm which booking to cancel first.");
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

/** Three weeks of dates with weekday names, so the model never does calendar arithmetic. */
export function calendarContext(now: Date, days = 21): string {
  const today = toDayString(now);
  const minutes = now.getHours() * 60 + now.getMinutes();
  const upcoming = Array.from({ length: days }, (_, i) => {
    const day = addDays(today, i);
    return `${formatDay(day)} = ${day}`;
  });
  return [
    `Current local time: ${formatDay(today)} (${today}), ${formatTime(minutes - (minutes % 5))}.`,
    `Bookings are possible up to ${CLINIC.bookingWindowDays} days ahead; for later dates use the day_label the tools return.`,
    "Upcoming days:",
    ...upcoming,
  ].join("\n");
}

/**
 * Deterministic confirmation, run by code before the model replies: if a proposal was read back
 * in the receptionist's previous message and the visitor's reply is a plain yes, book it now.
 * Weaker models sometimes re-read the details instead of booking; booking must not depend on that.
 */
export function bookIfClearYes(
  ctx: ToolContext,
  previousReceptionistText: string,
): ToolOutput | null {
  const pending = ctx.pendingFromEarlierTurn;
  if (!pending || !isClearYes(ctx.latestVisitorMessage)) return null;
  // The "yes" must answer the read-back, not some other question asked since.
  const said = previousReceptionistText.toLowerCase();
  const [h, m] = [Math.floor(pending.time / 60), pending.time % 60];
  const timeMentioned =
    said.includes(formatTime(pending.time).toLowerCase()) ||
    said.includes(toHHMM(pending.time)) ||
    said.includes(`${h % 12 === 0 ? 12 : h % 12}${m ? `:${String(m).padStart(2, "0")}` : ""}`);
  const dayMentioned = said.includes(String(Number(pending.day.slice(8))));
  if (!timeMentioned || !dayMentioned) return null;
  const output = executeTool("book_appointment", { proposal_id: pending.id }, ctx);
  return output.event?.type === "booked" ? output : null;
}
