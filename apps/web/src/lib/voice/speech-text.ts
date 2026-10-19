/**
 * Turns a written receptionist reply into text that sounds right when spoken by a browser voice.
 * The model is also asked to write speakably on calls; this deterministic step is the safety net,
 * and runs only before speech so the on-screen transcript stays normal text.
 */

const MONTHS =
  "January|February|March|April|May|June|July|August|September|October|November|December";
const WEEKDAYS = "Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday";

function ordinal(n: number): string {
  if (n % 100 >= 11 && n % 100 <= 13) return `${n}th`;
  return `${n}${({ 1: "st", 2: "nd", 3: "rd" } as Record<number, string>)[n % 10] ?? "th"}`;
}

export function toSpeech(text: string): string {
  return (
    text
      // Markdown and symbols that voices read out literally.
      .replace(/\*\*|__|`|#+\s/g, "")
      .replace(/^\s*[-•*]\s+/gm, "")
      .replace(/\s*\([^)]*\)/g, "")
      .replace(/…|\.{3}/g, ".")
      .replace(/\s&\s/g, " and ")
      // Only between words ("Thursday/Friday"), never in numeric dates like 24/10.
      .replace(/([A-Za-z])\s?\/\s?([A-Za-z])/g, "$1 or $2")
      // Booking references: "HL-1234" -> "H L, 1 2, 3 4" (grouped for natural pauses).
      .replace(/\b([A-Z]{2})-(\d{4})\b/g, (_, letters: string, digits: string) => {
        const d = digits.split("");
        return `${letters.split("").join(" ")}, ${d.slice(0, 2).join(" ")}, ${d.slice(2).join(" ")}`;
      })
      // Prices: "€45" / "45€" -> "45 euros", "€45.50" -> "45 euros 50".
      .replace(
        /€\s?(\d+)(?:[.,](\d{2}))?|(\d+)(?:[.,](\d{2}))?\s?€/g,
        (_, a?: string, ac?: string, b?: string, bc?: string) => {
          const whole = a ?? b ?? "";
          const cents = ac ?? bc;
          const euros = `${whole} ${whole === "1" ? "euro" : "euros"}`;
          return cents && cents !== "00" ? `${euros} ${Number(cents)}` : euros;
        },
      )
      // 24-hour times the model might use: "14:00" -> "2 pm", "09:30" -> "9:30 am".
      .replace(/\b([01]?\d|2[0-3]):([0-5]\d)\b(?!\s?(am|pm))/gi, (_, h: string, m: string) => {
        const hour = Number(h);
        const suffix = hour >= 12 ? "pm" : "am";
        const h12 = hour % 12 === 0 ? 12 : hour % 12;
        return m === "00" ? `${h12} ${suffix}` : `${h12}:${m} ${suffix}`;
      })
      // Dates: "Thursday 22 October" -> "Thursday the 22nd of October".
      .replace(
        new RegExp(`\\b(${WEEKDAYS}) (\\d{1,2}) (${MONTHS})\\b`, "g"),
        (_, weekday: string, day: string, month: string) =>
          `${weekday} the ${ordinal(Number(day))} of ${month}`,
      )
      .replace(/\s+/g, " ")
      .trim()
  );
}
