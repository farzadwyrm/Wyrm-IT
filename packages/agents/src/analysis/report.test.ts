import { describe, expect, it } from "vitest";
import { analyseWorkflow } from "./analyse";
import { stepFromDraft } from "./draft";
import { buildReport, hoursLabel } from "./report";
import type { StepInput, WorkflowInput } from "./types";

/** Fictional invoice-entry workflow; numbers chosen to land in each verdict. */
const step = (over: Partial<StepInput>): StepInput => ({
  ...stepFromDraft(
    {
      name: "Step",
      actorType: "staff",
      tools: [],
      inputFormat: "document",
      rekeying: false,
      decisionType: "guided_judgement",
      impactFlags: [],
    },
    over.id ?? "s",
  ),
  touchMinutes: 10,
  firstPassOutOf10: 9,
  confirmed: true,
  ...over,
});

const invoices = (over: Partial<WorkflowInput> = {}, steps?: StepInput[]): WorkflowInput => ({
  name: "Supplier invoices",
  outcome: "Invoice entered and scheduled for payment",
  triggerType: "email",
  triggerSource: "Suppliers email PDFs",
  recipients: ["internal"],
  volumeCount: 60,
  volumePeriod: "week",
  weekKind: "normal",
  typicalPerWeek: null,
  whyNow: "",
  exceptionsOutOf10: 1,
  exceptions: [],
  changeExpected: "no",
  documentation: "checklist",
  hourlyWage: 30,
  currency: "EUR",
  painTags: [],
  steps: steps ?? [
    step({
      id: "a",
      name: "Read the invoice PDF",
      tools: ["Gmail"],
      inputFormat: "document",
      decisionType: "none",
    }),
    step({
      id: "b",
      name: "Type it into Xero",
      tools: ["Xero"],
      inputFormat: "document",
      decisionType: "none",
      rekeying: true,
      touchMinutes: 8,
    }),
    step({
      id: "c",
      name: "Approve over 1,000",
      actorType: "owner",
      actorRole: "Owner",
      decisionType: "guided_judgement",
      impactFlags: ["money"],
      moneyBand: "500_5000",
      waitBand: "1_3_days",
      touchMinutes: 3,
    }),
  ],
  ...over,
});

const report = (w: WorkflowInput) => buildReport(w, analyseWorkflow(w));

describe("buildReport", () => {
  it("prioritises a high-volume, feasible process and explains the numbers", () => {
    const r = report(invoices());
    expect(r.verdict).toBe("prioritise");
    expect(r.confidence).toBe("high");
    expect(r.kpis.casesPerYear).toBe(2880);
    expect(r.kpis.touchMinutesPerCase).toBe(21);
    expect(r.kpis.leadTimeHours).toBeGreaterThan(16);
    expect(r.kpis.activityRatio).toBeLessThan(0.1);
    expect(r.kpis.automatableShare).toBeGreaterThan(0.5);
    expect(r.summary).toHaveLength(4);
    expect(r.summary[2]).toContain("capacity, not cash");
    // Systems are listed with how an agent could reach them.
    expect(r.systems.map((s) => [s.system, s.access])).toEqual([
      ["Gmail", "api_or_connector"],
      ["Xero", "api_or_connector"],
    ]);
    // The money approval is Tier 3: the owner approves.
    expect(r.approvers).toEqual(["Owner"]);
    expect(r.roadmap.map((p) => p.name)).toEqual([
      "Pilot in shadow mode",
      "Supervised operation",
      "Run and improve",
    ]);
  });

  it("reports re-keying, waiting and high-consequence steps as findings", () => {
    const ids = report(invoices()).findings.map((f) => f.id);
    expect(ids).toEqual(expect.arrayContaining(["rekeying", "waiting", "risk"]));
    expect(report(invoices()).findings[0]?.severity).toBe("high");
  });

  it("says fix the process first when most cases need correcting", () => {
    const w = invoices();
    w.steps = w.steps.map((s) => ({ ...s, firstPassOutOf10: 6 }));
    const r = report(w);
    expect(r.verdict).toBe("fix_first");
    expect(r.roadmap[0]?.name).toBe("Prepare the process");
    expect(r.findings.find((f) => f.id === "rework")?.severity).toBe("high");
  });

  it("defers when a major change is coming, with only a preparation phase", () => {
    const r = report(invoices({ changeExpected: "major" }));
    expect(r.verdict).toBe("defer");
    expect(r.roadmap).toHaveLength(1);
  });

  it("is honest when the volume is too small to be worth it", () => {
    const r = report(invoices({ volumeCount: 2 }));
    expect(r.verdict).toBe("not_now");
    expect(r.rationale).toContain("96 cases a year");
  });

  it("lowers confidence when inputs are missing or unreviewed", () => {
    const w = invoices({ volumeCount: null, exceptionsOutOf10: null });
    w.steps = w.steps.map((s) => ({ ...s, touchMinutes: null, confirmed: false }));
    const r = report(w);
    expect(r.confidence).toBe("low");
    expect(r.confidenceNote).toContain("typical values");
    expect(r.kpis.casesPerYear).toBeNull();
  });

  it("flags decisions about people as restricted", () => {
    const w = invoices({}, [
      step({ id: "x", name: "Shortlist applicants", impactFlags: ["decision_about_person"] }),
      step({ id: "y", name: "Send interview invites", impactFlags: ["external_message"] }),
    ]);
    const r = report(w);
    expect(r.kpis.maxTier).toBe(4);
    expect(r.findings.find((f) => f.id === "risk")?.title).toContain("decide about people");
  });

  it("formats durations for people", () => {
    expect(hoursLabel(0.25)).toBe("15 min");
    expect(hoursLabel(3)).toBe("3 h");
    expect(hoursLabel(24)).toBe("3 working days");
  });
});
