import { describe, expect, it } from "vitest";
import { createSpeakingEnvelope } from "./envelope";
import { toSpeech } from "./speech-text";

describe("toSpeech", () => {
  it.each([
    ["Your reference is HL-6802.", "Your reference is H L, 6 8, 0 2."],
    ["Whitening is €249.50.", "Whitening is 249 euros 50."],
    ["See you Thursday 22 October at 2 pm.", "See you Thursday the 22nd of October at 2 pm."],
    ["Friday 1 November works.", "Friday the 1st of November works."],
    ["Cleaning (60 minutes) & check-up", "Cleaning and check-up"],
    ["Thursday/Friday", "Thursday or Friday"],
    ["Let me check...", "Let me check."],
    ["A check-up costs €45.", "A check-up costs 45 euros."],
    ["That's 250€ for whitening.", "That's 250 euros for whitening."],
    ["I have 14:00 or 09:30.", "I have 2 pm or 9:30 am."],
    ["**Thursday** works.", "Thursday works."],
    ["- 9 am\n- 10 am", "9 am 10 am"],
  ])("%j -> %j", (input, expected) => {
    expect(toSpeech(input)).toBe(expected);
  });

  it("leaves already-spoken times alone", () => {
    expect(toSpeech("See you at 9:30 am.")).toBe("See you at 9:30 am.");
  });
});

describe("speaking envelope", () => {
  it("stays within 0..1, is silent before speaking and fades after stopping", () => {
    const env = createSpeakingEnvelope(() => 0.5);
    expect(env.level(0)).toBe(0);
    env.start(1000);
    for (let t = 1000; t < 3000; t += 16) {
      const level = env.level(t);
      expect(level).toBeGreaterThanOrEqual(0);
      expect(level).toBeLessThanOrEqual(1);
    }
    env.stop(3000);
    expect(env.level(3300)).toBe(0);
  });

  it("drops during a pause and jumps on a word", () => {
    const env = createSpeakingEnvelope(() => 1);
    env.start(0);
    env.pause(100);
    expect(env.level(150)).toBeCloseTo(0.1);
    env.word(500);
    expect(env.level(500)).toBeGreaterThan(env.level(900));
  });
});
