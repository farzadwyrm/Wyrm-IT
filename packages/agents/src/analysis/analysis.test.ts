import { describe, expect, it } from "vitest";
import { analyseWorkflow } from "./analyse";
import { draftStepsFromText, parseStepDrafts, stepFromDraft } from "./draft";
import { aiFit, riskTier, scoreStep } from "./score";
import type { StepInput, WorkflowInput } from "./types";

const step = (over: Partial<StepInput>): StepInput => ({
  ...stepFromDraft(
    {
      name: "Step",
      actorType: "owner",
      tools: [],
      inputFormat: "message_text",
      rekeying: false,
      decisionType: "guided_judgement",
      impactFlags: [],
    },
    over.id ?? "s",
  ),
  touchMinutes: 10,
  firstPassOutOf10: 9,
  ...over,
});

const workflow = (steps: StepInput[], over: Partial<WorkflowInput> = {}): WorkflowInput => ({
  name: "Supplier invoices",
  outcome: "Invoice entered in Xero",
  triggerType: "email",
  triggerSource: "suppliers",
  recipients: ["internal"],
  volumeCount: 40,
  volumePeriod: "week",
  weekKind: "normal",
  typicalPerWeek: null,
  whyNow: "",
  exceptionsOutOf10: 1,
  exceptions: [],
  changeExpected: "no",
  documentation: "notes",
  hourlyWage: 30,
  currency: "EUR",
  painTags: [],
  steps,
  ...over,
});

describe("scoring classes", () => {
  it("uses plain automation, not AI, for rules on structured data", () => {
    const s = step({ inputFormat: "system_fields", decisionType: "fixed_rule", tools: ["Xero"] });
    const score = scoreStep(workflow([s]), s);
    expect(score).toMatchObject({ finalClass: "automate", engine: "code" });
  });

  it("gives unstructured, guided work to an AI agent", () => {
    const s = step({
      inputFormat: "document",
      decisionType: "guided_judgement",
      impactFlags: ["external_message"],
    });
    expect(scoreStep(workflow([s]), s)).toMatchObject({
      finalClass: "agent_check",
      engine: "llm",
      tier: 2,
    });
  });

  it("promotes low-risk agent work to automate with sampling", () => {
    const s = step({ inputFormat: "document", decisionType: "none" });
    expect(scoreStep(workflow([s]), s)).toMatchObject({
      finalClass: "automate",
      engine: "llm",
      tier: 1,
    });
  });

  it("caps money movements at an approval step", () => {
    const s = step({
      inputFormat: "system_fields",
      decisionType: "fixed_rule",
      tools: ["Stripe"],
      impactFlags: ["money"],
      moneyBand: "500_5000",
    });
    expect(scoreStep(workflow([s]), s)).toMatchObject({
      capability: "automate",
      tier: 3,
      finalClass: "agent_check",
    });
  });

  it("never lets AI decide about people", () => {
    const s = step({
      inputFormat: "document",
      decisionType: "guided_judgement",
      impactFlags: ["decision_about_person"],
    });
    expect(scoreStep(workflow([s]), s)).toMatchObject({ tier: 4, finalClass: "assist" });
  });

  it("respects the owner's wish to keep a step human", () => {
    const s = step({ inputFormat: "document", decisionType: "none", keepHuman: true });
    expect(scoreStep(workflow([s]), s).finalClass).toBe("human");
  });

  it("keeps physical work human", () => {
    expect(aiFit("in_person_physical", "none")).toBe(1);
    const s = step({ inputFormat: "in_person_physical", decisionType: "none" });
    expect(scoreStep(workflow([s]), s).finalClass).toBe("human");
  });

  it("does not automate steps with many exceptions deterministically", () => {
    const s = step({ inputFormat: "system_fields", decisionType: "fixed_rule", tools: ["Xero"] });
    expect(scoreStep(workflow([s], { exceptionsOutOf10: 5 }), s).finalClass).not.toBe("automate");
  });

  it("treats small payments as moderate risk", () => {
    expect(riskTier(step({ impactFlags: ["money"], moneyBand: "lt_50" }))).toBe(2);
    expect(riskTier(step({ impactFlags: ["commitment"], reversibility: "irreversible" }))).toBe(3);
  });
});

