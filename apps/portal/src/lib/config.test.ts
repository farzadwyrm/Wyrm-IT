import { describe, expect, it } from "vitest";
import {
  compact,
  isEmail,
  isProtectedPath,
  isValidSlug,
  passwordProblem,
  safeNext,
  slugify,
} from "./config";

describe("safeNext", () => {
  it.each([
    ["/", "/"],
    ["/admin", "/admin"],
    ["/org/abc?tab=1", "/org/abc?tab=1"],
  ])("keeps same-site path %s", (input, expected) => {
    expect(safeNext(input)).toBe(expected);
  });

  it.each([
    null,
    "",
    "https://evil.example",
    "//evil.example",
    "/\\evil.example",
    "javascript:alert(1)",
    "/x?u=https://evil.example",
    "/ok\r\nSet-Cookie: x=1",
  ])("refuses unsafe redirect %j", (input) => {
    expect(safeNext(input)).toBe("/");
  });
});

describe("protected paths", () => {
  it("only the client area needs signing in", () => {
    expect(isProtectedPath("/dashboard")).toBe(true);
    expect(isProtectedPath("/dashboard/settings")).toBe(true);
    expect(isProtectedPath("/admin")).toBe(true);
    expect(isProtectedPath("/")).toBe(false);
    expect(isProtectedPath("/login")).toBe(false);
    expect(isProtectedPath("/auth/callback")).toBe(false);
    expect(isProtectedPath("/administrator-info")).toBe(false);
  });
});

describe("slugs and emails", () => {
  it("makes URL-safe slugs", () => {
    expect(slugify("Bright Cuts Salon")).toBe("bright-cuts-salon");
    expect(slugify("  Café Zoë & Co. ")).toBe("cafe-zoe-co");
    expect(isValidSlug("bright-cuts-salon")).toBe(true);
    expect(isValidSlug("a")).toBe(false);
    expect(isValidSlug("Bad Slug")).toBe(false);
  });

  it("accepts normal emails only", () => {
    expect(isEmail("owner@example.com")).toBe(true);
    expect(isEmail("not an email")).toBe(false);
    expect(isEmail("a@b")).toBe(false);
  });
});

describe("compact", () => {
  it("removes pasted line breaks and spaces from keys and URLs", () => {
    expect(compact("sb_publishable_abc\n123 ")).toBe("sb_publishable_abc123");
    expect(compact(" https://x.supabase.co/ ")).toBe("https://x.supabase.co");
    expect(compact("   ")).toBeNull();
    expect(compact(undefined)).toBeNull();
  });
});

describe("passwordProblem", () => {
  it("accepts a long enough password that matches its confirmation", () => {
    expect(passwordProblem("correct horse battery", "correct horse battery")).toBeNull();
  });

  it("rejects short, repeated, too long or mismatched passwords", () => {
    expect(passwordProblem("short")).toMatch(/10 characters/);
    expect(passwordProblem("aaaaaaaaaaaa")).toMatch(/repeat/);
    expect(passwordProblem("x".repeat(40) + "y".repeat(40))).toMatch(/72/);
    expect(passwordProblem("long enough pass", "different pass!")).toMatch(/match/);
  });
});

describe("account pages", () => {
  it("need sign-in", () => {
    expect(isProtectedPath("/account/password")).toBe(true);
  });
});
