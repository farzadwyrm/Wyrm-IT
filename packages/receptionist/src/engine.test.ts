import { describe, expect, it } from "vitest";
import { freeTimes } from "./availability";
import { SERVICES, type Service } from "./clinic";
import { formatTime } from "./dates";
import {
  answerSimpleQuestion,
  type ConversationState,
  initialState,
  type Reply,
  respond,
} from "./engine";

// Monday 19 October 2026, 10:00 local time.
const NOW = new Date(2026, 9, 19, 10, 0);
const CHECKUP = SERVICES.find((s) => s.id === "checkup") as Service;
const CLEANING = SERVICES.find((s) => s.id === "cleaning") as Service;

/** Plays a conversation and returns every reply plus the final state. */
function chat(messages: string[], start: ConversationState = initialState()) {
  let state = start;
  const replies: Reply[] = [];
  for (const message of messages) {
    const turn = respond(state, message, NOW);
    state = turn.state;
    replies.push(turn.reply);
  }
  return { state, replies, last: replies.at(-1) as Reply };
}

const firstFree = (day: string, service = CHECKUP) => {
  const time = freeTimes(day, service, NOW, [])[0];
  if (time === undefined) throw new Error(`no free time on ${day}`);
  return time;
};

describe("happy path", () => {
  it("books only after an explicit yes", () => {
    const time = formatTime(firstFree("2026-10-22"));
    const { state, replies, last } = chat([
      "I'd like to book a check-up",
      "Thursday",
      time,
      "My name is Alex",
      "yes",
    ]);
    expect(replies[0]?.text).toContain("Which day");
    expect(replies[1]?.text).toContain("Thursday 22 October");
    expect(replies[2]?.text).toContain("What name");
    expect(replies[3]?.text).toContain("Shall I book it?");
    expect(replies[3]?.event).toBeUndefined();
    expect(last.event?.type).toBe("booked");
    expect(last.text).toMatch(/Your reference is HL-\d{4}/);
    expect(state.bookings).toHaveLength(1);
    expect(state.bookings[0]).toMatchObject({
      serviceId: "checkup",
      day: "2026-10-22",
      name: "Alex",
    });
  });

  it("understands everything in one message", () => {
    const time = firstFree("2026-10-22", CLEANING);
    const { last, state } = chat([`Can I book a cleaning on Thursday at ${formatTime(time)}?`]);
    expect(state.stage).toBe("name");
    expect(last.text).toContain("What name");
  });

  it("asks which treatment when none is given", () => {
    const { last } = chat(["I need an appointment"]);
    expect(last.text).toContain("Which treatment");
    expect(last.suggestions).toContain("Check-up");
  });
});

describe("never books without confirmation", () => {
  const ready = () => {
    const time = formatTime(firstFree("2026-10-22"));
    return chat(["book a check-up", "Thursday", time, "Alex"]).state;
  };

  it.each(["hmm", "maybe", "what?", "Alex"])("does not book on %j", (message) => {
    const { state, last } = chat([message], ready());
    expect(state.bookings).toHaveLength(0);
    expect(last.event).toBeUndefined();
  });

  it("asks what to change on a plain no", () => {
    const { state, last } = chat(["no"], ready());
    expect(state.bookings).toHaveLength(0);
    expect(last.text).toContain("What would you like to change");
  });
});

