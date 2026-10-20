import {
  type Booking,
  checkDay,
  filterByPart,
  freeTimes,
  nextOpenDays,
  spread,
} from "./availability";
import { DEMO_PROFILE } from "./clients";
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
import { type BusinessProfile, hoursText, openingHours, type Service } from "./profile";

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

function idleSuggestions(p: BusinessProfile): string[] {
  const first = p.services[0]?.name.toLowerCase() ?? "appointment";
  return [`Book a ${first}`, "Opening hours", "Prices", "Where are you?"];
}

export function greeting(p: BusinessProfile = DEMO_PROFILE): Reply {
  return {
    text: `Hello, you're through to ${p.name}. I can book an appointment or answer questions about opening hours, prices and how to find us. How can I help?`,
    suggestions: idleSuggestions(p),
  };
}

// ---------------------------------------------------------------- understanding

const has = (t: string, pattern: RegExp) => pattern.test(t);

const escapeRegExp = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** Whole-word match, so a name like "Paine" never reads as "pain". */
function detectService(t: string, p: BusinessProfile): Service | undefined {
  return p.services.find((s) =>
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
  has(t, /\b(book|booking|appointment|schedule|reserve|come in|see (a|the) \w+|visit)\b/);
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

function answerAside(aside: Aside, t: string, p: BusinessProfile): string {
  switch (aside) {
    case "hours":
      return `We're open ${hoursText(p)}`;
    case "location":
      return `We're at ${p.address}. ${p.directions}`;
    case "price": {
      const service = detectService(t, p);
      if (service)
        return `A ${service.name.toLowerCase()} costs ${service.price} and takes about ${service.minutes} minutes.`;
      return `Our prices: ${p.services.map((s) => `${s.name.toLowerCase()} ${s.price}`).join(", ")}.`;
    }
    case "services":
      return `We offer ${p.services.map((s) => s.name.toLowerCase()).join(", ")}.`;
    case "human":
      return p.handoff;
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

const serviceOf = (draft: Draft, p: BusinessProfile) =>
  p.services.find((s) => s.id === draft.serviceId);
/** For day checks before a service is chosen, use the first one. */
const serviceForChecks = (draft: Draft, p: BusinessProfile): Service =>
  serviceOf(draft, p) ?? (p.services[0] as Service);

function closestTimes(times: readonly number[], target: number, count = 3): number[] {
  return [...times]
    .sort((a, b) => Math.abs(a - target) - Math.abs(b - target) || a - b)
    .slice(0, count)
    .sort((a, b) => a - b);
}

function describeDayProblem(
  reason: "past" | "closed" | "too_far" | "full",
  day: string | null,
  p: BusinessProfile,
): string {
  switch (reason) {
    case "past":
      return "That day has already passed, so I can't book it.";
    case "closed":
      return day ? `We're closed on ${formatDay(day).split(" ")[0]}s.` : "We're closed that day.";
    case "too_far":
      return `I can only book up to ${p.booking.windowDays} days ahead.`;
    case "full":
      return day ? `${formatDay(day)} is fully booked.` : "That day is fully booked.";
  }
}

function describeTimeProblem(
  day: string,
  time: number,
  now: Date,
  service: Service,
  p: BusinessProfile,
): string {
  const hours = openingHours(p)[weekdayOf(day)];
  const weekday = formatDay(day).split(" ")[0];
  if (hours && (time < hours[0] || time >= hours[1])) {
    return `We're open ${formatTime(hours[0])} to ${formatTime(hours[1])} on ${weekday}s, so ${formatTime(time)} doesn't work.`;
  }
  if (hours && time + service.minutes > hours[1]) {
    return `A ${service.name.toLowerCase()} at ${formatTime(time)} wouldn't finish before we close.`;
  }
  const nowMinutes = now.getHours() * 60 + now.getMinutes();
  if (day === toDayString(now) && time < nowMinutes + p.booking.minimumNoticeMinutes) {
    return `${formatTime(time)} today has passed or is too soon for us to prepare.`;
  }
  if (time % p.booking.slotMinutes !== 0) {
    const grid =
      p.booking.slotMinutes === 30
        ? "on the hour or half past"
        : `every ${p.booking.slotMinutes} minutes`;
    return `Appointments start ${grid}, so ${formatTime(time)} isn't available.`;
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
function applyDetails(
  state: ConversationState,
  text: string,
  now: Date,
  p: BusinessProfile,
): Applied {
  const t = text.toLowerCase();
  const draft: Draft = { ...state.draft };
  const problems: string[] = [];
  let nearest: number[] = [];
  let changed = false;

  const service = detectService(t, p);
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
      problems.push(describeDayProblem("past", null, p));
    } else if (dayParse.kind === "invalid") {
      problems.push("I couldn't find that date in the calendar. Could you check it?");
    } else {
      const check = checkDay(dayParse.day, serviceForChecks(draft, p), now, state.bookings, p);
      if (check.ok) {
        if (draft.day !== dayParse.day) delete draft.time;
        draft.day = dayParse.day;
      } else {
        problems.push(describeDayProblem(check.reason, dayParse.day, p));
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
    const free = freeTimes(draft.day, serviceForChecks(draft, p), now, state.bookings, p);
    if (!free.includes(draft.time)) {
      const requested = draft.time;
      problems.push(describeTimeProblem(draft.day, requested, now, serviceForChecks(draft, p), p));
      delete draft.time;
      nearest = closestTimes(free, requested);
    }
  }

  // A treatment change can make the chosen day impossible (e.g. too long for Saturday).
  if (service && draft.day && !checkDay(draft.day, service, now, state.bookings, p).ok) {
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
  p: BusinessProfile,
  draft: Draft,
  bookings: Booking[],
  now: Date,
  nearestTimes: readonly number[] = [],
): { stage: Stage; reply: Reply } {
  const service = serviceOf(draft, p);
  if (!service) {
    const names = p.services.map((s) => s.name.toLowerCase());
    const list =
      names.length > 1 ? `${names.slice(0, -1).join(", ")} or ${names.at(-1)}` : (names[0] ?? "");
    return {
      stage: "service",
      reply: {
        text: `Which ${p.serviceWord} is it for: ${list}?`,
        suggestions: p.services.map((s) => s.name),
      },
    };
  }

  if (!draft.day) {
    const days = nextOpenDays(toDayString(now), service, now, bookings, 3, p);
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
    const free = freeTimes(draft.day, service, now, bookings, p);
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
        text: `Great. What name should I put the booking under?${p.demo ? " (A made-up name is fine in this demo.)" : ""}`,
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

function makeReference(
  bookings: readonly Booking[],
  day: string,
  time: number,
  p: BusinessProfile,
): string {
  const seed = (Number(day.replaceAll("-", "")) + time * 7 + bookings.length * 131) % 9000;
  return `${p.booking.referencePrefix}-${1000 + seed}`;
}

// ---------------------------------------------------------------- main entry

export function respond(
  state: ConversationState,
  message: string,
  now: Date,
  p: BusinessProfile = DEMO_PROFILE,
): Turn {
  const IDLE_SUGGESTIONS = idleSuggestions(p);
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
    const answer = answerAside(aside, t, p);
    if (!inBooking) {
      return {
        state,
        reply: {
          text: `${answer} Would you like to book an appointment?`,
          suggestions: IDLE_SUGGESTIONS,
        },
      };
    }
    const step = nextStep(p, state.draft, state.bookings, now);
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
            text: p.demo
              ? "I can't find a booking made in this conversation. In the real system I'd look it up by your phone number."
              : "I can't find a booking made in this conversation. Could you tell me the day and time of your appointment?",
            suggestions: IDLE_SUGGESTIONS,
          },
        };
      }
      const service = p.services.find((s) => s.id === booking.serviceId);
      return {
        state: { ...state, stage: "cancel_confirm" },
        reply: {
          text: `You have a ${service?.name.toLowerCase() ?? "visit"} on ${formatDay(booking.day)} at ${formatTime(booking.time)} (reference ${booking.reference}). Should I cancel it?`,
          suggestions: ["Yes, cancel it", "No, keep it"],
        },
      };
    }

    const startsBooking =
      isBookingIntent(t) || detectService(t, p) || parseDay(t, now) || parseTime(t) !== null;
    if (!startsBooking) {
      if (has(t, /\b(thanks|thank you|cheers|bye|goodbye)\b/)) {
        return {
          state,
          reply: {
            text: `You're welcome. Have a lovely day from all of us at ${p.name}!`,
            suggestions: IDLE_SUGGESTIONS,
          },
        };
      }
      if (has(t, /^\s*(hi|hello|hey|good (morning|afternoon|evening))\b/)) {
        return { state, reply: greeting(p) };
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
  const applied = applyDetails(state, text, now, p);
  if (state.stage === "confirm" && !applied.changed) {
    const draft = state.draft;
    const service = serviceOf(draft, p);
    if (isYes(t) && service && draft.day && draft.time !== undefined && draft.name) {
      const booking: Booking = {
        reference: makeReference(state.bookings, draft.day, draft.time, p),
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
      const step = nextStep(p, draft2, state.bookings, now);
      return { state: { ...state, stage: step.stage, draft: draft2 }, reply: step.reply };
    }
    if (isNo(t)) {
      return {
        state,
        reply: {
          text: `What would you like to change: the ${p.serviceWord}, the day, the time or the name?`,
          suggestions: ["Change the time", "Change the day", `Change the ${p.serviceWord}`],
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

  if (serviceOf(draft, p)?.urgent && !serviceOf(state.draft, p)?.urgent) {
    prefix.unshift("Sorry to hear you're in discomfort. I'll find you the earliest slot.");
  }

  const step = nextStep(p, draft, state.bookings, now, applied.nearest);

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
export function answerSimpleQuestion(
  message: string,
  now: Date,
  p: BusinessProfile = DEMO_PROFILE,
): string | null {
  const t = message.toLowerCase().trim();
  if (t.length === 0 || t.split(/\s+/).length > 12) return null;
  const aside = detectAside(t);
  if (!aside || aside === "human") return null;
  if (isBookingIntent(t) || isCancelIntent(t) || parseDay(t, now) || parseTime(t) !== null) {
    return null;
  }
  return `${answerAside(aside, t, p)} Is there anything else I can help with?`;
}
