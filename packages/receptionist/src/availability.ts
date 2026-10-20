import { DEMO_PROFILE } from "./clients";
import { daysBetween, type PartOfDay, toDayString, weekdayOf } from "./dates";
import { type BusinessProfile, openingHours, type Service } from "./profile";

export interface Booking {
  reference: string;
  serviceId: string;
  day: string;
  time: number;
  name: string;
}

/** Deterministic "already booked by someone else" pattern so the demo calendar looks real. */
function takenByOthers(day: string, time: number): boolean {
  // FNV-1a hash of "day|time": well mixed, so taken slots are spread across the day (~30%).
  let hash = 0x811c9dc5;
  for (const char of `${day}|${time}`) {
    hash ^= char.charCodeAt(0);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash % 10 < 3;
}

export type DayCheck = { ok: true } | { ok: false; reason: "past" | "closed" | "too_far" | "full" };

/** Start times (minutes after midnight) still free for a service on a day. */
export function freeTimes(
  day: string,
  service: Service,
  now: Date,
  bookings: readonly Booking[],
  profile: BusinessProfile = DEMO_PROFILE,
): number[] {
  const hours = openingHours(profile)[weekdayOf(day)];
  if (!hours) return [];
  const [open, close] = hours;
  const today = toDayString(now);
  const earliest =
    day === today
      ? now.getHours() * 60 + now.getMinutes() + profile.booking.minimumNoticeMinutes
      : 0;

  const times: number[] = [];
  for (let t = open; t + service.minutes <= close; t += profile.booking.slotMinutes) {
    if (t < earliest) continue;
    if (takenByOthers(day, t)) continue;
    if (bookings.some((b) => b.day === day && b.time === t)) continue;
    times.push(t);
  }
  return times;
}

export function checkDay(
  day: string,
  service: Service,
  now: Date,
  bookings: readonly Booking[],
  profile: BusinessProfile = DEMO_PROFILE,
): DayCheck {
  const ahead = daysBetween(toDayString(now), day);
  if (ahead < 0) return { ok: false, reason: "past" };
  if (ahead > profile.booking.windowDays) return { ok: false, reason: "too_far" };
  if (!openingHours(profile)[weekdayOf(day)]) return { ok: false, reason: "closed" };
  if (freeTimes(day, service, now, bookings, profile).length === 0)
    return { ok: false, reason: "full" };
  return { ok: true };
}

export function filterByPart(times: readonly number[], part: PartOfDay | null): number[] {
  if (!part) return [...times];
  return times.filter((t) => (part === "morning" ? t < 12 * 60 : t >= 12 * 60));
}

/** Picks up to `count` times spread across the day, so suggestions are not all at 9 am. */
export function spread(times: readonly number[], count = 3): number[] {
  if (times.length <= count) return [...times];
  const step = (times.length - 1) / (count - 1);
  return Array.from({ length: count }, (_, i) => times[Math.round(i * step)] as number);
}

/** The next days (from `from`, inclusive) that have room for the service. */
export function nextOpenDays(
  from: string,
  service: Service,
  now: Date,
  bookings: readonly Booking[],
  count = 3,
  profile: BusinessProfile = DEMO_PROFILE,
): string[] {
  const days: string[] = [];
  const start = new Date(`${from}T00:00:00`);
  for (let i = 0; i <= profile.booking.windowDays && days.length < count; i++) {
    const date = new Date(start);
    date.setDate(start.getDate() + i);
    const day = toDayString(date);
    if (checkDay(day, service, now, bookings, profile).ok) days.push(day);
  }
  return days;
}
