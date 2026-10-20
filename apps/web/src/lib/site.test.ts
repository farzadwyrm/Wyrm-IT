import { AGENTS } from "@wyrm/agents";
import { describe, expect, it } from "vitest";
import { DEMOS, NAV, OFFERS, STATIC_ROUTES } from "./site";

describe("site content", () => {
  it("has unique demo slugs that are URL-safe", () => {
    const slugs = DEMOS.map((d) => d.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
    for (const slug of slugs) expect(slug).toMatch(/^[a-z0-9-]+$/);
  });

  it("has three offers, from discovery to managed agents", () => {
    expect(OFFERS.map((o) => o.slug)).toEqual([
      "workflow-sprint",
      "build-deploy",
      "managed-agents",
    ]);
  });

  it("links every nav item to a known page", () => {
    for (const item of NAV) expect(STATIC_ROUTES).toContain(item.href);
  });

  it("can read the shared agent catalogue", () => {
    expect(AGENTS.length).toBeGreaterThan(0);
  });
});
