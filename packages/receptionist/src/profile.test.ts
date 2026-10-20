import { describe, expect, it } from "vitest";
import { freeTimes } from "./availability";
import { brightCutsSalon } from "./clients/bright-cuts-salon";
import { CLINIC } from "./clinic";
import { greeting, initialState, respond } from "./engine";
import { DEMO_PROFILE, getProfile, hoursText, PROFILES, validateProfile } from "./index";

// Monday 19 October 2026, 10:00.
const NOW = new Date(2026, 9, 19, 10, 0);

describe("client profiles", () => {
  it.each(PROFILES.map((p) => [p.id, p] as const))("%s is valid", (_id, profile) => {
    expect(validateProfile(profile)).toEqual([]);
  });

  it("has unique ids and finds them", () => {
    expect(new Set(PROFILES.map((p) => p.id)).size).toBe(PROFILES.length);
    expect(getProfile("bright-cuts-salon")).toBe(brightCutsSalon);
    expect(getProfile("nope")).toBeUndefined();
  });

  it("describes opening hours like a person would", () => {
    expect(hoursText(DEMO_PROFILE)).toBe(CLINIC.hoursText);
    expect(CLINIC.hoursText).toBe(
      "Monday, Tuesday and Thursday 9 am to 5 pm, Wednesday 9 am to 7 pm, Friday 9 am to 4 pm, Saturday 9 am to 1 pm. Closed on Sundays.",
    );
    expect(hoursText(brightCutsSalon)).toBe(
      "Tuesday, Wednesday and Friday 9 am to 6 pm, Thursday 9 am to 8 pm, Saturday 8:30 am to 4 pm. Closed on Mondays and Sundays.",
    );
  });

  it("catches setup mistakes", () => {
    const broken = {
      ...brightCutsSalon,
      id: "Bad Id",
      services: [
        { ...brightCutsSalon.services[0], minutes: 45 },
      ] as typeof brightCutsSalon.services,
      hours: [
        ["18:00", "09:00"],
        null,
        null,
        null,
        null,
        null,
        null,
      ] as typeof brightCutsSalon.hours,
    };
    const problems = validateProfile(broken).join(" | ");
    expect(problems).toMatch(/id must be/);
    expect(problems).toMatch(/multiple of 30/);
    expect(problems).toMatch(/opens after it closes/);
  });
});

describe("the same engine runs a different business", () => {
  const chat = (messages: string[]) => {
    let state = initialState();
    let text = "";
    for (const m of messages) {
      const turn = respond(state, m, NOW, brightCutsSalon);
      state = turn.state;
      text = turn.reply.text;
    }
    return { state, text };
  };

  it("greets with the salon's name and answers from its settings", () => {
    expect(greeting(brightCutsSalon).text).toContain("Bright Cuts Salon");
    expect(chat(["where are you?"]).text).toContain("48 Market Street");
    expect(chat(["how much is a men's cut?"]).text).toContain("€30");
  });

  it("uses the salon's hours: closed on Mondays", () => {
    expect(
      freeTimes("2026-10-19", brightCutsSalon.services[1] as never, NOW, [], brightCutsSalon),
    ).toEqual([]);
    expect(chat(["book a men's cut", "Monday 26 October"]).text).toContain("closed on Mondays");
  });

  it("books with the salon's reference prefix, only after a yes", () => {
    const time = freeTimes(
      "2026-10-21",
      brightCutsSalon.services[1] as never,
      NOW,
      [],
      brightCutsSalon,
    )[0] as number;
    const h = Math.floor(time / 60);
    const label = `${h % 12 || 12}${time % 60 ? `:${time % 60}` : ""} ${h < 12 ? "am" : "pm"}`;
    const ready = chat(["book a men's cut", "Wednesday", label, "Sam"]);
    expect(ready.state.stage).toBe("confirm");
    expect(ready.state.bookings).toHaveLength(0);
    let state = ready.state;
    const turn = respond(state, "yes", NOW, brightCutsSalon);
    state = turn.state;
    expect(state.bookings[0]?.reference).toMatch(/^BC-\d{4}$/);
  });

  it("does not use demo wording for a real client", () => {
    const real = { ...brightCutsSalon, demo: false };
    let state = initialState();
    let text = "";
    for (const m of ["book a men's cut", "Wednesday", "the first one"]) {
      const turn = respond(state, m, NOW, real);
      state = turn.state;
      text = turn.reply.text;
    }
    const time = freeTimes("2026-10-21", real.services[1] as never, NOW, [], real)[0] as number;
    const turn = respond(
      state,
      `${Math.floor(time / 60) % 12 || 12}${time % 60 ? `:${time % 60}` : ""} ${time < 720 ? "am" : "pm"}`,
      NOW,
      real,
    );
    text = turn.reply.text;
    expect(text).toContain("What name");
    expect(text).not.toContain("demo");
  });
});
