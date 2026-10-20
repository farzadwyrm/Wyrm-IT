/**
 * A client's settings for the receptionist agent. One file per client in `src/clients/`;
 * everything business-specific lives here, so the same engine, AI prompts and tools work for a
 * dental clinic, a hair salon or a garage. See docs/business/NEW_CLIENT.md.
 */

export interface Service {
  id: string;
  name: string;
  minutes: number;
  /** As the business says it, e.g. "€45" or "from €30". */
  price: string;
  /** Lower-case words that identify this service in a message. */
  keywords: readonly string[];
  /** Urgent visits: the receptionist is extra kind and offers the earliest slot. */
  urgent?: boolean;
}

/** "HH:MM" opening and closing time, or null when closed. */
export type DayHours = readonly [string, string] | null;

export interface BusinessProfile {
  /** URL-safe id, e.g. "harbor-lane-dental". */
  id: string;
  name: string;
  /** What kind of business, as a phrase: "a dental clinic", "a hair salon". */
  kind: string;
  /** True for invented demo businesses: the receptionist says nothing is really booked. */
  demo: boolean;
  address: string;
  /** Parking, public transport, entrance. */
  directions: string;
  /** Monday first: [Mon, Tue, Wed, Thu, Fri, Sat, Sun]. */
  hours: readonly [DayHours, DayHours, DayHours, DayHours, DayHours, DayHours, DayHours];
  services: readonly Service[];
  /** The word customers use: "treatment", "service", "appointment type". */
  serviceWord: string;
  booking: {
    /** How far ahead people can book. */
    windowDays: number;
    /** Minimum notice for same-day bookings. */
    minimumNoticeMinutes: number;
    /** Start times are on this grid, e.g. every 30 minutes. */
    slotMinutes: number;
    /** Booking references start with this, e.g. "HL". */
    referencePrefix: string;
  };
  /** Extra facts the receptionist may share (payment, cancellations, languages…). */
  facts: readonly string[];
  /** What happens when someone wants a person. */
  handoff: string;
  /** Safety and care rules specific to this business (urgent symptoms, emergencies…). */
  careRules: readonly string[];
  /** Topics the receptionist must not advise on, e.g. "medical or dental advice". */
  noAdviceOn: string;
  /** Optional example exchanges in this business's style (improve tone and accuracy). */
  examples?: readonly { visitor: string; receptionist: string }[];
}

const toMinutes = (hhmm: string) => {
  const [h = 0, m = 0] = hhmm.split(":").map(Number);
  return h * 60 + m;
};

type WeekHours = Record<number, readonly [number, number] | null>;
const hoursCache = new WeakMap<BusinessProfile, WeekHours>();

/** Opening hours keyed by JS weekday (0 = Sunday), in minutes after midnight. */
export function openingHours(p: BusinessProfile): WeekHours {
  const cached = hoursCache.get(p);
  if (cached) return cached;
  const out: WeekHours = {};
  p.hours.forEach((h, i) => {
    out[(i + 1) % 7] = h ? [toMinutes(h[0]), toMinutes(h[1])] : null;
  });
  hoursCache.set(p, out);
  return out;
}

const DAY_NAMES = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

function clock(hhmm: string): string {
  const total = toMinutes(hhmm);
  const h = Math.floor(total / 60);
  const m = total % 60;
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}${m ? `:${String(m).padStart(2, "0")}` : ""} ${h < 12 ? "am" : "pm"}`;
}

const joinNames = (names: string[]) =>
  names.length <= 1 ? (names[0] ?? "") : `${names.slice(0, -1).join(", ")} and ${names.at(-1)}`;

/** "Monday to Friday 9 am to 5 pm, Saturday 9 am to 1 pm. Closed on Sundays." */
export function hoursText(p: BusinessProfile): string {
  const groups: { days: string[]; text: string }[] = [];
  const closed: string[] = [];
  p.hours.forEach((h, i) => {
    const day = DAY_NAMES[i] as string;
    if (!h) {
      closed.push(`${day}s`);
      return;
    }
    const text = `${clock(h[0])} to ${clock(h[1])}`;
    const group = groups.find((g) => g.text === text);
    if (group) group.days.push(day);
    else groups.push({ days: [day], text });
  });
  const open = groups.map((g) => {
    const idx = g.days.map((d) => DAY_NAMES.indexOf(d));
    const consecutive = idx.every((v, i) => i === 0 || v === (idx[i - 1] as number) + 1);
    const days =
      g.days.length >= 3 && consecutive ? `${g.days[0]} to ${g.days.at(-1)}` : joinNames(g.days);
    return `${days} ${g.text}`;
  });
  return `${open.join(", ")}.${closed.length ? ` Closed on ${joinNames(closed)}.` : ""}`;
}

/** Checks a profile for mistakes that would break bookings. Returns the problems found. */
export function validateProfile(p: BusinessProfile): string[] {
  const problems: string[] = [];
  if (!/^[a-z0-9-]+$/.test(p.id)) problems.push("id must be lower-case letters, digits and dashes");
  if (p.services.length === 0) problems.push("add at least one service");
  const ids = p.services.map((s) => s.id);
  if (new Set(ids).size !== ids.length) problems.push("service ids must be unique");
  for (const s of p.services) {
    if (!/^[a-z0-9_-]+$/.test(s.id)) problems.push(`service id "${s.id}" must be lower-case`);
    if (s.minutes <= 0 || s.minutes % p.booking.slotMinutes !== 0)
      problems.push(`"${s.name}" must last a multiple of ${p.booking.slotMinutes} minutes`);
    if (s.keywords.length === 0) problems.push(`"${s.name}" needs keywords`);
  }
  p.hours.forEach((h, i) => {
    if (!h) return;
    if (!/^\d{2}:\d{2}$/.test(h[0]) || !/^\d{2}:\d{2}$/.test(h[1]))
      problems.push(`${DAY_NAMES[i]}: use "HH:MM"`);
    else if (toMinutes(h[0]) >= toMinutes(h[1]))
      problems.push(`${DAY_NAMES[i]}: opens after it closes`);
  });
  if (p.hours.every((h) => h === null)) problems.push("open at least one day");
  if (!/^[A-Z]{2,4}$/.test(p.booking.referencePrefix))
    problems.push("referencePrefix must be 2-4 capital letters");
  return problems;
}
