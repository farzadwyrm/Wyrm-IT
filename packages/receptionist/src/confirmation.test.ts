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
    // Natural spoken yeses (AIQ-1: these used to be rejected).
    "that's fine",
    "lovely, thanks",
    "uh huh",
    "mm-hmm yes",
    "yes no problem",
    "that's fine, go on then",
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
    // Speech-recognition style: no question marks (AIQ-1 regressions).
    "ok what about friday",
    "okay can we make it three",
    "sure thing, three pm works better",
    "great and what time do you close",
    "ok so the 10:30 then",
    "sounds good for Wednesday though",
    "yes tomorrow",
    "ok the morning one",
  ])("rejects %j", (message) => expect(isClearYes(message)).toBe(false));
});

describe("isClearYesToCancel", () => {
  it.each(["yes cancel it", "yes, cancel my appointment", "ok", "yes please cancel it"])(
    "accepts %j",
    (message) => expect(isClearYesToCancel(message)).toBe(true),
  );
  it.each(["no keep it", "cancel?", "wait", "cancel it", "ok but move it to friday"])(
    "rejects %j",
    (message) => expect(isClearYesToCancel(message)).toBe(false),
  );
});
