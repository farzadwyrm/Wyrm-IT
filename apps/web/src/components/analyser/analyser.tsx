"use client";

import {
  analyseWorkflow,
  type ExceptionCase,
  itemsPerWeek,
  MAX_STEPS,
  matchAgent,
  type StepInput,
  stepFromDraft,
  type WorkflowInput,
} from "@wyrm/agents";
import { useEffect, useId, useMemo, useRef, useState } from "react";
import type { StepsRequest, StepsResponse } from "@/lib/analyse-api";
import { Choice, Multi, NumberInput, Question, Select, TextArea } from "./fields";
import { CHANGES, DOCS, EXAMPLE_WALKTHROUGH, PAINS, RECIPIENTS, TRIGGERS } from "./options";
import { AnalysisResult } from "./result";
import { StepCard } from "./step-card";

const STAGES = [
  "Scope",
  "Volume",
  "Walk-through",
  "Steps",
  "Exceptions",
  "Value",
  "Result",
] as const;
const STORAGE_KEY = "wyrm-analyser-v1";

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
  documentation: "nothing",
  hourlyWage: null,
  currency: "EUR",
  painTags: [],
  steps: [],
};

interface Saved {
  stage: number;
  input: WorkflowInput;
  walkthrough: string;
}

function load(): Saved | null {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as Saved) : null;
  } catch {
    return null;
  }
}

function save(value: Saved | null) {
  try {
    if (value) window.localStorage.setItem(STORAGE_KEY, JSON.stringify(value));
    else window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    // Private mode or blocked storage: the analyser still works, it just won't remember.
  }
}

let nextId = 0;
const newId = () => `s${Date.now().toString(36)}${nextId++}`;

/**
 * The workflow analyser: a short interview about one workflow (scope, volume, a walk-through
 * of the last real case, per-step details, exceptions, value), then a per-step verdict, risk
 * tier, agent design and savings range. Method: docs/research/reports/AI agent workflow
 * analysis method.md. Answers stay in the browser; only the walk-through text is sent to the
 * server to draft the steps.
 */
