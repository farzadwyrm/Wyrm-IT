import {
  type Booking,
  checkDay,
  filterByPart,
  freeTimes,
  nextOpenDays,
  spread,
} from "./availability";
import { CLINIC, OPENING_HOURS, SERVICES, type Service } from "./clinic";
import {
  formatDay,
  formatTime,
  type PartOfDay,
  parseDay,
  parsePartOfDay,
  parseTime,
  toDayString,
  weekdayOf,
} from "./dates";

/**
 * Rule-based receptionist for the free demo. Pure and deterministic: give it the
 * conversation state, the visitor's message and the current time; it returns the next
 * state and a reply. Nothing is ever really booked.
 *
 * Safety rules (covered by tests): never book without an explicit yes; reject past,
 * closed, too-far and taken times; accept corrections at any step; answer side
 * questions without losing the booking in progress.
 */

export type Stage = "idle" | "service" | "day" | "time" | "name" | "confirm" | "cancel_confirm";

export interface Draft {
  serviceId?: string;
  day?: string;
  time?: number;
  name?: string;
  part?: PartOfDay;
}

export interface ConversationState {
  stage: Stage;
  draft: Draft;
  bookings: Booking[];
}

export interface Reply {
  text: string;
  /** Tappable quick replies for the UI. */
  suggestions: string[];
  /** Set when this turn created or cancelled a (demo) booking. */
  event?: { type: "booked" | "cancelled"; booking: Booking };
}

export interface Turn {
  state: ConversationState;
  reply: Reply;
}

export function initialState(): ConversationState {
  return { stage: "idle", draft: {}, bookings: [] };
}

const IDLE_SUGGESTIONS = ["Book a check-up", "Opening hours", "Prices", "Where are you?"];

export function greeting(): Reply {
  return {
    text: `Hello, you're through to ${CLINIC.name}. I can book an appointment or answer questions about opening hours, prices and how to find us. How can I help?`,
    suggestions: IDLE_SUGGESTIONS,
  };
}

// ---------------------------------------------------------------- understanding

const has = (t: string, pattern: RegExp) => pattern.test(t);

const escapeRegExp = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** Whole-word match, so a name like "Paine" never reads as "pain". */
function detectService(t: string): Service | undefined {
  return SERVICES.find((s) =>
    s.keywords.some((k) => new RegExp(`\\b${escapeRegExp(k)}\\b`).test(t)),
  );
}

