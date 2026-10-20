import { describe, expect, it } from "vitest";
import { AGENTS, extractJson, isTemplateTask, matchAgent, parseWorkflow } from "./index";

describe("catalogue", () => {
  it("has unique, URL-safe slugs", () => {
    const slugs = AGENTS.map((a) => a.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
    for (const slug of slugs) expect(slug).toMatch(/^[a-z0-9-]+$/);
  });

  it.each(AGENTS.map((a) => [a.slug, a] as const))("%s has a valid workflow", (_s, agent) => {
    expect(parseWorkflow(agent.workflow)).toEqual(agent.workflow);
    expect(agent.workflow.steps.some((s) => s.kind === "human")).toBe(true);
    expect(agent.workflow.guardrails.length).toBeGreaterThanOrEqual(3);
    expect(agent.capabilities.length).toBeGreaterThanOrEqual(3);
  });
});

describe("matchAgent", () => {
  it.each([
    ["We miss calls while we're with patients", "voice-agent"],
    ["answer customer emails in our shared inbox", "inbox-agent"],
    ["staff waste time searching our policies and contracts", "knowledge-agent"],
    ["follow up new leads from our website", "sales-agent"],
    ["typing supplier invoices into Xero", "back-office-agent"],
    ["customers ask about order status on WhatsApp", "support-agent"],
  ])("%j → %s", (task, slug) => {
    expect(matchAgent(task)?.slug).toBe(slug);
  });

  it("returns null when nothing matches", () => {
    expect(matchAgent("bake bread")).toBeNull();
  });

  it("uses a template only for short, clear tasks", () => {
    const voice = AGENTS[0];
    if (!voice) throw new Error("no agents");
    expect(isTemplateTask("answer our phones", voice)).toBe(true);
    expect(
      isTemplateTask("our phones ring all day and we also need to check stock levels", voice),
    ).toBe(false);
  });
});

describe("parseWorkflow", () => {
  const good = {
    title: "Quote requests",
    steps: [
      { kind: "trigger", label: "Form submitted", detail: "Website quote form." },
      { kind: "agent", label: "Draft quote", detail: "From the price list." },
      { kind: "human", label: "Approve", detail: "Owner checks." },
    ],
    integrations: ["Gmail"],
    guardrails: ["Never sends without approval"],
  };

  it("accepts a valid workflow", () => {
    expect(parseWorkflow(good)?.steps).toHaveLength(3);
  });

  it.each([
    ["no title", { ...good, title: "" }],
    ["too few steps", { ...good, steps: good.steps.slice(0, 2) }],
    ["unknown kind", { ...good, steps: [...good.steps, { kind: "magic", label: "x" }] }],
    ["no trigger first", { ...good, steps: [...good.steps].reverse() }],
    [
      "no agent step",
      {
        ...good,
        steps: good.steps
          .filter((s) => s.kind !== "agent")
          .concat({ kind: "output", label: "x", detail: "" }),
      },
    ],
  ])("rejects %s", (_name, value) => {
    expect(parseWorkflow(value)).toBeNull();
  });

  it("trims and caps model output", () => {
    const long = { ...good, title: "x".repeat(300), integrations: Array(20).fill("Tool") };
    const parsed = parseWorkflow(long);
    expect(parsed?.title.length).toBe(80);
    expect(parsed?.integrations).toHaveLength(8);
  });

  it("extracts JSON from a chatty reply", () => {
    expect(extractJson('Sure! ```json\n{"a":1}\n```')).toEqual({ a: 1 });
    expect(extractJson("no json here")).toBeNull();
  });
});
