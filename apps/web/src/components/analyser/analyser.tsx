"use client";

import {
  analyseWorkflow,
  MAX_STEPS,
  matchAgent,
  type StepInput,
  stepFromDraft,
  type TriggerType,
  type WorkflowInput,
} from "@wyrm/agents";
import { type ReactNode, useEffect, useId, useMemo, useRef, useState } from "react";
import type { StepsRequest, StepsResponse } from "@/lib/analyse-api";
import { EXAMPLE_WALKTHROUGH } from "./options";
import { AnalysisResult } from "./result";
import { StepRow } from "./step-card";

const STORAGE_KEY = "wyrm-analyser-v2";
const QUESTIONS = 6;
const RESULT = 6;

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

const TASK_EXAMPLES = [
  "Entering supplier invoices",
  "Answering customer emails",
  "Booking appointments",
  "Following up new leads",
];

const STARTS: [TriggerType, string][] = [
  ["email", "An email"],
  ["call", "A phone call"],
  ["web_form", "A web form or booking"],
  ["chat", "A chat or WhatsApp"],
  ["paper", "Paper or post"],
  ["schedule", "A fixed time, e.g. every Monday"],
  ["manual", "We just start it"],
];

const PER_WEEK = [5, 20, 50, 100];

const OFF_PLAN: [number, string][] = [
  [1, "Almost never (0–1)"],
  [2, "Sometimes (2–3)"],
  [4, "Often (4–5)"],
  [7, "Most of the time"],
];

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

function save(value: Saved) {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(value));
  } catch {
    // Private mode or blocked storage: the analyser still works, it just won't remember.
  }
}

let nextId = 0;
const newId = () => `s${Date.now().toString(36)}${nextId++}`;

const bigChoice =
  "rounded-xl border border-line bg-paper-raised/80 px-4 py-3 text-left transition-colors hover:border-ember/60 aria-pressed:border-ember aria-pressed:bg-ember/10";

/**
 * The workflow analyser: six short questions, one per screen, then a plain-language result.
 * The method (research report in docs/research) runs underneath: walk-through of the last
 * case, minutes per step, exceptions, deterministic scoring capped by risk. Answers stay in
 * the browser; only the walk-through text is sent to draft the steps.
 */
