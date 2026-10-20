"use client";

import {
  type Agent,
  type Analysis,
  CLASS_LABELS,
  QUADRANT_LABELS,
  type StepClass,
  TIER_CONTROLS,
  TIER_LABELS,
  type Tier,
  type WorkflowInput,
} from "@wyrm/agents";
import { ButtonLink } from "@wyrm/ui";
import Link from "next/link";
import { WorkflowDiagram, WorkflowFacts } from "@/components/workflow-diagram";
import { PROVENANCE_LABEL } from "./options";

const CLASS_STYLE: Record<StepClass, string> = {
  automate: "border-node-trigger/50 text-node-trigger",
  agent_check: "border-node-agent/50 text-node-agent",
  assist: "border-node-tool/50 text-node-tool",
  human: "border-node-human/50 text-node-human",
};

const TIER_STYLE: Record<Tier, string> = {
  1: "text-ink-muted",
  2: "text-node-trigger",
  3: "text-node-tool",
  4: "text-node-output",
};

const fmt = (n: number) => (n >= 100 ? Math.round(n).toLocaleString("en") : String(n));

export function AnalysisResult({
  input,
  analysis,
  agent,
  onEdit,
}: {
  input: WorkflowInput;
  analysis: Analysis;
  agent: Agent | null;
  onEdit: () => void;
}) {
  const { savings, scores, gates } = analysis;
  const biggest = input.steps.find((s) => s.id === savings.biggestStepId);
  const counts = scores.reduce<Record<StepClass, number>>(
    (acc, s) => {
      if (!s.alreadyAutomated) acc[s.finalClass]++;
      return acc;
    },
    { automate: 0, agent_check: 0, assist: 0, human: 0 },
  );

  return (
    <div className="space-y-10">
      <section aria-labelledby="headline" className="grid gap-4 lg:grid-cols-[1.4fr_1fr]">
        <div className="rounded-3xl border border-ember/30 bg-paper-raised p-6 sm:p-8">
          <p className="font-mono text-xs uppercase tracking-wider text-signal">time released</p>
          <h2
            id="headline"
            className="mt-3 font-display text-4xl font-semibold tracking-tight sm:text-5xl"
          >
            {savings.savedHoursWeek.low}–{savings.savedHoursWeek.high} h
            <span className="text-2xl text-ink-muted"> a week</span>
          </h2>
          <p className="mt-2 text-ink-muted">
            Most likely about{" "}
            <strong className="text-ink">{savings.savedHoursWeek.base} hours a week</strong> (
            {fmt(savings.savedHoursYear.base)} a year) out of {fmt(savings.baselineHoursYear)} hours
            a year spent today.
          </p>
          {savings.valueYear && (
            <p className="mt-4 text-sm text-ink-muted">
              Value of that time: {input.currency} {fmt(savings.valueYear.low)}–
              {fmt(savings.valueYear.high)} a year. This is time freed up, not cash saved, unless
              you reduce paid hours, overtime or outsourcing.
            </p>
          )}
          {biggest && (
            <p className="mt-4 text-sm">
              <span className="font-mono text-xs text-ember">biggest driver </span>"{biggest.name}"
              {biggest.touchMinutes !== null &&
                ` (${biggest.touchMinutes} min × ${savings.itemsPerWeek ?? "?"} a week)`}
            </p>
          )}
        </div>
        <div className="rounded-3xl border border-line bg-paper-raised/80 p-6">
          <p className="font-mono text-xs uppercase tracking-wider text-ink-muted">your steps</p>
          <ul className="mt-4 space-y-2">
            {(Object.keys(counts) as StepClass[]).map((cls) => (
              <li key={cls} className="flex items-center justify-between gap-3">
                <span className={`rounded-md border px-2 py-0.5 text-sm ${CLASS_STYLE[cls]}`}>
                  {CLASS_LABELS[cls]}
                </span>
                <span className="font-mono">{counts[cls]}</span>
              </li>
            ))}
          </ul>
          <p className="mt-5 text-sm text-ink-muted">
            Highest risk:{" "}
            <span className={TIER_STYLE[analysis.maxTier]}>{TIER_LABELS[analysis.maxTier]}</span>.{" "}
            {TIER_CONTROLS[analysis.maxTier].humanCheck}
          </p>
        </div>
      </section>

      {(gates.defer || gates.fixFirst || savings.openQuestions.length > 0) && (
        <section aria-label="Before you automate" className="space-y-3">
          {gates.defer && (
            <p className="rounded-xl border border-node-tool/50 bg-node-tool/10 p-4 text-sm">
              <strong>Redesign first.</strong> You expect major changes in the next six months.
              Automating now would mean building twice, so we show today's map only.
            </p>
          )}
          {gates.fixFirst && (
            <p className="rounded-xl border border-node-tool/50 bg-node-tool/10 p-4 text-sm">
              <strong>Fix the process before automating it.</strong> Only about{" "}
              {Math.round(gates.rolledFirstPassYield * 100)}% of items get through every step right
              first time. Automation copies mistakes faster; start with the steps that need fixing.
            </p>
          )}
          {savings.openQuestions.length > 0 && (
            <p className="rounded-xl border border-line p-4 text-sm text-ink-muted">
              <strong className="text-ink">Why the range is wide:</strong> we don't know{" "}
              {savings.openQuestions.join("; ").toLowerCase()}. Defaults were used.
            </p>
          )}
        </section>
      )}

      <section aria-labelledby="steps-title">
        <h2 id="steps-title" className="font-display text-2xl font-semibold">
          Step by step
        </h2>
        <div className="mt-4 overflow-x-auto rounded-2xl border border-line">
          <table className="w-full min-w-[640px] text-left text-sm">
            <thead className="bg-paper-raised font-mono text-[11px] uppercase tracking-wider text-ink-muted">
              <tr>
                <th scope="col" className="px-4 py-3">
                  Step
                </th>
                <th scope="col" className="px-4 py-3">
                  Verdict
                </th>
                <th scope="col" className="px-4 py-3">
                  Risk
                </th>
                <th scope="col" className="px-4 py-3">
                  Priority
                </th>
                <th scope="col" className="px-4 py-3 text-right">
                  Hours saved / yr
                </th>
              </tr>
            </thead>
            <tbody>
              {input.steps.map((step, i) => {
                const score = scores[i];
                const saved = savings.steps[i];
                if (!score || !saved) return null;
                return (
                  <tr key={step.id} className="border-t border-line align-top">
                    <td className="px-4 py-3">
                      <p className="font-semibold">{step.name}</p>
                      <p className="mt-1 text-xs text-ink-muted">{score.reason}</p>
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-block rounded-md border px-2 py-0.5 ${CLASS_STYLE[score.finalClass]}`}
                      >
                        {score.alreadyAutomated
                          ? "Already automated"
                          : CLASS_LABELS[score.finalClass]}
                      </span>
                    </td>
                    <td className={`px-4 py-3 ${TIER_STYLE[score.tier]}`}>
                      {TIER_LABELS[score.tier]}
                    </td>
                    <td className="px-4 py-3 text-ink-muted">
                      {QUADRANT_LABELS[analysis.quadrants[step.id] ?? "not_yet"]}
                    </td>
                    <td className="px-4 py-3 text-right font-mono">
                      {Math.round(saved.savedHoursYear.base)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      <section aria-labelledby="maps-title">
        <h2 id="maps-title" className="font-display text-2xl font-semibold">
          Today vs with agents
        </h2>
        <div className="mt-4 grid gap-6 lg:grid-cols-2">
          <div className="rounded-3xl border border-line bg-paper/60 p-5 sm:p-6">
            <p className="font-mono text-xs uppercase tracking-wider text-ink-muted">today</p>
            <div className="mt-4">
              <WorkflowDiagram workflow={analysis.asIs} animate={false} />
            </div>
          </div>
          <div className="rounded-3xl border border-ember/30 bg-paper/60 p-5 sm:p-6">
            <p className="font-mono text-xs uppercase tracking-wider text-signal">with agents</p>
            {analysis.toBe ? (
              <>
                <div className="mt-4">
                  <WorkflowDiagram workflow={analysis.toBe} />
                </div>
                <div className="mt-6 border-t border-line pt-6">
                  <WorkflowFacts workflow={analysis.toBe} />
                </div>
              </>
            ) : (
              <p className="mt-4 text-sm text-ink-muted">
                Shown once the expected changes have settled.
              </p>
            )}
          </div>
        </div>
      </section>

      <section
        aria-labelledby="assumptions-title"
        className="rounded-3xl border border-line bg-paper-raised/80 p-6"
      >
        <h2 id="assumptions-title" className="font-display text-xl font-semibold">
          Assumptions behind the numbers
        </h2>
        <p className="mt-1 text-sm text-ink-muted">
          Every figure comes from your answers or a stated default. Change an answer to see the
          effect.
        </p>
        <dl className="mt-4 grid gap-x-8 gap-y-2 text-sm sm:grid-cols-2">
          {savings.assumptions.map((a) => (
            <div
              key={a.label}
              className="flex items-baseline justify-between gap-3 border-b border-line/60 py-1.5"
            >
              <dt className="text-ink-muted">{a.label}</dt>
              <dd className="flex shrink-0 items-baseline gap-2">
                <span className="font-mono">{a.value}</span>
                <span
                  className={`rounded px-1.5 font-mono text-[10px] uppercase ${a.provenance === "default" ? "bg-node-tool/15 text-node-tool" : "bg-moss/15 text-moss"}`}
                >
                  {PROVENANCE_LABEL[a.provenance]}
                </span>
              </dd>
            </div>
          ))}
        </dl>
        <p className="mt-4 text-xs text-ink-muted">
          Method: a walk-through of your last real case, timed per step, scored for rules, input
          type and AI fit, then capped by risk (EU AI Act and NIST AI RMF). Savings follow the
          standard automation benefit formula, minus exceptions and oversight time.
        </p>
      </section>

      <div className="flex flex-wrap items-center gap-3">
        <ButtonLink href="/contact">Build this with us</ButtonLink>
        <button
          type="button"
          onClick={onEdit}
          className="rounded-lg border border-line px-5 py-2.5 text-sm font-semibold hover:border-ink-muted"
        >
          Change my answers
        </button>
        {agent && (
          <Link
            href={`/agents/${agent.slug}`}
            className="text-sm font-semibold text-ember hover:text-ember-strong"
          >
            Closest standard agent: {agent.name} →
          </Link>
        )}
      </div>
    </div>
  );
}
