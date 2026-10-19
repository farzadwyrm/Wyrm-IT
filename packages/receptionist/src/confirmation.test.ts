import { describe, expect, it } from "vitest";
import { isClearYes, isClearYesToCancel } from "./confirmation";

describe("isClearYes", () => {
  it.each([
    "yes",
    "Yes please",
    "yeah go ahead",
    "sure",
    "OK book it",
    "that's right",
    "Perfect, thanks!",
  ])("accepts %j", (message) => expect(isClearYes(message)).toBe(true));

  it.each([
    "no",
    "yes but make it 11am",
    "actually Friday",
    "yes?",
    "hmm maybe",
    "ok wait",
    "can you do Thursday instead",
    "",
    "what's the price",
    `yes ${"very ".repeat(30)}long`,
  ])("rejects %j", (message) => expect(isClearYes(message)).toBe(false));
});

describe("isClearYesToCancel", () => {
  it.each(["yes cancel it", "yes, cancel my appointment", "ok"])("accepts %j", (message) =>
    expect(isClearYesToCancel(message)).toBe(true),
  );
  it.each(["no keep it", "cancel?", "wait"])("rejects %j", (message) =>
    expect(isClearYesToCancel(message)).toBe(false),
  );
});
