import { describe, expect, it } from "vitest";
import {
  AREAS,
  compactArea,
  fallbackAnswer,
  getArea,
  guideIndex,
  instantAnswer,
  PHASES,
  PILLARS,
  pickArea,
} from "./index";

describe("content", () => {
  it("has 19 areas with unique slugs", () => {
    expect(AREAS).toHaveLength(19);
    expect(new Set(AREAS.map((a) => a.slug)).size).toBe(AREAS.length);
  });

  it.each(AREAS.map((a) => [a.slug, a] as const))("%s is complete", (_slug, area) => {
    for (const text of [
      area.title,
      area.technical,
      area.oneLiner,
      area.summary,
      area.whyItMatters,
    ]) {
      expect(text.trim().length).toBeGreaterThan(2);
    }
    expect(area.parts.length).toBeGreaterThanOrEqual(3);
    expect(area.warningSigns.length).toBeGreaterThanOrEqual(3);
    expect(area.quickWins.length).toBeGreaterThanOrEqual(3);
    expect(area.questions.length).toBeGreaterThanOrEqual(3);
    expect(PILLARS[area.pillar]).toBeDefined();
    expect(PHASES[area.phase]).toBeDefined();
    for (const slug of area.related) expect(getArea(slug), `${area.slug} → ${slug}`).toBeDefined();
  });

  it("covers every pillar and phase", () => {
    expect(new Set(AREAS.map((a) => a.pillar))).toEqual(new Set(Object.keys(PILLARS)));
    expect(new Set(AREAS.map((a) => a.phase))).toEqual(new Set([1, 2, 3, 4]));
  });

  it("keeps AI context small", () => {
    for (const area of AREAS) expect(compactArea(area).length).toBeLessThan(2400);
    expect(guideIndex().length).toBeLessThan(2400);
  });

  it("is deterministic, so prompt caches hit", () => {
    const area = AREAS[0];
    if (!area) throw new Error("no areas");
    expect(compactArea(area)).toBe(compactArea(area));
  });

  it("never names third-party source documents or their people", () => {
    const all = JSON.stringify(AREAS).toLowerCase();
    for (const banned of ["ardalan", "vertical compute", "handbook"]) {
      expect(all).not.toContain(banned);
    }
  });
});

describe("pickArea", () => {
  it.each([
    ["Are our backups good enough?", "backup-recovery"],
    ["what if we get ransomware", "backup-recovery"],
    ["Should we turn on MFA?", "identity-access"],
    ["our wifi keeps dropping", "network"],
    ["what happens when someone leaves the company", "user-lifecycle"],
    ["a laptop was stolen", "endpoints"],
    ["is it safe to use ChatGPT with client files", "ai"],
    ["who owns our domain", "web-public"],
    ["do we need GDPR compliance", "security-compliance"],
    ["our cloud bill on AWS is too high", "cloud"],
  ])("%j → %s", (question, slug) => {
    expect(pickArea(question)?.slug).toBe(slug);
  });

  it("uses the current page when the question names no area", () => {
    expect(pickArea("how long does this take?", "network")?.slug).toBe("network");
    expect(pickArea("how long does this take?")).toBeNull();
  });

  it("returns null off topic", () => {
    expect(pickArea("what's a good pasta recipe")).toBeNull();
  });
});

describe("instantAnswer", () => {
  it("answers clear question shapes from the guide", () => {
    expect(instantAnswer("quick wins for backups")).toContain("Test a real restore");
    expect(instantAnswer("what should I ask?", "network")).toContain("second internet line");
    expect(instantAnswer("what is MFA?")).toContain("Every person and service");
  });

  it("leaves real questions to the AI", () => {
    expect(instantAnswer("we have 12 people and one NAS, how should we back it up?")).toBeNull();
    expect(instantAnswer("is our setup safe?")).toBeNull();
    expect(instantAnswer("pasta recipe")).toBeNull();
  });
});

describe("fallbackAnswer", () => {
  it("still gives something useful without AI", () => {
    expect(fallbackAnswer("backups?")).toContain("Quick wins");
    expect(fallbackAnswer("hello")).toContain("Backups and recovery");
  });
});
