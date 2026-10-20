import type { BusinessProfile } from "../profile";
import { brightCutsSalon } from "./bright-cuts-salon";
import { harborLaneDental } from "./harbor-lane-dental";

/**
 * Every client's receptionist settings. To add a client: copy `bright-cuts-salon.ts`, fill it
 * in, and add it here. The tests check every profile (see docs/business/NEW_CLIENT.md).
 */
export const PROFILES: readonly BusinessProfile[] = [harborLaneDental, brightCutsSalon];

/** The website demo. */
export const DEMO_PROFILE: BusinessProfile = harborLaneDental;

export function getProfile(id: string): BusinessProfile | undefined {
  return PROFILES.find((p) => p.id === id);
}
