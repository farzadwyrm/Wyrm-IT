"use client";

import {
  analyseWorkflow,
  buildReport,
  MAX_STEPS,
  matchAgent,
  type StepInput,
  stepFromDraft,
  type WorkflowInput,
} from "@wyrm/agents";
import { useEffect, useMemo, useRef, useState } from "react";
import type { StepsRequest, StepsResponse } from "@/lib/analyse-api";
import { CheckGroup, NumberField, Select, TextArea, TextInput } from "./fields";
import {
  CHANGES,
  CURRENCIES,
  DOCS,
  EXAMPLE_WALKTHROUGH,
  PAINS,
  RECIPIENTS,
  TRIGGERS,
} from "./options";
import { AssessmentReport } from "./result";
import { StepEditor } from "./step-card";

const STORAGE_KEY = "wyrm-assessment-v3";
const OLD_KEY = "wyrm-analyser-v2";

const EMPTY: WorkflowInput = {
  name: "",
  outcome: "",
  triggerType: "email",
  triggerSource: "",
  recipients: [],
  volumeCount: null,
  volumePeriod: "week",
  weekKind: "normal",
  typicalPerWeek: null,
  whyNow: "",
  exceptionsOutOf10: null,
  exceptions: [],
  changeExpected: "no",
  documentation: "notes",
  hourlyWage: null,
  currency: "EUR",
  painTags: [],
  steps: [],
};

const SECTIONS = [
  {
    key: "scope",
    title: "Scope",
    intro: "Define the process boundary: what starts it, what it produces and how often it runs.",
  },
  {
    key: "steps",
    title: "Current process",
    intro:
      "Map the process as it actually runs today, step by step, with the time each step takes.",
  },
  {
    key: "quality",
    title: "Exceptions & quality",
    intro: "Where cases leave the standard path, and where time is lost.",
  },
  {
    key: "context",
    title: "Cost & context",
    intro: "What the time costs and how stable the process is.",
  },
  { key: "report", title: "Assessment", intro: "" },
] as const;
type SectionKey = (typeof SECTIONS)[number]["key"];

interface Saved {
  section: SectionKey;
  input: WorkflowInput;
  walkthrough: string;
}

function load(): Saved | null {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw) as Saved;
    const old = window.localStorage.getItem(OLD_KEY);
    if (old) {
      const v2 = JSON.parse(old) as { input?: WorkflowInput; walkthrough?: string };
      if (v2.input)
        return {
          section: "scope",
          input: { ...EMPTY, ...v2.input },
          walkthrough: v2.walkthrough ?? "",
        };
    }
  } catch {
    // Unreadable or blocked storage: start fresh.
  }
  return null;
}

function save(value: Saved) {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(value));
  } catch {
    // Private mode or blocked storage: the assessment still works, it just isn't remembered.
  }
}

let nextId = 0;
const newId = () => `s${Date.now().toString(36)}${nextId++}`;

const blankStep = (): StepInput => ({
  ...stepFromDraft(
    {
      name: "",
      actorType: "staff",
      tools: [],
      inputFormat: "system_fields",
      rekeying: false,
      decisionType: "none",
      impactFlags: [],
    },
    newId(),
  ),
  confirmed: true,
});

/** Trims free text so stray commas or spaces don't change the scoring. */
const clean = (w: WorkflowInput): WorkflowInput => ({
  ...w,
  steps: w.steps.map((s) => ({ ...s, tools: s.tools.map((t) => t.trim()).filter(Boolean) })),
});

const primary =
  "inline-flex min-h-11 items-center rounded-lg bg-ember px-5 font-semibold text-paper hover:bg-ember-strong disabled:opacity-40";
const secondary =
  "inline-flex min-h-11 items-center rounded-lg border border-line px-4 text-sm font-semibold hover:border-ink-muted disabled:opacity-40";

/**
 * Workflow assessment workspace: scope (SIPOC), the current process with per-step metrics
 * (metrics-based process mapping), exceptions and waste, cost and stability, then the report.
 * Method: docs/research/reports/AI agent workflow analysis method.md. Inputs stay in the
 * browser; only the walk-through text is sent to draft the step map.
 */
