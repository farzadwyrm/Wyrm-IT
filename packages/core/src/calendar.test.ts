import { describe, expect, it } from "vitest";
import { decryptToken, durationMinutes, encryptToken, zonedTime } from "./calendar";

// Fictional secret for tests only.
const SECRET = "test-secret-value-that-is-long-enough";

describe("token encryption", () => {
  it("round-trips, never stores the plain token, and detects tampering or a wrong key", () => {
    const enc = encryptToken("refresh-token-123", SECRET);
    expect(enc).not.toContain("refresh-token-123");
    expect(decryptToken(enc, SECRET)).toBe("refresh-token-123");
    expect(encryptToken("refresh-token-123", SECRET)).not.toBe(enc); // fresh IV each time
    const raw = Buffer.from(enc, "base64");
    raw[raw.length - 1] = (raw[raw.length - 1] ?? 0) ^ 1;
    expect(() => decryptToken(raw.toString("base64"), SECRET)).toThrow();
    expect(() => decryptToken(enc, "another-secret-value-that-is-long")).toThrow();
    expect(() => encryptToken("x", "short")).toThrow();
  });
});

describe("times", () => {
  it("turns local wall-clock time into the right instant, summer and winter", () => {
    expect(zonedTime("2026-07-15", "10:00", "Europe/Lisbon")?.toISOString()).toBe(
      "2026-07-15T09:00:00.000Z",
    );
    expect(zonedTime("2026-12-15", "10:00", "Europe/Lisbon")?.toISOString()).toBe(
      "2026-12-15T10:00:00.000Z",
    );
    expect(zonedTime("2026-12-15", "9:30", "America/New_York")?.toISOString()).toBe(
      "2026-12-15T14:30:00.000Z",
    );
    expect(zonedTime("next tuesday", "10:00", "Europe/Lisbon")).toBeNull();
  });

  it("reads service durations", () => {
    expect(durationMinutes("30 min")).toBe(30);
    expect(durationMinutes("1 hour")).toBe(60);
    expect(durationMinutes("1h30")).toBe(90);
    expect(durationMinutes(undefined)).toBe(30);
  });
});