export function WorkflowAnalyser() {
  const [stage, setStage] = useState(0);
  const [input, setInput] = useState<WorkflowInput>(EMPTY);
  const [walkthrough, setWalkthrough] = useState("");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [restored, setRestored] = useState(false);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const fieldId = useId();

  useEffect(() => {
    const saved = load();
    const q = new URLSearchParams(window.location.search).get("q")?.slice(0, 120);
    if (q) setInput({ ...EMPTY, name: q });
    else if (saved) {
      setStage(Math.min(saved.stage, RESULT));
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
    () => (stage === RESULT && input.steps.length > 0 ? analyseWorkflow(input) : null),
    [stage, input],
  );
  const agent = useMemo(
    () => matchAgent(`${input.name} ${walkthrough}`),
    [input.name, walkthrough],
  );

  async function mapSteps() {
    setBusy(true);
    setNotice(null);
    let data: StepsResponse;
    try {
      const response = await fetch("/api/analyse/steps", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          walkthrough,
          outcome: input.name,
          trigger: STARTS.find(([t]) => t === input.triggerType)?.[1] ?? "",
        } satisfies StepsRequest),
      });
      data = (await response.json()) as StepsResponse;
    } catch {
      data = { status: "error" };
    }
    setBusy(false);
    if (data.status !== "ok") {
      setNotice("We couldn't read the steps. Try writing one step per line.");
      return;
    }
    patch({ steps: data.steps.map((d) => stepFromDraft(d, newId())) });
    go(4);
  }

  const updateStep = (i: number, s: StepInput) =>
    patch({ steps: input.steps.map((x, j) => (j === i ? s : x)) });

  const canContinue = [
    input.name.trim().length >= 3,
    true,
    input.volumeCount !== null && input.volumeCount > 0,
    walkthrough.trim().split(/\s+/).length >= 8,
    input.steps.length >= 2 && input.steps.every((s) => s.name.trim()),
    input.exceptionsOutOf10 !== null,
  ][stage];

  const titles: ReactNode[] = [
    "Which task takes up too much of your team's time?",
    "How does it usually start?",
    "About how many times a week does it happen?",
    "Describe the last time you did it, step by step.",
    "Here are your steps. Roughly how many minutes does each one take?",
    "Out of 10 times, how often does it not go to plan?",
    "Your result",
  ];

  const pick = (fn: () => void) => () => {
    fn();
    setTimeout(() => go(stage + 1), 120);
  };

  return (
    <div className="mx-auto max-w-3xl">
      {stage < RESULT && (
        <div className="mb-8">
          <div className="flex items-center justify-between font-mono text-xs text-ink-muted">
            <span>
              Question {stage + 1} of {QUESTIONS}
            </span>
            <span>about 5 minutes</span>
          </div>
          <div className="mt-2 h-1 overflow-hidden rounded-full bg-line" aria-hidden="true">
            <div
              className="h-full rounded-full bg-ember transition-all"
              style={{ width: `${((stage + 1) / QUESTIONS) * 100}%` }}
            />
          </div>
        </div>
      )}

      <h2
        ref={headingRef}
        tabIndex={-1}
        className="font-display text-2xl font-semibold tracking-tight text-balance outline-none sm:text-3xl"
      >
        {titles[stage]}
      </h2>

      <div className="mt-6">
        {stage === 0 && (
          <div className="space-y-4">
            <label htmlFor={fieldId} className="sr-only">
              The task
            </label>
            <input
              id={fieldId}
              value={input.name}
              maxLength={120}
              placeholder="e.g. Entering supplier invoices"
              onChange={(e) => patch({ name: e.target.value })}
              onKeyDown={(e) => {
                if (e.key === "Enter" && canContinue) go(1);
              }}
              className="w-full rounded-xl border border-line bg-paper px-4 py-4 text-lg outline-none focus-visible:border-ember"
            />
            <div className="flex flex-wrap gap-2">
              {TASK_EXAMPLES.map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => patch({ name: t })}
                  className="rounded-full border border-line px-3 py-1.5 text-sm text-ink-muted hover:border-ember/60 hover:text-ink"
                >
                  {t}
                </button>
              ))}
            </div>
          </div>
        )}

        {stage === 1 && (
          <div className="grid gap-2 sm:grid-cols-2">
            {STARTS.map(([value, label]) => (
              <button
                key={value}
                type="button"
                aria-pressed={input.triggerType === value}
                onClick={pick(() => patch({ triggerType: value }))}
                className={bigChoice}
              >
                {label}
              </button>
            ))}
          </div>
        )}

        {stage === 2 && (
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <label htmlFor={fieldId} className="sr-only">
                Times a week
              </label>
              <input
                id={fieldId}
                type="number"
                inputMode="numeric"
                min={1}
                max={100000}
                value={input.volumeCount ?? ""}
                placeholder="?"
                onChange={(e) =>
                  patch({
                    volumeCount: e.target.value === "" ? null : Math.max(0, Number(e.target.value)),
                  })
                }
                className="w-32 rounded-xl border border-line bg-paper px-4 py-4 text-lg outline-none focus-visible:border-ember"
              />
              <span className="text-ink-muted">times a week</span>
            </div>
            <div className="flex flex-wrap gap-2">
              {PER_WEEK.map((n) => (
                <button
                  key={n}
                  type="button"
                  aria-pressed={input.volumeCount === n}
                  onClick={pick(() => patch({ volumeCount: n }))}
                  className={bigChoice}
                >
                  about {n}
                </button>
              ))}
            </div>
            <p className="text-sm text-ink-muted">A rough guess is fine.</p>
          </div>
        )}

        {stage === 3 && (
          <div className="space-y-3">
            <label htmlFor={fieldId} className="sr-only">
              The last time, step by step
            </label>
            <textarea
              id={fieldId}
              rows={7}
              maxLength={3000}
              value={walkthrough}
              placeholder={"First I…\nThen I…\nThen…"}
              onChange={(e) => setWalkthrough(e.target.value)}
              className="w-full rounded-xl border border-line bg-paper px-4 py-3 text-lg outline-none placeholder:text-ink-muted/60 focus-visible:border-ember"
            />
            <div className="flex flex-wrap items-center justify-between gap-2 text-sm text-ink-muted">
              <span>Say which app or paper you used. No names or customer details, please.</span>
              {!walkthrough && (
                <button
                  type="button"
                  onClick={() => setWalkthrough(EXAMPLE_WALKTHROUGH)}
                  className="font-semibold text-ember hover:text-ember-strong"
                >
                  Show me an example
                </button>
              )}
            </div>
          </div>
        )}

        {stage === 4 && (
          <div className="space-y-3">
            <ol className="space-y-2">
              {input.steps.map((step, i) => (
                <StepRow
                  key={step.id}
                  step={step}
                  index={i}
                  onChange={(s) => updateStep(i, s)}
                  onRemove={() => patch({ steps: input.steps.filter((_, j) => j !== i) })}
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
                          name: "",
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
                className="text-sm font-semibold text-ember hover:text-ember-strong"
              >
                + Add a missing step
              </button>
            )}
            <p className="text-sm text-ink-muted">
              Not sure? Leave it blank and we'll use a typical value.
            </p>
          </div>
        )}

        {stage === 5 && (
          <div className="space-y-6">
            <div className="grid gap-2 sm:grid-cols-2">
              {OFF_PLAN.map(([value, label]) => (
                <button
                  key={value}
                  type="button"
                  aria-pressed={input.exceptionsOutOf10 === value}
                  onClick={() => patch({ exceptionsOutOf10: value })}
                  className={bigChoice}
                >
                  {label}
                </button>
              ))}
            </div>
            <div className="space-y-2">
              <p className="font-semibold">Optional: what does an hour of this work cost you?</p>
              <div className="flex items-center gap-2">
                <span className="text-ink-muted">€</span>
                <label htmlFor={fieldId} className="sr-only">
                  Cost per hour in euros
                </label>
                <input
                  id={fieldId}
                  type="number"
                  inputMode="decimal"
                  min={0}
                  max={1000}
                  value={input.hourlyWage ?? ""}
                  placeholder="e.g. 30"
                  onChange={(e) =>
                    patch({
                      hourlyWage:
                        e.target.value === "" ? null : Math.max(0, Number(e.target.value)),
                    })
                  }
                  className="w-28 rounded-xl border border-line bg-paper px-3 py-2 outline-none focus-visible:border-ember"
                />
                <span className="text-sm text-ink-muted">per hour</span>
              </div>
            </div>
          </div>
        )}

        {stage === RESULT && analysis && (
          <AnalysisResult
            input={input}
            analysis={analysis}
            agent={agent}
            onEdit={() => go(4)}
            onRestart={() => {
              setInput(EMPTY);
              setWalkthrough("");
              go(0);
            }}
          />
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

      {stage < RESULT && (
        <div className="mt-10 flex items-center justify-between gap-3">
          {stage > 0 ? (
            <button
              type="button"
              onClick={() => go(stage - 1)}
              className="rounded-lg px-3 py-2 text-sm text-ink-muted hover:text-ink"
            >
              ← Back
            </button>
          ) : (
            <span />
          )}
          <button
            type="button"
            disabled={!canContinue || busy}
            onClick={() => (stage === 3 ? void mapSteps() : go(stage + 1))}
            className="rounded-lg bg-ember px-6 py-3 font-semibold text-paper hover:bg-ember-strong disabled:opacity-40"
          >
            {busy ? "Reading your steps…" : stage === 5 ? "See my result" : "Next"}
          </button>
        </div>
      )}
    </div>
  );
}
