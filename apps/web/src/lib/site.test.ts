import { QUESTIONS } from "@wyrm/assessment";
import { describe, expect, it } from "vitest";
import { DEMOS, OFFERS } from "./site";

describe("site content", () => {
  it("has unique demo slugs that are URL-safe", () => {
    const slugs = DEMOS.map((d) => d.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
    for (const slug of slugs) expect(slug).toMatch(/^[a-z0-9-]+$/);
  });

  it("starts the offer ladder with the free scan", () => {
    expect(OFFERS[0]?.price).toBe("Free");
  });

  it("can read the shared assessment package", () => {
    expect(QUESTIONS.length).toBeGreaterThan(0);
  });
});
