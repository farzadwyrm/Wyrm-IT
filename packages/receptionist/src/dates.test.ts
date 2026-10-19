import { describe, expect, it } from "vitest";
import { addDays, formatDay, formatTime, parseDay, parseTime, toDayString } from "./dates";

// Monday 19 October 2026, 10:00 local time.
const NOW = new Date(2026, 9, 19, 10, 0);
const TODAY = toDayString(NOW);

describe("parseDay", () => {
  it.each([
    ["today please", TODAY],
    ["tomorrow", addDays(TODAY, 1)],
    ["the day after tomorrow", addDays(TODAY, 2)],
    ["Thursday", "2026-10-22"],
    ["monday", TODAY],
    ["next monday", "2026-10-26"],
    ["on the 24th of October", "2026-10-24"],
    ["October 30th", "2026-10-30"],
    ["24/10", "2026-10-24"],
    ["5 January", "2027-01-05"],
    ["20/11/2026", "2026-11-20"],
  ])("%s -> %s", (text, day) => {
    expect(parseDay(text, NOW)).toEqual({ kind: "day", day });
  });

  it.each(["yesterday", "1/1/2025", "18/10/2026"])("rejects past day %s", (text) => {
    expect(parseDay(text, NOW)).toEqual({ kind: "past" });
  });

  it.each(["31/02", "30 February"])("rejects impossible date %s", (text) => {
    expect(parseDay(text, NOW)).toEqual({ kind: "invalid" });
  });

  it.each(["hello", "I'd like a cleaning", "at 10am"])("finds no day in %s", (text) => {
    expect(parseDay(text, NOW)).toBeNull();
  });
});

describe("parseTime", () => {
  it.each([
    ["10am", 600],
    ["at 2:30 pm", 870],
    ["12pm", 720],
    ["noon", 720],
    ["15:30", 930],
    ["at 3", 900],
    ["4 o'clock", 960],
  ])("%s -> %i", (text, minutes) => {
    expect(parseTime(text)).toBe(minutes);
  });

  it("does not mistake a date for a time", () => {
    expect(parseTime("24 October")).toBeNull();
    expect(parseTime("on the 24th")).toBeNull();
  });

  it("accepts a bare number only when a time was asked for", () => {
    expect(parseTime("11")).toBeNull();
    expect(parseTime("11", { bare: true })).toBe(660);
    expect(parseTime("2", { bare: true })).toBe(840);
  });
});

describe("formatting", () => {
  it("formats days and times for people", () => {
    expect(formatDay("2026-10-21")).toBe("Wednesday 21 October");
    expect(formatTime(570)).toBe("9:30 am");
    expect(formatTime(840)).toBe("2 pm");
    expect(formatTime(720)).toBe("12 pm");
  });
});