describe("rejected dates and times", () => {
  it("rejects yesterday", () => {
    const { last, state } = chat(["book a check-up", "yesterday"]);
    expect(last.text).toContain("already passed");
    expect(state.draft.day).toBeUndefined();
  });

  it("rejects Sundays", () => {
    const { last } = chat(["book a check-up", "Sunday"]);
    expect(last.text).toContain("closed on Sundays");
  });

  it("rejects days beyond the booking window", () => {
    const { last } = chat(["book a check-up", "5 March"]);
    expect(last.text).toContain("up to 60 days ahead");
  });

  it("rejects impossible dates", () => {
    const { last } = chat(["book a check-up", "31/02"]);
    expect(last.text).toContain("couldn't find that date");
  });

  it("rejects times outside opening hours and offers alternatives", () => {
    const { last, state } = chat(["book a check-up", "Thursday", "8pm"]);
    expect(last.text).toContain("We're open 9 am to 5 pm on Thursdays");
    expect(last.text).toContain("The nearest free times on Thursday 22 October are");
    // Offered once, as suggestions, not listed twice.
    expect(last.text.match(/free times/g)).toHaveLength(1);
    expect(last.suggestions.length).toBeGreaterThan(0);
    expect(state.draft.time).toBeUndefined();
  });

  it("rejects a time that has already passed today", () => {
    const { last } = chat(["book a check-up today at 9am"]);
    expect(last.text).toContain("today has passed or is too soon");
  });

  it("rejects an appointment that would run past closing", () => {
    // Saturday closes at 1 pm; a 60-minute cleaning cannot start at 12:30.
    const { last } = chat(["book a cleaning", "Saturday", "12:30 pm"]);
    expect(last.text).toMatch(/wouldn't finish before we close|is already taken/);
  });
});

describe("corrections", () => {
  it("changes the day at the confirmation step and asks for a new time", () => {
    const time = formatTime(firstFree("2026-10-22"));
    const ready = chat(["book a check-up", "Thursday", time, "Alex"]).state;
    const { state, last } = chat(["actually make it Friday"], ready);
    expect(state.draft.day).toBe("2026-10-23");
    expect(state.bookings).toHaveLength(0);
    expect(last.text).toMatch(/updated|What time/);
  });

  it("changes the time when asked", () => {
    const thursday = freeTimes("2026-10-22", CHECKUP, NOW, []);
    const [first, second] = thursday;
    const ready = chat(["book a check-up", "Thursday", formatTime(first as number), "Alex"]).state;
    const { state, last } = chat([`no, ${formatTime(second as number)} please`], ready);
    expect(state.draft.time).toBe(second);
    expect(state.stage).toBe("confirm");
    expect(last.text).toContain("I've updated that");
  });

  it("moves an afternoon time to the morning when asked, even at the name step", () => {
    const afternoon = freeTimes("2026-10-22", CHECKUP, NOW, []).find((t) => t >= 12 * 60);
    const atName = chat(["book a check-up", "Thursday", formatTime(afternoon as number)]).state;
    expect(atName.stage).toBe("name");
    const { state, last } = chat(["actually make it the morning instead"], atName);
    expect(state.stage).toBe("time");
    expect(state.draft.time).toBeUndefined();
    expect(last.suggestions.length).toBeGreaterThan(0);
    for (const label of last.suggestions) expect(label).toMatch(/am$/);
  });

  it("keeps a morning time when the visitor says morning again", () => {
    const morning = freeTimes("2026-10-22", CHECKUP, NOW, []).find((t) => t < 12 * 60);
    const atName = chat(["book a check-up", "Thursday", formatTime(morning as number)]).state;
    const { state } = chat(["morning is good"], atName);
    expect(state.draft.time).toBe(morning);
  });

  it("switches treatment mid-booking", () => {
    const { state } = chat(["book a check-up", "whitening instead"]);
    expect(state.draft.serviceId).toBe("whitening");
  });

  it("can go back from the confirmation to change the time", () => {
    const time = formatTime(firstFree("2026-10-22"));
    const ready = chat(["book a check-up", "Thursday", time, "Alex"]).state;
    const { state, last } = chat(["Change the time"], ready);
    expect(state.stage).toBe("time");
    expect(state.draft.time).toBeUndefined();
    expect(last.text).toContain("What time would you like?");
  });
});

describe("side questions", () => {
  it("answers opening hours mid-booking and returns to the booking", () => {
    const { state, last } = chat(["book a check-up", "Thursday", "what are your opening hours?"]);
    expect(last.text).toContain("Closed on Sundays");
    expect(last.text).toContain("Back to your booking");
    expect(state.stage).toBe("time");
    expect(state.draft.day).toBe("2026-10-22");
  });

  it("answers a price question without changing the treatment", () => {
    const { state, last } = chat(["book a check-up", "how much is whitening?"]);
    expect(last.text).toContain("€250");
    expect(state.draft.serviceId).toBe("checkup");
  });

  it("answers questions when no booking is in progress", () => {
    expect(chat(["Where are you?"]).last.text).toContain("Harbor Lane");
    expect(chat(["prices"]).last.text).toContain("€45");
  });
});

describe("demo calendar", () => {
  it("spreads taken slots so every open weekday has morning and afternoon times", () => {
    for (const day of ["2026-10-20", "2026-10-21", "2026-10-22", "2026-10-23"]) {
      const free = freeTimes(day, CHECKUP, NOW, []);
      expect(
        free.some((t) => t < 12 * 60),
        `${day} morning`,
      ).toBe(true);
      expect(
        free.some((t) => t >= 12 * 60),
        `${day} afternoon`,
      ).toBe(true);
    }
  });
});

describe("other actions", () => {
  it("drops the booking request on never mind", () => {
    const { state, last } = chat(["book a check-up", "never mind"]);
    expect(state.stage).toBe("idle");
    expect(state.draft).toEqual({});
    expect(last.text).toContain("dropped that booking request");
  });

  it("cancels a booking only after confirmation", () => {
    const time = formatTime(firstFree("2026-10-22"));
    const booked = chat(["book a check-up", "Thursday", time, "Alex", "yes"]).state;
    const asked = chat(["cancel my appointment"], booked);
    expect(asked.state.bookings).toHaveLength(1);
    expect(asked.last.text).toContain("Should I cancel it?");
    const cancelled = chat(["yes"], asked.state);
    expect(cancelled.state.bookings).toHaveLength(0);
    expect(cancelled.last.event?.type).toBe("cancelled");
  });

  it("says when there is nothing to cancel", () => {
    expect(chat(["cancel my appointment"]).last.text).toContain("can't find a booking");
  });

  it("is kind about urgent pain and offers the earliest days", () => {
    const { last, state } = chat(["I have a toothache"]);
    expect(state.draft.serviceId).toBe("urgent");
    expect(last.text).toContain("Sorry to hear");
  });

  it("does not read a surname as a symptom", () => {
    const time = formatTime(firstFree("2026-10-22"));
    const { state } = chat(["book a check-up", "Thursday", time, "Sam Paine"]);
    expect(state.draft.name).toBe("Sam Paine");
    expect(state.draft.serviceId).toBe("checkup");
  });

  it("handles unknown messages politely", () => {
    expect(chat(["what's the meaning of life"]).last.text).toContain("didn't quite follow");
  });
});

describe("answerSimpleQuestion (no AI call)", () => {
  it.each([
    ["what are your opening hours?", /Closed on Sundays/],
    ["where are you?", /Harbor Lane/],
    ["how much is whitening?", /€250/],
    ["prices", /€45/],
  ])("answers %j", (message, pattern) => {
    expect(answerSimpleQuestion(message, NOW)).toMatch(pattern);
  });

  it.each([
    "can I book a cleaning tomorrow?",
    "are you open on Saturday?",
    "what time can I come in at 3pm",
    "hi",
    "I want to cancel my appointment",
    "can I speak to a human",
    "how much is whitening and can you tell me if it hurts and how long it lasts please",
  ])("leaves %j to the AI", (message) => {
    expect(answerSimpleQuestion(message, NOW)).toBeNull();
  });
});
