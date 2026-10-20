import { DEMO_PROFILE } from "./clients";
import { hoursText, openingHours } from "./profile";

export type { Service } from "./profile";

/**
 * The website demo's settings, kept under their original names for existing callers.
 * New code should take a `BusinessProfile` instead (see `profile.ts` and `clients/`).
 */
export const SERVICES = DEMO_PROFILE.services;

/** Opening hours per weekday (0 = Sunday), in minutes after midnight. null = closed. */
export const OPENING_HOURS = openingHours(DEMO_PROFILE);

export const CLINIC = {
  name: DEMO_PROFILE.name,
  address: DEMO_PROFILE.address,
  parking: DEMO_PROFILE.directions,
  hoursText: hoursText(DEMO_PROFILE),
  bookingWindowDays: DEMO_PROFILE.booking.windowDays,
  minimumNoticeMinutes: DEMO_PROFILE.booking.minimumNoticeMinutes,
  slotMinutes: DEMO_PROFILE.booking.slotMinutes,
} as const;