describe("analyseWorkflow", () => {
  const steps = [
    step({
      id: "a",
      name: "Read the invoice email",
      inputFormat: "document",
      decisionType: "none",
      touchMinutes: 3,
    }),
    step({
      id: "b",
      name: "Type it into Xero",
      inputFormat: "system_fields",
      decisionType: "fixed_rule",
      tools: ["Xero"],
      rekeying: true,
      touchMinutes: 6,
    }),
    step({
      id: "c",
      name: "Approve payment",
      inputFormat: "system_fields",
      decisionType: "guided_judgement",
      tools: ["Xero"],
      impactFlags: ["money"],
      moneyBand: "500_5000",
      touchMinutes: 2,
    }),
  ];

  it("estimates hours as a range with stated assumptions", () => {
    const a = analyseWorkflow(workflow(steps));
    const { low, base, high } = a.savings.savedHoursYear;
    expect(low).toBeLessThan(base);
    expect(base).toBeLessThan(high);
    // 40/week × 48 weeks × 11 min ≈ 352 h baseline (plus rework).
    expect(a.savings.baselineHoursYear).toBeGreaterThan(350);
    expect(a.savings.valueYear?.base).toBeGreaterThan(0);
    expect(a.savings.assumptions.some((x) => x.provenance === "default")).toBe(true);
    expect(a.savings.biggestStepId).toBe("b");
  });

  it("puts an approval before high-risk actions in the agent design", () => {
    const a = analyseWorkflow(workflow(steps));
    const labels = a.toBe?.steps.map((s) => `${s.kind}:${s.label}`) ?? [];
    expect(labels[0]).toBe("trigger:Email arrives");
    expect(labels).toContain("human:Approve payment (person decides)");
    expect(labels.some((l) => l.includes("Approve: approve"))).toBe(false);
    expect(a.maxTier).toBe(3);
  });

  it("shows no money without a wage", () => {
    expect(analyseWorkflow(workflow(steps, { hourlyWage: null })).savings.valueYear).toBeNull();
  });

  it("defers when major change is coming, and flags broken processes", () => {
    expect(analyseWorkflow(workflow(steps, { changeExpected: "major" })).toBe).toBeNull();
    const broken = steps.map((s) => ({ ...s, firstPassOutOf10: 6 }));
    expect(analyseWorkflow(workflow(broken)).gates.fixFirst).toBe(true);
  });

  it("lists missing answers instead of guessing", () => {
    const a = analyseWorkflow(workflow([step({ touchMinutes: null })], { volumeCount: null }));
    expect(a.savings.openQuestions.length).toBe(2);
  });
});

describe("drafting steps", () => {
  it("splits a walk-through into steps with sensible guesses", () => {
    const steps = draftStepsFromText(
      "I open the supplier email with the PDF invoice. Then I type the amounts into Xero. Then I check it against the order and pay it.",
    );
    expect(steps).toHaveLength(3);
    expect(steps[0]?.inputFormat).toBe("document");
    expect(steps[1]).toMatchObject({ rekeying: true, tools: ["xero"] });
    expect(steps[2]?.impactFlags).toContain("money");
  });

  it("validates model drafts and fills safe defaults", () => {
    const parsed = parseStepDrafts({
      steps: [
        {
          name: "Read email",
          actorType: "robot",
          inputFormat: "message_text",
          impactFlags: ["money", "bogus"],
        },
        { name: "" },
      ],
    });
    expect(parsed).toEqual([
      {
        name: "Read email",
        actorType: "owner",
        tools: [],
        inputFormat: "message_text",
        rekeying: false,
        decisionType: "guided_judgement",
        impactFlags: ["money"],
      },
    ]);
    expect(parseStepDrafts({ nope: 1 })).toBeNull();
  });
});
