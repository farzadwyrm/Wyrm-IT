import "server-only";
import { type CalendarApi, googleCalendarApi } from "@wyrm/core";

/**
 * Google Calendar settings from the server environment. Calendar features stay switched off
 * until GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET are set (same Google project as sign-in). Tokens
 * are encrypted with a key derived from SUPABASE_SECRET_KEY, so no extra secret is needed.
 */
export function calendarConfig() {
  const clientId = process.env.GOOGLE_CLIENT_ID?.trim();
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET?.trim();
  const secret = process.env.SUPABASE_SECRET_KEY?.trim();
  if (!clientId || !clientSecret || !secret) return null;
  return { clientId, clientSecret, secret };
}

export function calendarDeps(): { api: CalendarApi; secret: string } | undefined {
  const config = calendarConfig();
  return config
    ? { api: googleCalendarApi(config.clientId, config.clientSecret), secret: config.secret }
    : undefined;
}

export const CALENDAR_SCOPES = [
  "openid",
  "email",
  "https://www.googleapis.com/auth/calendar.events",
  "https://www.googleapis.com/auth/calendar.freebusy",
].join(" ");

export const calendarRedirect = (host: string) => `https://${host}/api/calendar/callback`;