export function WorkflowAnalyser() {
  const [section, setSection] = useState<SectionKey>("scope");
  const [input, setInput] = useState<WorkflowInput>(EMPTY);
  const [walkthrough, setWalkthrough] = useState("");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [restored, setRestored] = useState(false);
  const headingRef = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    const saved = load();
    const q = new URLSearchParams(window.location.search).get("q")?.slice(0, 120);
    if (q) setInput({ ...EMPTY, name: q });
    else if (saved) {
      setSection(saved.section);
      setInput(saved.input);
      setWalkthrough(saved.walkthrough);
    }
    setRestored(true);
  }, []);

  useEffect(() => {
    if (restored) save({ section, input, walkthrough });
  }, [restored, section, input, walkthrough]);

  const patch = (p: Partial<WorkflowInput>) => setInput((prev) => ({ ...prev, ...p }));
  const goTo = (key: SectionKey) => {
    setNotice(null);
    setSection(key);
    requestAnimationFrame(() => {
      headingRef.current?.focus();
      headingRef.current?.scrollIntoView({ block: "start", behavior: "smooth" });
    });
  };

  const namedSteps = input.steps.filter((s) => s.name.trim());
  const missing = [
    ...(input.name.trim().length < 3 ? [["scope", "Process name"] as const] : []),
    ...(input.volumeCount === null ? [["scope", "Volume (cases per week or month)"] as const] : []),
    ...(namedSteps.length < 2 ? [["steps", "At least two process steps"] as const] : []),
    ...(input.exceptionsOutOf10 === null
      ? [["quality", "Share of cases that leave the standard path"] as const]
      : []),
  ];
  // Without a volume there is no business case, so the report would mislead.
  const blocking = missing.filter(
    ([, label]) => label !== "Share of cases that leave the standard path",
  );
  const done: Record<SectionKey, boolean> = {
    scope: input.name.trim().length >= 3 && input.volumeCount !== null,
    steps: namedSteps.length >= 2 && namedSteps.every((s) => s.touchMinutes !== null),
    quality: input.exceptionsOutOf10 !== null,
    context: input.hourlyWage !== null,
    report: false,
  };

  const ready = blocking.length === 0;
  const cleaned = useMemo(() => clean({ ...input, steps: namedSteps }), [input, namedSteps]);
  const analysis = useMemo(
    () => (section === "report" && ready ? analyseWorkflow(cleaned) : null),
    [section, ready, cleaned],
  );
  const report = useMemo(
    () => (analysis ? buildReport(cleaned, analysis) : null),
    [analysis, cleaned],
  );
  const agent = useMemo(
    () => matchAgent(`${input.name} ${walkthrough}`),
    [input.name, walkthrough],
  );

  async function draftSteps() {
    setBusy(true);
    setNotice(null);
    let data: StepsResponse;
    try {
      const response = await fetch("/api/analyse/steps", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          walkthrough,
          outcome: input.outcome || input.name,
          trigger: TRIGGERS.find(([t]) => t === input.triggerType)?.[1] ?? "",
        } satisfies StepsRequest),
      });
      data = (await response.json()) as StepsResponse;
    } catch {
      data = { status: "error" };
    }
    setBusy(false);
    if (data.status !== "ok") {
      setNotice(
        "The steps couldn't be drafted. Write one action per line, or add steps manually below.",
      );
      return;
    }
    patch({ steps: data.steps.map((d) => stepFromDraft(d, newId())) });
    setNotice(
      `${data.steps.length} steps drafted${data.provider === "text" ? " from your lines" : " by AI"}. Review each one and add the hands-on minutes.`,
    );
  }

  const updateStep = (i: number, s: StepInput) =>
    patch({ steps: input.steps.map((x, j) => (j === i ? s : x)) });
  const moveStep = (i: number, delta: -1 | 1) => {
    const j = i + delta;
    if (j < 0 || j >= input.steps.length) return;
    const steps = [...input.steps];
    [steps[i], steps[j]] = [steps[j] as StepInput, steps[i] as StepInput];
    patch({ steps });
  };

  const index = SECTIONS.findIndex((s) => s.key === section);
  const meta = SECTIONS[index] ?? SECTIONS[0];

  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-8 lg:grid-cols-[230px_minmax(0,1fr)]">
      <nav
        aria-label="Assessment sections"
        className="min-w-0 lg:sticky lg:top-24 lg:self-start print:hidden"
      >
        <ol className="relative flex gap-1 overflow-x-auto pb-1 lg:flex-col lg:overflow-visible">
          {SECTIONS.map((s, i) => {
            const current = s.key === section;
            return (
              <li key={s.key} className="shrink-0">
                <button
                  type="button"
                  onClick={() => goTo(s.key)}
                  aria-current={current ? "step" : undefined}
                  disabled={s.key === "report" && !ready}
                  className={`flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm transition-colors disabled:opacity-40 ${
                    current
                      ? "bg-paper-raised font-semibold text-ink"
                      : "text-ink-muted hover:text-ink"
                  }`}
                >
                  <span
                    className={`flex size-6 shrink-0 items-center justify-center rounded-full border font-mono text-xs ${
                      done[s.key]
                        ? "border-moss/60 text-moss"
                        : current
                          ? "border-ember text-ember"
                          : "border-line"
                    }`}
                    aria-hidden="true"
                  >
                    {done[s.key] ? "✓" : i + 1}
                  </span>
                  {s.title}
                  {done[s.key] && <span className="sr-only"> (complete)</span>}
                </button>
              </li>
            );
          })}
        </ol>
        <div className="mt-6 hidden space-y-3 border-t border-line pt-4 text-xs text-ink-muted lg:block">
          <p>Saved in this browser only. Nothing is stored on our servers.</p>
          <button
            type="button"
            onClick={() => {
              setInput(EMPTY);
              setWalkthrough("");
              goTo("scope");
            }}
            className="font-semibold text-ink-muted underline-offset-4 hover:text-ink hover:underline"
          >
            Start a new assessment
          </button>
        </div>
      </nav>

      <div className="min-w-0">
        {section !== "report" && (
          <header className="mb-8 scroll-mt-28">
            <p className="font-mono text-xs uppercase tracking-wider text-ember">
              Section {index + 1} of 4
            </p>
            <h2
              ref={headingRef}
              tabIndex={-1}
              className="mt-2 font-display text-2xl font-semibold tracking-tight outline-none sm:text-3xl"
            >
              {meta.title}
            </h2>
            <p className="mt-2 max-w-2xl text-ink-muted">{meta.intro}</p>
          </header>
        )}

        {section === "scope" && (
          <div className="space-y-8">
            <div className="grid gap-5 md:grid-cols-2">
              <TextInput
                label="Process name"
                required
                value={input.name}
                maxLength={120}
                placeholder="e.g. Supplier invoice processing"
                onChange={(name) => patch({ name })}
              />
              <TextInput
                label="Result when done"
                hint="The output that marks a case complete"
                value={input.outcome}
                maxLength={200}
                placeholder="e.g. Invoice entered and payment scheduled"
                onChange={(outcome) => patch({ outcome })}
              />
              <Select
                label="Trigger"
                required
                options={TRIGGERS}
                value={input.triggerType}
                onChange={(triggerType) => patch({ triggerType })}
              />
              <TextInput
                label="Trigger detail"
                hint="Who or what starts it, and where"
                value={input.triggerSource}
                maxLength={160}
                placeholder="e.g. Suppliers email PDF invoices to accounts@"
                onChange={(triggerSource) => patch({ triggerSource })}
              />
            </div>

            <CheckGroup
              legend="Output goes to"
              options={RECIPIENTS}
              value={input.recipients}
              onChange={(recipients) => patch({ recipients })}
              columns={3}
            />

            <fieldset className="space-y-4 rounded-xl border border-line p-5">
              <legend className="px-1 text-sm font-semibold">Volume</legend>
              <p className="-mt-2 text-xs text-ink-muted">
                Count a recent, specific period rather than guessing an average.
              </p>
              <div className="grid gap-5 sm:grid-cols-3">
                <NumberField
                  label="Cases"
                  required
                  value={input.volumeCount}
                  onChange={(volumeCount) => patch({ volumeCount })}
                />
                <Select
                  label="In the last"
                  options={[
                    ["week", "Week"],
                    ["month", "Month"],
                  ]}
                  value={input.volumePeriod}
                  onChange={(volumePeriod) => patch({ volumePeriod })}
                />
                <Select
                  label="That period was"
                  options={[
                    ["normal", "Typical"],
                    ["busy", "Busier than usual"],
                    ["quiet", "Quieter than usual"],
                  ]}
                  value={input.weekKind}
                  onChange={(weekKind) => patch({ weekKind })}
                />
              </div>
              {input.weekKind !== "normal" && (
                <NumberField
                  label="Cases in a typical week"
                  value={input.typicalPerWeek}
                  onChange={(typicalPerWeek) => patch({ typicalPerWeek })}
                  suffix="per week"
                />
              )}
            </fieldset>

            <TextArea
              label="Why look at this process now?"
              hint="The business objective: capacity, response time, errors, growth"
              value={input.whyNow}
              maxLength={400}
              rows={2}
              placeholder="e.g. Invoice volume doubled this year and month-end close slips"
              onChange={(whyNow) => patch({ whyNow })}
            />
          </div>
        )}

        {section === "steps" && (
          <div className="space-y-8">
            <section className="space-y-3 rounded-xl border border-line bg-paper-raised/40 p-5">
              <TextArea
                label="Walk through the most recent case"
                hint="From trigger to done, one action per line: who did what, in which system. Describe what really happened, not the ideal. No customer names."
                value={walkthrough}
                maxLength={3000}
                rows={6}
                placeholder={"A supplier emails…\nThe office manager checks…\nShe types… into…"}
                onChange={setWalkthrough}
              />
              <div className="flex flex-wrap items-center gap-3">
                <button
                  type="button"
                  onClick={() => void draftSteps()}
                  disabled={busy || walkthrough.trim().split(/\s+/).length < 8}
                  className={primary}
                >
                  {busy
                    ? "Drafting the step map…"
                    : input.steps.length
                      ? "Redraft steps"
                      : "Draft the step map"}
                </button>
                {!walkthrough && (
                  <button
                    type="button"
                    onClick={() => setWalkthrough(EXAMPLE_WALKTHROUGH)}
                    className="text-sm font-semibold text-ember hover:text-ember-strong"
                  >
                    Use an example
                  </button>
                )}
                {input.steps.length > 0 && (
                  <span className="text-xs text-ink-muted">
                    Redrafting replaces the steps below.
                  </span>
                )}
              </div>
            </section>

            {notice && (
              <p
                role="status"
                className="rounded-lg border border-line bg-paper-raised p-3 text-sm"
              >
                {notice}
              </p>
            )}

            {input.steps.length > 0 ? (
              <ol className="space-y-4">
                {input.steps.map((step, i) => (
                  <StepEditor
                    key={step.id}
                    step={step}
                    index={i}
                    count={input.steps.length}
                    onChange={(s) => updateStep(i, s)}
                    onRemove={() => patch({ steps: input.steps.filter((_, j) => j !== i) })}
                    onMove={(d) => moveStep(i, d)}
                  />
                ))}
              </ol>
            ) : (
              <p className="rounded-xl border border-dashed border-line p-6 text-sm text-ink-muted">
                No steps yet. Draft them from the walk-through above, or add them one by one.
              </p>
            )}
            {input.steps.length < MAX_STEPS && (
              <button
                type="button"
                onClick={() => patch({ steps: [...input.steps, blankStep()] })}
                className={secondary}
              >
                + Add step
              </button>
            )}
          </div>
        )}

        {section === "quality" && (
          <div className="space-y-8">
            <Select
              label="Of the last 10 cases, how many left the standard path?"
              hint="Missing information, unusual requests, errors, escalations"
              options={[
                ["", "Select…"],
                ...Array.from(
                  { length: 11 },
                  (_, n) => [String(n), `${n} of 10`] as [string, string],
                ),
              ]}
              value={input.exceptionsOutOf10 === null ? "" : String(input.exceptionsOutOf10)}
              onChange={(v) => patch({ exceptionsOutOf10: v === "" ? null : Number(v) })}
            />

            <fieldset className="space-y-3">
              <legend className="text-sm font-semibold">Common exceptions</legend>
              <p className="-mt-1 text-xs text-ink-muted">
                What goes wrong and how it is resolved. This becomes the agent's escalation policy.
              </p>
              {input.exceptions.map((ex, i) => (
                <div
                  // biome-ignore lint/suspicious/noArrayIndexKey: exceptions have no id
                  key={i}
                  className="grid gap-3 rounded-xl border border-line p-4 md:grid-cols-[1fr_1fr_180px_auto]"
                >
                  <TextInput
                    label="What happens"
                    value={ex.what}
                    maxLength={140}
                    placeholder="e.g. No purchase order number"
                    onChange={(what) =>
                      patch({
                        exceptions: input.exceptions.map((x, j) => (j === i ? { ...x, what } : x)),
                      })
                    }
                  />
                  <TextInput
                    label="How it is handled"
                    value={ex.handling}
                    maxLength={140}
                    placeholder="e.g. Email the supplier and wait"
                    onChange={(handling) =>
                      patch({
                        exceptions: input.exceptions.map((x, j) =>
                          j === i ? { ...x, handling } : x,
                        ),
                      })
                    }
                  />
                  <Select
                    label="At step"
                    options={[
                      ["", "Any step"],
                      ...namedSteps.map(
                        (s, n) => [s.id, `${n + 1}. ${s.name}`.slice(0, 40)] as [string, string],
                      ),
                    ]}
                    value={ex.stepId ?? ""}
                    onChange={(v) =>
                      patch({
                        exceptions: input.exceptions.map((x, j) =>
                          j === i ? { ...x, stepId: v || null } : x,
                        ),
                      })
                    }
                  />
                  <button
                    type="button"
                    onClick={() =>
                      patch({ exceptions: input.exceptions.filter((_, j) => j !== i) })
                    }
                    className="self-end px-2 py-2 text-sm text-ink-muted hover:text-node-output"
                  >
                    Remove
                  </button>
                </div>
              ))}
              {input.exceptions.length < 6 && (
                <button
                  type="button"
                  onClick={() =>
                    patch({
                      exceptions: [...input.exceptions, { stepId: null, what: "", handling: "" }],
                    })
                  }
                  className={secondary}
                >
                  + Add exception
                </button>
              )}
            </fieldset>

            <CheckGroup
              legend="Where is time lost today?"
              hint="Select all that apply"
              options={PAINS}
              value={input.painTags}
              onChange={(painTags) => patch({ painTags })}
            />
          </div>
        )}

        {section === "context" && (
          <div className="space-y-8">
            <fieldset className="space-y-4 rounded-xl border border-line p-5">
              <legend className="px-1 text-sm font-semibold">Cost of time</legend>
              <div className="grid gap-5 sm:grid-cols-[1fr_140px]">
                <NumberField
                  label="Hourly wage of the people doing this work"
                  hint="Gross wage. Employer costs (×1.3) are added in the business case."
                  value={input.hourlyWage}
                  onChange={(hourlyWage) => patch({ hourlyWage })}
                  max={1000}
                  suffix="per hour"
                />
                <Select
                  label="Currency"
                  options={CURRENCIES}
                  value={input.currency}
                  onChange={(currency) => patch({ currency })}
                />
              </div>
            </fieldset>
            <div className="grid gap-5 md:grid-cols-2">
              <Select
                label="Changes expected in the next 6 months"
                hint="New software, rules or team changes"
                options={CHANGES}
                value={input.changeExpected}
                onChange={(changeExpected) => patch({ changeExpected })}
              />
              <Select
                label="How the procedure is documented"
                options={DOCS}
                value={input.documentation}
                onChange={(documentation) => patch({ documentation })}
              />
            </div>
          </div>
        )}

        {section === "report" && report && analysis && (
          <AssessmentReport
            headingRef={headingRef}
            input={cleaned}
            analysis={analysis}
            report={report}
            agent={agent}
            onEdit={() => goTo("steps")}
          />
        )}

        {section !== "report" && (
          <div className="mt-10 space-y-4 border-t border-line pt-6 print:hidden">
            {section === "context" && missing.length > 0 && (
              <div className="rounded-lg border border-line p-4 text-sm">
                <p className="font-semibold">
                  {ready
                    ? "You can generate the assessment now. These would make it more accurate:"
                    : "Needed before the assessment:"}
                </p>
                <ul className="mt-2 space-y-1">
                  {missing.map(([key, label]) => (
                    <li key={label}>
                      <button
                        type="button"
                        onClick={() => goTo(key)}
                        className="text-ember underline-offset-4 hover:underline"
                      >
                        {label}
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            <div className="flex items-center justify-between gap-3">
              {index > 0 ? (
                <button
                  type="button"
                  onClick={() => goTo(SECTIONS[index - 1]?.key ?? "scope")}
                  className={secondary}
                >
                  ← {SECTIONS[index - 1]?.title}
                </button>
              ) : (
                <span />
              )}
              {section === "context" ? (
                <button
                  type="button"
                  disabled={!ready}
                  onClick={() => goTo("report")}
                  className={primary}
                >
                  Generate assessment
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => goTo(SECTIONS[index + 1]?.key ?? "report")}
                  className={primary}
                >
                  {SECTIONS[index + 1]?.title} →
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
