import { describe, expect, it } from "vitest";
import { compact, isEmail, isPublicPath, isValidSlug, safeNext, slugify } from "./config";

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

describe("public paths", () => {
  it("only the sign-in pages are public", () => {
    expect(isPublicPath("/login")).toBe(true);
    expect(isPublicPath("/auth/confirm")).toBe(true);
    expect(isPublicPath("/auth/callback")).toBe(true);
    expect(isPublicPath("/")).toBe(false);
    expect(isPublicPath("/admin")).toBe(false);
    expect(isPublicPath("/loginx")).toBe(false);
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