export function WorkflowAnalyser() {
  const [stage, setStage] = useState(0);
  const [input, setInput] = useState<WorkflowInput>(EMPTY);
  const [walkthrough, setWalkthrough] = useState("");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [restored, setRestored] = useState(false);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const nameId = useId();
  const sourceId = useId();

  // Restore a saved draft, or take a task from the home page (?q=).
  useEffect(() => {
    const saved = load();
    const q = new URLSearchParams(window.location.search).get("q")?.slice(0, 120);
    if (q) {
      setInput({ ...EMPTY, name: q });
    } else if (saved) {
      setStage(Math.min(saved.stage, STAGES.length - 1));
      setInput(saved.input);
      setWalkthrough(saved.walkthrough);
    }
    setRestored(true);
  }, []);

  useEffect(() => {
    if (restored) save({ stage, input, walkthrough });
  }, [restored, stage, input, walkthrough]);

  const patch = (p: Partial<WorkflowInput>) => setInput((prev) => ({ ...prev, ...p }));
  const go = (n: number) => {
    setNotice(null);
    setStage(n);
    requestAnimationFrame(() => headingRef.current?.focus());
  };

  const analysis = useMemo(
    () => (stage === STAGES.length - 1 && input.steps.length > 0 ? analyseWorkflow(input) : null),
    [stage, input],
  );
  const agent = useMemo(
    () => matchAgent(`${input.name} ${input.outcome} ${walkthrough}`),
    [input.name, input.outcome, walkthrough],
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
          outcome: input.outcome,
          trigger: TRIGGERS.find(([t]) => t === input.triggerType)?.[1] ?? "",
        } satisfies StepsRequest),
      });
      data = (await response.json()) as StepsResponse;
    } catch {
      data = { status: "error" };
    }
    setBusy(false);
    if (data.status !== "ok") {
      setNotice("We couldn't map those steps. Write one step per line and try again.");
      return;
    }
    patch({ steps: data.steps.map((d) => stepFromDraft(d, newId())) });
    if (data.provider === "text") {
      setNotice("Mapped from your text without AI. Check each step carefully.");
    }
    setStage(3);
    requestAnimationFrame(() => headingRef.current?.focus());
  }

  const updateStep = (i: number, s: StepInput) =>
    patch({ steps: input.steps.map((x, j) => (j === i ? s : x)) });
  const moveStep = (i: number, d: -1 | 1) => {
    const steps = [...input.steps];
    const [s] = steps.splice(i, 1);
    if (s) steps.splice(i + d, 0, s);
    patch({ steps });
  };
  const setException = (i: number, e: ExceptionCase) =>
    patch({ exceptions: input.exceptions.map((x, j) => (j === i ? e : x)) });

  // Required answers per stage (research report, section 1).
  const missing: string | null = (() => {
    switch (stage) {
      case 0:
        if (input.name.trim().length < 3) return "Name the task.";
        if (input.outcome.trim().length < 3) return "Say what you have when it's done.";
        if (input.recipients.length === 0) return "Choose who receives the result.";
        return null;
      case 1:
        if (input.volumeCount === null) return "Give a rough number, a guess is fine.";
        if (input.weekKind !== "normal" && input.typicalPerWeek === null)
          return "About how many in a normal week?";
        return null;
      case 2:
        return walkthrough.trim().split(/\s+/).length < 8
          ? "Describe the steps in a few sentences."
          : null;
      case 3:
        if (input.steps.length < 2) return "Add at least two steps.";
        if (input.steps.some((s) => !s.name.trim())) return "Every step needs a name.";
        return null;
      case 4:
        return input.exceptionsOutOf10 === null
          ? "Out of 10, how many didn't go the normal way?"
          : null;
      default:
        return null;
    }
  })();

  const perWeek = itemsPerWeek(input);
  const minutesPerItem = input.steps.reduce((sum, s) => sum + (s.touchMinutes ?? 0), 0);

  return (
    <div>
      <ol className="flex flex-wrap gap-x-4 gap-y-2 font-mono text-xs" aria-label="Progress">
        {STAGES.map((name, i) => (
          <li
            key={name}
            aria-current={i === stage ? "step" : undefined}
            className={i === stage ? "text-signal" : i < stage ? "text-ink" : "text-ink-muted/60"}
          >
            {String(i + 1).padStart(2, "0")} {name}
          </li>
        ))}
      </ol>

      <div className="mt-6 rounded-3xl border border-line bg-paper/60 p-5 sm:p-8">
        <h2
          ref={headingRef}
          tabIndex={-1}
          className="font-display text-2xl font-semibold tracking-tight outline-none"
        >
          {
            [
              "Which workflow, and where does it start and end?",
              "How often does it happen?",
              "Walk us through the last time",
              "Check the steps",
              "When it doesn't go to plan",
              "What it's worth",
              "Your workflow analysis",
            ][stage]
          }
        </h2>

        <div className="mt-6 space-y-8">
          {stage === 0 && (
            <>
              <div className="space-y-2">
                <label htmlFor={nameId} className="font-semibold">
                  What is the task?
                </label>
                <input
                  id={nameId}
                  value={input.name}
                  maxLength={120}
                  placeholder="e.g. Entering supplier invoices"
                  onChange={(e) => patch({ name: e.target.value })}
                  className="w-full rounded-xl border border-line bg-paper px-4 py-3 outline-none focus-visible:border-ember"
                />
              </div>
              <Question title="What do you have when it's done?">
                <TextArea
                  label="What you have when it's done"
                  value={input.outcome}
                  onChange={(outcome) => patch({ outcome })}
                  rows={2}
                  placeholder="e.g. The invoice is in Xero and scheduled for payment"
                  maxLength={300}
                />
              </Question>
              <Question title="What starts it?">
                <Choice
                  name="trigger"
                  options={TRIGGERS}
                  value={input.triggerType}
                  onChange={(triggerType) => patch({ triggerType })}
                />
                <div>
                  <label htmlFor={sourceId} className="sr-only">
                    Who or what sends it
                  </label>
                  <input
                    id={sourceId}
                    value={input.triggerSource}
                    maxLength={80}
                    placeholder="Who or what sends it? (optional)"
                    onChange={(e) => patch({ triggerSource: e.target.value })}
                    className="w-full max-w-md rounded-lg border border-line bg-paper px-3 py-2 text-sm outline-none focus-visible:border-ember"
                  />
                </div>
              </Question>
              <Question title="Who receives the result?">
                <Multi
                  options={RECIPIENTS}
                  value={input.recipients}
                  onChange={(recipients) => patch({ recipients })}
                />
              </Question>
            </>
          )}

          {stage === 1 && (
            <>
              <Question
                title="Roughly how many did you handle last week?"
                hint="A rough guess is fine. If it's rare, switch to last month."
              >
                <div className="flex flex-wrap items-center gap-3">
                  <NumberInput
                    label="How many"
                    value={input.volumeCount}
                    onChange={(volumeCount) => patch({ volumeCount })}
                  />
                  <Choice
                    name="period"
                    options={[
                      ["week", "last week"],
                      ["month", "last month"],
                    ]}
                    value={input.volumePeriod}
                    onChange={(volumePeriod) => patch({ volumePeriod })}
                  />
                </div>
              </Question>
              <Question title={`Was that a normal ${input.volumePeriod}?`}>
                <Choice
                  name="weekKind"
                  options={[
                    ["normal", "Normal"],
                    ["busy", "Busy"],
                    ["quiet", "Quiet"],
                  ]}
                  value={input.weekKind}
                  onChange={(weekKind) => patch({ weekKind })}
                />
                {input.weekKind !== "normal" && (
                  <NumberInput
                    label="How many in a normal week"
                    value={input.typicalPerWeek}
                    onChange={(typicalPerWeek) => patch({ typicalPerWeek })}
                    suffix="in a normal week"
                  />
                )}
              </Question>
              <Question title="What made you want to look at this one now?" hint="Optional.">
                <TextArea
                  label="Why now"
                  value={input.whyNow}
                  onChange={(whyNow) => patch({ whyNow })}
                  rows={2}
                  maxLength={300}
                />
              </Question>
            </>
          )}

          {stage === 2 && (
            <Question
              title="Think of the last one you handled that went normally. What did you do, step by step?"
              hint="Say where the information came from and which app you were in. One step per line works best. Please no names or customer details."
            >
              <TextArea
                label="Walk-through of the last time"
                value={walkthrough}
                onChange={setWalkthrough}
                rows={7}
                maxLength={3000}
                placeholder={"First I…\nThen I…"}
              />
              {!walkthrough && (
                <button
                  type="button"
                  onClick={() => setWalkthrough(EXAMPLE_WALKTHROUGH)}
                  className="text-sm font-semibold text-ember hover:text-ember-strong"
                >
                  Use an example
                </button>
              )}
            </Question>
          )}

          {stage === 3 && (
            <>
              <p className="text-ink-muted">
                Here are the steps we heard. Correct anything that's wrong, and add your rough time
                for each.
              </p>
              <ol className="space-y-4">
                {input.steps.map((step, i) => (
                  <StepCard
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
              {input.steps.length < MAX_STEPS && (
                <button
                  type="button"
                  onClick={() =>
                    patch({
                      steps: [
                        ...input.steps,
                        stepFromDraft(
                          {
                            name: "New step",
                            actorType: "owner",
                            tools: [],
                            inputFormat: "system_fields",
                            rekeying: false,
                            decisionType: "none",
                            impactFlags: [],
                          },
                          newId(),
                        ),
                      ],
                    })
                  }
                  className="rounded-lg border border-dashed border-line px-4 py-2 text-sm hover:border-ink-muted"
                >
                  + Add a step
                </button>
              )}
              <p className="font-mono text-sm text-ink-muted" aria-live="polite">
                {minutesPerItem} min per item ×{" "}
                {perWeek === null ? "?" : Math.round(perWeek * 10) / 10} a week ≈{" "}
                <span className="text-ink">
                  {perWeek === null ? "?" : Math.round((minutesPerItem * perWeek) / 6) / 10} hours a
                  week
                </span>
              </p>
            </>
          )}

          {stage === 4 && (
            <>
              <Question title="Out of your last 10, how many didn't go the normal way?">
                <NumberInput
                  label="Exceptions out of 10"
                  value={input.exceptionsOutOf10}
                  onChange={(exceptionsOutOf10) => patch({ exceptionsOutOf10 })}
                  suffix="out of 10"
                  max={10}
                />
              </Question>
              {(input.exceptionsOutOf10 ?? 0) > 0 && (
                <Question
                  title="What happened, at which step, and what did you do?"
                  hint="Add the most common ones."
                >
                  <ul className="space-y-3">
                    {input.exceptions.map((e, i) => (
                      <li
                        // biome-ignore lint/suspicious/noArrayIndexKey: editable list in place
                        key={i}
                        className="grid gap-2 rounded-xl border border-line p-3 sm:grid-cols-[1fr_1fr_12rem_auto]"
                      >
                        <input
                          aria-label={`Exception ${i + 1}: what happened`}
                          value={e.what}
                          maxLength={120}
                          placeholder="What went wrong"
                          onChange={(ev) => setException(i, { ...e, what: ev.target.value })}
                          className="rounded-lg border border-line bg-paper px-3 py-2 text-sm outline-none focus-visible:border-ember"
                        />
                        <input
                          aria-label={`Exception ${i + 1}: what you did`}
                          value={e.handling}
                          maxLength={120}
                          placeholder="What you did"
                          onChange={(ev) => setException(i, { ...e, handling: ev.target.value })}
                          className="rounded-lg border border-line bg-paper px-3 py-2 text-sm outline-none focus-visible:border-ember"
                        />
                        <Select
                          label="At step"
                          options={[
                            ["", "Not sure"] as [string, string],
                            ...input.steps.map((s) => [s.id, s.name] as [string, string]),
                          ]}
                          value={e.stepId ?? ""}
                          onChange={(v) => setException(i, { ...e, stepId: v || null })}
                        />
                        <button
                          type="button"
                          aria-label={`Remove exception ${i + 1}`}
                          onClick={() =>
                            patch({ exceptions: input.exceptions.filter((_, j) => j !== i) })
                          }
                          className="self-end rounded-md border border-line px-2 py-2 text-xs"
                        >
                          ✕
                        </button>
                      </li>
                    ))}
                  </ul>
                  {input.exceptions.length < 5 && (
                    <button
                      type="button"
                      onClick={() =>
                        patch({
                          exceptions: [
                            ...input.exceptions,
                            { stepId: null, what: "", handling: "" },
                          ],
                        })
                      }
                      className="rounded-lg border border-dashed border-line px-4 py-2 text-sm hover:border-ink-muted"
                    >
                      + Add an exception
                    </button>
                  )}
                </Question>
              )}
              <Question
                title="Is this task likely to change in the next 6 months?"
                hint="E.g. new software, prices or rules."
              >
                <Choice
                  name="change"
                  options={CHANGES}
                  value={input.changeExpected}
                  onChange={(changeExpected) => patch({ changeExpected })}
                />
              </Question>
              <Question title="Is it written down anywhere?">
                <Choice
                  name="docs"
                  options={DOCS}
                  value={input.documentation}
                  onChange={(documentation) => patch({ documentation })}
                />
              </Question>
            </>
          )}

          {stage === 5 && (
            <>
              <Question
                title="Roughly what does an hour of the person doing most of this cost you?"
                hint="Wage, or what your own hour is worth. Optional: without it we show hours only."
              >
                <div className="flex flex-wrap items-center gap-3">
                  <NumberInput
                    label="Hourly cost"
                    value={input.hourlyWage}
                    onChange={(hourlyWage) => patch({ hourlyWage })}
                    max={1000}
                  />
                  <Select
                    label="Currency"
                    options={[
                      ["EUR", "EUR"],
                      ["GBP", "GBP"],
                      ["USD", "USD"],
                    ]}
                    value={input.currency}
                    onChange={(currency) => patch({ currency })}
                  />
                </div>
              </Question>
              <Question title="What's most annoying about it?" hint="Optional.">
                <Multi
                  options={PAINS}
                  value={input.painTags}
                  onChange={(painTags) => patch({ painTags })}
                />
              </Question>
            </>
          )}

          {stage === 6 && analysis && (
            <AnalysisResult input={input} analysis={analysis} agent={agent} onEdit={() => go(3)} />
          )}
        </div>

        {notice && (
          <p
            role="status"
            className="mt-6 rounded-xl border border-line bg-paper-raised p-3 text-sm text-ink-muted"
          >
            {notice}
          </p>
        )}

        {stage < 6 && (
          <div className="mt-8 flex flex-wrap items-center justify-between gap-3 border-t border-line pt-6">
            <div className="flex gap-3">
              {stage > 0 && (
                <button
                  type="button"
                  onClick={() => go(stage - 1)}
                  className="rounded-lg border border-line px-4 py-2 text-sm hover:border-ink-muted"
                >
                  Back
                </button>
              )}
              <button
                type="button"
                onClick={() => {
                  setInput(EMPTY);
                  setWalkthrough("");
                  go(0);
                }}
                className="px-2 py-2 text-sm text-ink-muted hover:text-ink"
              >
                Start over
              </button>
            </div>
            <div className="flex items-center gap-3">
              {missing && <p className="text-sm text-ink-muted">{missing}</p>}
              <button
                type="button"
                disabled={Boolean(missing) || busy}
                onClick={() => (stage === 2 ? void draftSteps() : go(stage + 1))}
                className="rounded-lg bg-ember px-5 py-2.5 text-sm font-semibold text-paper hover:bg-ember-strong disabled:opacity-40"
              >
                {busy
                  ? "Mapping steps…"
                  : stage === 2
                    ? "Map my steps"
                    : stage === 5
                      ? "Analyse"
                      : "Next"}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
