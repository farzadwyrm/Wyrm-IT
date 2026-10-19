/**
 * Small, dependency-free date and time understanding for the demo receptionist.
 * Dates are calendar days in the visitor's local time, written as "YYYY-MM-DD".
 */

const WEEKDAYS = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];
const WEEKDAY_SHORT = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];
const MONTHS = [
  "january",
  "february",
  "march",
  "april",
  "may",
  "june",
  "july",
  "august",
  "september",
  "october",
  "november",
  "december",
];

const pad = (n: number) => String(n).padStart(2, "0");

export function toDayString(date: Date): string {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

/** Midnight (local) of a "YYYY-MM-DD" day. */
export function fromDayString(day: string): Date {
  const [y, m, d] = day.split("-").map(Number);
  return new Date(y ?? 1970, (m ?? 1) - 1, d ?? 1);
}

export function addDays(day: string, days: number): string {
  const date = fromDayString(day);
  date.setDate(date.getDate() + days);
  return toDayString(date);
}

export function daysBetween(from: string, to: string): number {
  return Math.round((fromDayString(to).getTime() - fromDayString(from).getTime()) / 86_400_000);
}

export function weekdayOf(day: string): number {
  return fromDayString(day).getDay();
}

/** "Wednesday 21 October" */
export function formatDay(day: string): string {
  const date = fromDayString(day);
  const weekday = WEEKDAYS[date.getDay()] ?? "";
  const month = MONTHS[date.getMonth()] ?? "";
  return `${capitalise(weekday)} ${date.getDate()} ${capitalise(month)}`;
}

/** 570 -> "9:30 am", 840 -> "2 pm" */
export function formatTime(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  const suffix = h >= 12 ? "pm" : "am";
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return m === 0 ? `${h12} ${suffix}` : `${h12}:${pad(m)} ${suffix}`;
}

function capitalise(word: string): string {
  return word.charAt(0).toUpperCase() + word.slice(1);
}

export type DayParse = { kind: "day"; day: string } | { kind: "past" } | { kind: "invalid" };

function validDate(year: number, month: number, dayOfMonth: number): string | null {
  const date = new Date(year, month - 1, dayOfMonth);
  if (
    date.getFullYear() !== year ||
    date.getMonth() !== month - 1 ||
    date.getDate() !== dayOfMonth
  ) {
    return null;
  }
  return toDayString(date);
}

/** Resolves a day and month without a year to the next occurrence (this year or next). */
function nextOccurrence(today: string, month: number, dayOfMonth: number): DayParse {
  const year = fromDayString(today).getFullYear();
  const thisYear = validDate(year, month, dayOfMonth);
  if (!thisYear) return { kind: "invalid" };
  if (thisYear >= today) return { kind: "day", day: thisYear };
  const nextYear = validDate(year + 1, month, dayOfMonth);
  return nextYear ? { kind: "day", day: nextYear } : { kind: "invalid" };
}

const MONTH_PATTERN = "(jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)[a-z]*";

/**
 * Finds a day in free text. Returns null when the text mentions no day at all.
 * Understands: today, tomorrow, day after tomorrow, yesterday, weekday names (with
 * optional "this"/"next"), "21 October", "October 21st", and "21/10" or "21/10/2026".
 */
export function parseDay(text: string, now: Date): DayParse | null {
  const t = text.toLowerCase();
  const today = toDayString(now);

  if (/\bday after tomorrow\b/.test(t)) return { kind: "day", day: addDays(today, 2) };
  if (/\b(tomorrow|tmrw|tmr)\b/.test(t)) return { kind: "day", day: addDays(today, 1) };
  if (/\byesterday\b/.test(t)) return { kind: "past" };
  if (/\b(today|tonight|this afternoon|this morning)\b/.test(t)) return { kind: "day", day: today };

  const numeric = t.match(/\b(\d{1,2})\/(\d{1,2})(?:\/(\d{2}|\d{4}))?\b/);
  if (numeric) {
    const dayOfMonth = Number(numeric[1]);
    const month = Number(numeric[2]);
    if (numeric[3]) {
      const year = numeric[3].length === 2 ? 2000 + Number(numeric[3]) : Number(numeric[3]);
      const day = validDate(year, month, dayOfMonth);
      if (!day) return { kind: "invalid" };
      return day < today ? { kind: "past" } : { kind: "day", day };
    }
    return nextOccurrence(today, month, dayOfMonth);
  }

  const dayFirst = t.match(
    new RegExp(`\\b(\\d{1,2})(?:st|nd|rd|th)?\\s+(?:of\\s+)?${MONTH_PATTERN}\\b`),
  );
  const monthFirst = t.match(new RegExp(`\\b${MONTH_PATTERN}\\s+(\\d{1,2})(?:st|nd|rd|th)?\\b`));
  if (dayFirst || monthFirst) {
    const dayOfMonth = Number(dayFirst ? dayFirst[1] : monthFirst?.[2]);
    const monthWord = (dayFirst ? dayFirst[2] : monthFirst?.[1]) ?? "";
    const month = MONTHS.findIndex((m) => m.startsWith(monthWord.slice(0, 3))) + 1;
    return nextOccurrence(today, month, dayOfMonth);
  }

  for (let i = 0; i < 7; i++) {
    const names = `(?:${WEEKDAYS[i]}|${WEEKDAY_SHORT[i]})`;
    const match = t.match(new RegExp(`\\b(next\\s+|this\\s+)?${names}\\b`));
    if (match) {
      const todayIndex = now.getDay();
      let ahead = (i - todayIndex + 7) % 7;
      // "Monday" said on a Monday means today; "next Monday" never means today.
      if (match[1]?.startsWith("next") && ahead === 0) ahead = 7;
      return { kind: "day", day: addDays(today, ahead) };
    }
  }

  return null;
}

export type PartOfDay = "morning" | "afternoon";

export function parsePartOfDay(text: string): PartOfDay | null {
  const t = text.toLowerCase();
  if (/\bmorning\b/.test(t)) return "morning";
  if (/\b(afternoon|evening|after work|after lunch)\b/.test(t)) return "afternoon";
  return null;
}

/** Hours 1–7 without am/pm almost always mean the afternoon at a clinic. */
const clinicHour = (hour: number) => (hour >= 1 && hour <= 7 ? hour + 12 : hour);

/**
 * Finds a time of day in minutes after midnight, or null.
 * With `bare: true` (when the receptionist just asked for a time) a lone number like
 * "10" is accepted; otherwise a time needs am/pm, a colon, "at", or "o'clock",
 * so day numbers such as "21 October" are never mistaken for times.
 */
export function parseTime(text: string, options: { bare?: boolean } = {}): number | null {
  const t = text.toLowerCase();

  if (/\b(noon|midday)\b/.test(t)) return 12 * 60;

  const ampm = t.match(/\b(\d{1,2})(?:[:.](\d{2}))?\s*(am|pm|a\.m\.|p\.m\.)/);
  if (ampm) {
    let hour = Number(ampm[1]);
    const minute = Number(ampm[2] ?? 0);
    if (hour < 1 || hour > 12 || minute > 59) return null;
    const pm = ampm[3]?.startsWith("p");
    if (pm && hour !== 12) hour += 12;
    if (!pm && hour === 12) hour = 0;
    return hour * 60 + minute;
  }

  const clock = t.match(/\b(\d{1,2})[:h](\d{2})\b/);
  if (clock) {
    const hour = Number(clock[1]);
    const minute = Number(clock[2]);
    if (hour > 23 || minute > 59) return null;
    return clinicHour(hour) * 60 + minute;
  }

  const spoken =
    t.match(/\bat\s+(\d{1,2})\b(?!\s*(?:st|nd|rd|th|\/))/) ??
    t.match(/\b(\d{1,2})\s*o'?clock\b/) ??
    (options.bare ? t.match(/^\s*(?:at\s+)?(\d{1,2})\s*[.!]?\s*$/) : null);
  if (spoken) {
    const hour = Number(spoken[1]);
    if (hour > 23) return null;
    return clinicHour(hour) * 60;
  }

  return null;
}
