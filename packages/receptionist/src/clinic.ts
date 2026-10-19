/**
 * The fictional clinic the demo receptionist works for. Everything here is invented:
 * no real business, address or phone number.
 */

export interface Service {
  id: string;
  name: string;
  minutes: number;
  price: string;
  /** Lower-case words that identify this service in a message. */
  keywords: readonly string[];
}

export const SERVICES: readonly Service[] = [
  {
    id: "checkup",
    name: "Check-up",
    minutes: 30,
    price: "€45",
    keywords: ["check-up", "checkup", "check up", "exam", "examination", "routine"],
  },
  {
    id: "cleaning",
    name: "Hygiene cleaning",
    minutes: 60,
    price: "€70",
    keywords: ["clean", "cleaning", "cleaned", "hygiene", "hygienist", "scale", "polish"],
  },
  {
    id: "whitening",
    name: "Teeth whitening",
    minutes: 60,
    price: "€250",
    keywords: ["whiten", "whitening", "bleach"],
  },
  {
    id: "urgent",
    name: "Urgent visit",
    minutes: 30,
    price: "€60",
    keywords: [
      "urgent",
      "emergency",
      "pain",
      "painful",
      "toothache",
      "hurts",
      "hurting",
      "broken",
      "chipped",
      "swollen",
    ],
  },
];

/** Opening hours per weekday (0 = Sunday), in minutes after midnight. null = closed. */
export const OPENING_HOURS: Readonly<Record<number, readonly [number, number] | null>> = {
  0: null,
  1: [9 * 60, 17 * 60],
  2: [9 * 60, 17 * 60],
  3: [9 * 60, 19 * 60],
  4: [9 * 60, 17 * 60],
  5: [9 * 60, 16 * 60],
  6: [9 * 60, 13 * 60],
};

export const CLINIC = {
  name: "Harbor Lane Dental",
  address: "12 Harbor Lane, next to the old ferry terminal",
  parking: "Free parking behind the building; the number 4 bus stops outside.",
  hoursText:
    "Monday, Tuesday and Thursday 9 am to 5 pm, Wednesday 9 am to 7 pm, Friday 9 am to 4 pm, Saturday 9 am to 1 pm. Closed on Sundays.",
  /** Bookings can be made this many days ahead. */
  bookingWindowDays: 60,
  /** Minimum notice for a same-day booking, in minutes. */
  minimumNoticeMinutes: 60,
  slotMinutes: 30,
} as const;
