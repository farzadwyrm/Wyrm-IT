import { describe, expect, it } from "vitest";
import { pickVoice, scoreVoice } from "./voices";

const v = (name: string, lang: string) => ({ name, lang, localService: false });

describe("pickVoice", () => {
  it("prefers natural/neural English voices", () => {
    const voices = [
      v("Microsoft David - English (United States)", "en-US"),
      v("Microsoft Sonia Online (Natural) - English (United Kingdom)", "en-GB"),
      v("Google français", "fr-FR"),
    ];
    expect(pickVoice(voices)?.name).toContain("Sonia");
  });

  it("prefers Google's online voices in Chrome over basic system voices", () => {
    const voices = [v("Microsoft Zira", "en-US"), v("Google UK English Female", "en-GB")];
    expect(pickVoice(voices)?.name).toBe("Google UK English Female");
  });

  it("never picks a non-English or novelty voice when a normal one exists", () => {
    const voices = [v("Zarvox", "en-US"), v("Thomas", "fr-FR"), v("Daniel", "en-GB")];
    expect(pickVoice(voices)?.name).toBe("Daniel");
    expect(scoreVoice(v("Thomas", "fr-FR"))).toBe(-1);
  });

  it("returns null when there is no English voice", () => {
    expect(pickVoice([v("Amélie", "fr-CA")])).toBeNull();
  });
});
