"use client";

import {
  type Answer,
  type Answers,
  PILLAR_INFO,
  PILLARS,
  type Question,
  scoreAssessment,
} from "@wyrm/assessment";
import { useEffect, useMemo, useRef, useState } from "react";
import { primaryButton, secondaryButton } from "./buttons";
import { ScanResults } from "./scan-results";

const CHOICES: { value: Answer; label: string }[] = [
  { value: "in_place", label: "Yes" },
  { value: "partial", label: "Partly" },
  { value: "gap", label: "No / not sure" },
  { value: "not_applicable", label: "Doesn't apply" },
];

/** The scan flow: intro, one step per area, then results. Answers stay in the browser. */
export function ScanApp({ questions }: { questions: readonly Question[] }) {
  const steps = useMemo(
    () =>
      PILLARS.map((pillar) => ({
        pillar,
        questions: questions.filter((q) => q.pillar === pillar),
      })).filter((step) => step.questions.length > 0),
    [questions],
  );

  // -1 = intro, 0..steps.length-1 = areas, steps.length = results
  const [stepIndex, setStepIndex] = useState(-1);
  const [answers, setAnswers] = useState<Answers>({});
  const headingRef = useRef<HTMLHeadingElement>(null);

  // Move focus to the new step's heading so keyboard and screen-reader users follow along.
  useEffect(() => {
    if (stepIndex >= 0) {
      headingRef.current?.focus();
      headingRef.current?.scrollIntoView({ block: "start" });
    }
  }, [stepIndex]);

  const isResults = stepIndex >= steps.length;
  const result = useMemo(() => scoreAssessment(questions, answers), [questions, answers]);

  if (stepIndex === -1) {
    return (
      <div className="rounded-3xl border border-line bg-paper-raised p-6 sm:p-10">
        <h2 className="font-display text-2xl font-semibold">How it works</h2>
        <ul className="mt-4 space-y-2 text-ink-muted">
          <li>
            {questions.length} yes-or-no style questions in {steps.length} short areas, about 4
            minutes.
          </li>
          <li>No sign-up. Your answers stay in your browser.</li>
          <li>Unsure about something? Choose "No / not sure": it counts as a gap.</li>
        </ul>
        <button type="button" className={`${primaryButton} mt-8`} onClick={() => setStepIndex(0)}>
          Start the scan
        </button>
      </div>
    );
  }

  if (isResults) {
    return (
      <ScanResults
        result={result}
        answers={answers}
        headingRef={headingRef}
        onRestart={() => {
          setAnswers({});
          setStepIndex(-1);
        }}
      />
    );
  }

  const step = steps[stepIndex];
  if (!step) return null;
  const stepComplete = step.questions.every((q) => answers[q.id] !== undefined);
  const info = PILLAR_INFO[step.pillar];

  return (
    <div>
      <div className="flex items-center justify-between gap-4 text-sm text-ink-muted">
        <span>
          Area {stepIndex + 1} of {steps.length}
        </span>
        <span>{Object.keys(answers).length} answered</span>
      </div>
      <div
        className="mt-2 h-2 overflow-hidden rounded-full bg-line"
        role="progressbar"
        aria-label="Scan progress"
        aria-valuemin={0}
        aria-valuemax={steps.length}
        aria-valuenow={stepIndex}
      >
        <div
          className="h-full rounded-full bg-ember transition-[width]"
          style={{ width: `${(stepIndex / steps.length) * 100}%` }}
        />
      </div>

      <h2
        ref={headingRef}
        tabIndex={-1}
        className="mt-8 scroll-mt-24 font-display text-3xl font-semibold outline-none"
      >
        {info.label}
      </h2>
      <p className="mt-2 text-ink-muted">{info.intro}</p>

      <ol className="mt-8 space-y-6">
        {step.questions.map((question, index) => (
          <li key={question.id}>
            <fieldset className="rounded-2xl border border-line bg-paper-raised p-5">
              <legend className="sr-only">Question {index + 1}</legend>
              <p className="font-medium">{question.prompt}</p>
              <div className="mt-4 flex flex-wrap gap-2">
                {CHOICES.map((choice) => (
                  <label
                    key={choice.value}
                    className="cursor-pointer rounded-full border border-line px-4 py-2 text-sm has-checked:border-ember has-checked:bg-ember has-checked:text-paper has-focus-visible:outline-2 has-focus-visible:outline-offset-2 has-focus-visible:outline-ember"
                  >
                    <input
                      type="radio"
                      className="sr-only"
                      name={question.id}
                      value={choice.value}
                      checked={answers[question.id] === choice.value}
                      onChange={() =>
                        setAnswers((prev) => ({ ...prev, [question.id]: choice.value }))
                      }
                    />
                    {choice.label}
                  </label>
                ))}
              </div>
            </fieldset>
          </li>
        ))}
      </ol>

      <div className="mt-8 flex flex-wrap items-center justify-between gap-3">
        <button
          type="button"
          className={secondaryButton}
          onClick={() => setStepIndex((i) => i - 1)}
        >
          Back
        </button>
        <button
          type="button"
          className={primaryButton}
          disabled={!stepComplete}
          onClick={() => setStepIndex((i) => i + 1)}
        >
          {stepIndex === steps.length - 1 ? "See my results" : "Next area"}
        </button>
      </div>
      {!stepComplete && (
        <p className="mt-3 text-right text-sm text-ink-muted">Answer every question to continue.</p>
      )}
    </div>
  );
}