const isYes = (t: string) =>
  has(
    t,
    /^\s*(yes|yeah|yep|yup|sure|correct|confirm|confirmed|ok|okay|please do|sounds good|that's right|thats right|perfect|go ahead|book it|do it)\b/,
  );
const isNo = (t: string) => has(t, /^\s*(no|nope|nah|not quite|wrong|not really)\b/);
const isAbort = (t: string) =>
  has(t, /\b(never ?mind|forget it|stop|start over|restart|cancel (that|this|it|the booking))\b/);
const isBookingIntent = (t: string) =>
  has(t, /\b(book|booking|appointment|schedule|reserve|come in|see (a|the) dentist|visit)\b/);
const isCancelIntent = (t: string) => has(t, /\b(cancel|reschedule|move my|change my)\b/);

type Aside = "hours" | "location" | "price" | "services" | "human";

function detectAside(t: string): Aside | null {
  if (has(t, /\b(how much|price|prices|cost|costs|fee|fees|pricing|expensive)\b/)) return "price";
  if (
    has(
      t,
      /\b(opening hours|hours|when are you open|are you open|what time do you (open|close)|closing time)\b/,
    )
  )
    return "hours";
  if (has(t, /\b(where are you|address|located|location|parking|park|directions|find you|bus)\b/))
    return "location";
  if (
    has(
      t,
      /\b(what (services|treatments)|which (services|treatments)|what do you (do|offer)|services|treatments)\b/,
    )
  )
    return "services";
  if (has(t, /\b(human|real person|speak to|talk to|staff|call me|manager)\b/)) return "human";
  return null;
}

function answerAside(aside: Aside, t: string): string {
  switch (aside) {
    case "hours":
      return `We're open ${CLINIC.hoursText}`;
    case "location":
      return `We're at ${CLINIC.address}. ${CLINIC.parking}`;
    case "price": {
      const service = detectService(t);
      if (service)
        return `A ${service.name.toLowerCase()} costs ${service.price} and takes about ${service.minutes} minutes.`;
      return `Our prices: ${SERVICES.map((s) => `${s.name.toLowerCase()} ${s.price}`).join(", ")}.`;
    }
    case "services":
      return `We offer ${SERVICES.map((s) => s.name.toLowerCase()).join(", ")}.`;
    case "human":
      return "In the real system I'd pass a message to the team and they'd call you back. In this demo I can only help with bookings and questions.";
  }
}

function extractName(text: string): string | null {
  const cleaned = text
    .trim()
    .replace(/^(my name is|my name's|i'm|i am|it's|it is|this is|name is|name:|call me)\s+/i, "")
    .replace(/[.!]+$/, "")
    .trim();
  if (!/^[\p{L}][\p{L}' -]{0,38}[\p{L}]$/u.test(cleaned)) return null;
  if (cleaned.split(/\s+/).length > 4) return null;
  return cleaned
    .split(/\s+/)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

// ---------------------------------------------------------------- booking logic

const serviceOf = (draft: Draft) => SERVICES.find((s) => s.id === draft.serviceId);
/** For day checks before a treatment is chosen, use the shortest one. */
const serviceForChecks = (draft: Draft): Service => serviceOf(draft) ?? (SERVICES[0] as Service);

function closestTimes(times: readonly number[], target: number, count = 3): number[] {
  return [...times]
    .sort((a, b) => Math.abs(a - target) - Math.abs(b - target) || a - b)
    .slice(0, count)
    .sort((a, b) => a - b);
}

function describeDayProblem(
  reason: "past" | "closed" | "too_far" | "full",
  day: string | null,
): string {
  switch (reason) {
    case "past":
      return "That day has already passed, so I can't book it.";
    case "closed":
      return day ? `We're closed on ${formatDay(day).split(" ")[0]}s.` : "We're closed that day.";
    case "too_far":
      return `I can only book up to ${CLINIC.bookingWindowDays} days ahead.`;
    case "full":
      return day ? `${formatDay(day)} is fully booked.` : "That day is fully booked.";
  }
}

function describeTimeProblem(day: string, time: number, now: Date, service: Service): string {
  const hours = OPENING_HOURS[weekdayOf(day)];
  const weekday = formatDay(day).split(" ")[0];
  if (hours && (time < hours[0] || time >= hours[1])) {
    return `We're open ${formatTime(hours[0])} to ${formatTime(hours[1])} on ${weekday}s, so ${formatTime(time)} doesn't work.`;
  }
  if (hours && time + service.minutes > hours[1]) {
    return `A ${service.name.toLowerCase()} at ${formatTime(time)} wouldn't finish before we close.`;
  }
  const nowMinutes = now.getHours() * 60 + now.getMinutes();
  if (day === toDayString(now) && time < nowMinutes + CLINIC.minimumNoticeMinutes) {
    return `${formatTime(time)} today has passed or is too soon for us to prepare.`;
  }
  if (time % CLINIC.slotMinutes !== 0) {
    return `Appointments start on the hour or half past, so ${formatTime(time)} isn't available.`;
  }
  return `${formatTime(time)} is already taken.`;
}

interface Applied {
  draft: Draft;
  problems: string[];
  /** True if the message changed anything in the booking. */
  changed: boolean;
  /** Free times closest to a rejected time, offered instead of the usual list. */
  nearest: number[];
}

/** Reads booking details from the message and validates them against the calendar. */
function applyDetails(state: ConversationState, text: string, now: Date): Applied {
  const t = text.toLowerCase();
  const draft: Draft = { ...state.draft };
  const problems: string[] = [];
  let nearest: number[] = [];
  let changed = false;

  const service = detectService(t);
  if (service && service.id !== draft.serviceId) {
    draft.serviceId = service.id;
    changed = true;
  }

  const part = parsePartOfDay(t);
  if (part) {
    draft.part = part;
    changed = true;
  }

  const dayParse = parseDay(t, now);
  if (dayParse) {
    changed = true;
    if (dayParse.kind === "past") {
      problems.push(describeDayProblem("past", null));
    } else if (dayParse.kind === "invalid") {
      problems.push("I couldn't find that date in the calendar. Could you check it?");
    } else {
      const check = checkDay(dayParse.day, serviceForChecks(draft), now, state.bookings);
      if (check.ok) {
        if (draft.day !== dayParse.day) delete draft.time;
        draft.day = dayParse.day;
      } else {
        problems.push(describeDayProblem(check.reason, dayParse.day));
        delete draft.day;
        delete draft.time;
      }
    }
  }

  const time = parseTime(t, { bare: state.stage === "time" });
  if (time !== null) {
    changed = true;
    draft.time = time;
  } else if (part && draft.time !== undefined) {
    // "Make it the morning instead": drop a chosen time that is in the other half of the day.
    const isMorning = draft.time < 12 * 60;
    if ((part === "morning") !== isMorning) delete draft.time;
  }

  // Re-validate the time against the (possibly new) day and treatment.
  if (draft.day && draft.time !== undefined) {
    const free = freeTimes(draft.day, serviceForChecks(draft), now, state.bookings);
    if (!free.includes(draft.time)) {
      const requested = draft.time;
      problems.push(describeTimeProblem(draft.day, requested, now, serviceForChecks(draft)));
      delete draft.time;
      nearest = closestTimes(free, requested);
    }
  }

  // A treatment change can make the chosen day impossible (e.g. too long for Saturday).
  if (service && draft.day && !checkDay(draft.day, service, now, state.bookings).ok) {
    delete draft.day;
    delete draft.time;
  }

  return { draft, problems, changed, nearest };
}

/**
 * Decides the next question from what is still missing. `nearestTimes`, when given,
 * replaces the usual time suggestions (after a requested time was rejected).
 */
function nextStep(
  draft: Draft,
  bookings: Booking[],
  now: Date,
  nearestTimes: readonly number[] = [],
): { stage: Stage; reply: Reply } {
  const service = serviceOf(draft);
  if (!service) {
    return {
      stage: "service",
      reply: {
        text: "Which treatment is it for: a check-up, a hygiene cleaning, teeth whitening, or an urgent visit?",
        suggestions: SERVICES.map((s) => s.name),
      },
    };
  }

  if (!draft.day) {
    const days = nextOpenDays(toDayString(now), service, now, bookings);
    return {
      stage: "day",
      reply: {
        text: `Which day suits you for the ${service.name.toLowerCase()}? The next days with free times are ${days.map(formatDay).join(", ")}.`,
        suggestions: days.map(formatDay),
      },
    };
  }

  if (draft.time === undefined && nearestTimes.length > 0) {
    return {
      stage: "time",
      reply: {
        text: `The nearest free times on ${formatDay(draft.day)} are ${nearestTimes.map(formatTime).join(", ")}. Which would you like?`,
        suggestions: nearestTimes.map(formatTime),
      },
    };
  }

  if (draft.time === undefined) {
    const free = freeTimes(draft.day, service, now, bookings);
    const inPart = filterByPart(free, draft.part ?? null);
    const options = spread(inPart.length > 0 ? inPart : free);
    const intro =
      draft.part && inPart.length === 0
        ? `There's nothing left in the ${draft.part} on ${formatDay(draft.day)}, but I have`
        : `On ${formatDay(draft.day)} I have`;
    const more = free.length > options.length ? " and a few other times" : "";
    return {
      stage: "time",
      reply: {
        text: `${intro} ${options.map(formatTime).join(", ")}${more}. What time would you like?`,
        suggestions: options.map(formatTime),
      },
    };
  }

  if (!draft.name) {
    return {
      stage: "name",
      reply: {
        text: "Great. What name should I put the booking under? (A made-up name is fine in this demo.)",
        suggestions: ["Alex"],
      },
    };
  }

  return {
    stage: "confirm",
    reply: {
      text: `To confirm: ${service.name.toLowerCase()} on ${formatDay(draft.day)} at ${formatTime(draft.time)}, for ${draft.name}. It takes about ${service.minutes} minutes and costs ${service.price}. Shall I book it?`,
      suggestions: ["Yes, book it", "Change the time", "Change the day"],
    },
  };
}

function withPrefix(prefix: string[], reply: Reply): Reply {
  const text = [...prefix.filter(Boolean), reply.text].join(" ");
  return { ...reply, text };
}

function makeReference(bookings: readonly Booking[], day: string, time: number): string {
  const seed = (Number(day.replaceAll("-", "")) + time * 7 + bookings.length * 131) % 9000;
  return `HL-${1000 + seed}`;
}

// ---------------------------------------------------------------- main entry

export function respond(state: ConversationState, message: string, now: Date): Turn {
  const text = message.trim();
  const t = text.toLowerCase();

  if (text === "") {
    return { state, reply: { text: "Sorry, I didn't catch that.", suggestions: IDLE_SUGGESTIONS } };
  }

  // Cancelling an existing demo booking.
  if (state.stage === "cancel_confirm") {
    const booking = state.bookings.at(-1);
    if (booking && isYes(t)) {
      return {
        state: { stage: "idle", draft: {}, bookings: state.bookings.slice(0, -1) },
        reply: {
          text: `Done, your appointment on ${formatDay(booking.day)} at ${formatTime(booking.time)} is cancelled. Anything else?`,
          suggestions: IDLE_SUGGESTIONS,
          event: { type: "cancelled", booking },
        },
      };
    }
    if (isNo(t)) {
      return {
        state: { ...state, stage: "idle" },
        reply: {
          text: "No problem, I've kept your appointment. Anything else?",
          suggestions: IDLE_SUGGESTIONS,
        },
      };
    }
    return {
      state,
      reply: {
        text: "Should I cancel it? Please answer yes or no.",
        suggestions: ["Yes, cancel it", "No, keep it"],
      },
    };
  }

  const inBooking = state.stage !== "idle";

  if (inBooking && isAbort(t)) {
    return {
      state: { ...state, stage: "idle", draft: {} },
      reply: {
        text: "No problem, I've dropped that booking request. Is there anything else I can help with?",
        suggestions: IDLE_SUGGESTIONS,
      },
    };
  }

  // Side questions: answer, then carry on where we were.
  const aside = detectAside(t);
  if (aside && !(state.stage === "confirm" && isYes(t))) {
    const answer = answerAside(aside, t);
    if (!inBooking) {
      return {
        state,
        reply: {
          text: `${answer} Would you like to book an appointment?`,
          suggestions: IDLE_SUGGESTIONS,
        },
      };
    }
    const step = nextStep(state.draft, state.bookings, now);
    return {
      state: { ...state, stage: step.stage },
      reply: withPrefix([answer, "Back to your booking:"], step.reply),
    };
  }

  if (!inBooking) {
    if (isCancelIntent(t)) {
      const booking = state.bookings.at(-1);
      if (!booking) {
        return {
          state,
          reply: {
            text: "I can't find a booking made in this conversation. In the real system I'd look it up by your phone number.",
            suggestions: IDLE_SUGGESTIONS,
          },
        };
      }
      const service = SERVICES.find((s) => s.id === booking.serviceId);
      return {
        state: { ...state, stage: "cancel_confirm" },
        reply: {
          text: `You have a ${service?.name.toLowerCase() ?? "visit"} on ${formatDay(booking.day)} at ${formatTime(booking.time)} (reference ${booking.reference}). Should I cancel it?`,
          suggestions: ["Yes, cancel it", "No, keep it"],
        },
      };
    }

    const startsBooking =
      isBookingIntent(t) || detectService(t) || parseDay(t, now) || parseTime(t) !== null;
    if (!startsBooking) {
      if (has(t, /\b(thanks|thank you|cheers|bye|goodbye)\b/)) {
        return {
          state,
          reply: {
            text: `You're welcome. Have a lovely day from all of us at ${CLINIC.name}!`,
            suggestions: IDLE_SUGGESTIONS,
          },
        };
      }
      if (has(t, /^\s*(hi|hello|hey|good (morning|afternoon|evening))\b/)) {
        return { state, reply: greeting() };
      }
      return {
        state,
        reply: {
          text: "Sorry, I didn't quite follow. I can book an appointment, or tell you our opening hours, prices or address.",
          suggestions: IDLE_SUGGESTIONS,
        },
      };
    }
  }

  // Confirmation: only an explicit yes books, and only when nothing new was said.
  const applied = applyDetails(state, text, now);
  if (state.stage === "confirm" && !applied.changed) {
    const draft = state.draft;
    const service = serviceOf(draft);
    if (isYes(t) && service && draft.day && draft.time !== undefined && draft.name) {
      const booking: Booking = {
        reference: makeReference(state.bookings, draft.day, draft.time),
        serviceId: service.id,
        day: draft.day,
        time: draft.time,
        name: draft.name,
      };
      return {
        state: { stage: "idle", draft: {}, bookings: [...state.bookings, booking] },
        reply: {
          text: `You're booked! ${service.name} on ${formatDay(booking.day)} at ${formatTime(booking.time)} for ${booking.name}. Your reference is ${booking.reference}. Anything else I can help with?`,
          suggestions: ["Cancel my appointment", "Where are you?", "Thanks, bye"],
          event: { type: "booked", booking },
        },
      };
    }
    const field = t.match(/\b(time|day|date|treatment|service|name)\b/)?.[1];
    if (field) {
      const draft2: Draft = { ...draft };
      if (field === "time") delete draft2.time;
      if (field === "day" || field === "date") {
        delete draft2.day;
        delete draft2.time;
      }
      if (field === "treatment" || field === "service") delete draft2.serviceId;
      if (field === "name") delete draft2.name;
      const step = nextStep(draft2, state.bookings, now);
      return { state: { ...state, stage: step.stage, draft: draft2 }, reply: step.reply };
    }
    if (isNo(t)) {
      return {
        state,
        reply: {
          text: "What would you like to change: the treatment, the day, the time or the name?",
          suggestions: ["Change the time", "Change the day", "Change the treatment"],
        },
      };
    }
    return {
      state,
      reply: {
        text: "Shall I book it? Please say yes, or tell me what to change.",
        suggestions: ["Yes, book it", "Change the time", "Change the day"],
      },
    };
  }

  let draft = applied.draft;
  const prefix = [...applied.problems];
  if (state.stage === "confirm" && applied.changed && applied.problems.length === 0) {
    prefix.unshift("No problem, I've updated that.");
  }

  if (state.stage === "name" && !applied.changed) {
    const name = extractName(text);
    if (!name) {
      return {
        state,
        reply: {
          text: "Sorry, I didn't catch a name. What name should I put the booking under?",
          suggestions: ["Alex"],
        },
      };
    }
    draft = { ...draft, name };
  }

  if (serviceOf(draft)?.id === "urgent" && state.draft.serviceId !== "urgent") {
    prefix.unshift("Sorry to hear you're in discomfort. I'll find you the earliest slot.");
  }

  const step = nextStep(draft, state.bookings, now, applied.nearest);

  // Nothing understood at a booking step: say so, then repeat the question.
  if (inBooking && !applied.changed && state.stage !== "name" && prefix.length === 0) {
    prefix.push(
      state.stage === "day"
        ? 'Sorry, I didn\'t catch a day. You can say something like "Thursday" or "24 October".'
        : state.stage === "time"
          ? 'Sorry, I didn\'t catch a time. You can say something like "10 am" or "2:30 pm".'
          : "Sorry, I didn't catch that.",
    );
  }

  return {
    state: { ...state, stage: step.stage, draft },
    reply: withPrefix(prefix, step.reply),
  };
}

/**
 * Answers a short, plain question about opening hours, location, prices or treatments without
 * any AI (saves a model call and its tokens). Returns null when the message needs real
 * understanding: booking intent, a day or time, or anything longer or unusual.
 */
export function answerSimpleQuestion(message: string, now: Date): string | null {
  const t = message.toLowerCase().trim();
  if (t.length === 0 || t.split(/\s+/).length > 12) return null;
  const aside = detectAside(t);
  if (!aside || aside === "human") return null;
  if (isBookingIntent(t) || isCancelIntent(t) || parseDay(t, now) || parseTime(t) !== null) {
    return null;
  }
  return `${answerAside(aside, t)} Is there anything else I can help with?`;
}
