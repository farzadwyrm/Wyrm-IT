"use client";

import type { Agent, Analysis, StepClass, WorkflowInput } from "@wyrm/agents";
import { ButtonLink } from "@wyrm/ui";
import Link from "next/link";
import { WorkflowDiagram } from "@/components/workflow-diagram";
import { PROVENANCE_LABEL } from "./options";

/** Plain verdicts for owners; the method's class names stay in code and docs. */
const VERDICT: Record<StepClass, { label: string; style: string }> = {
  automate: { label: "AI does it", style: "bg-node-trigger/15 text-node-trigger" },
  agent_check: { label: "AI does it, you check", style: "bg-node-agent/15 text-node-agent" },
  assist: { label: "AI helps you", style: "bg-node-tool/15 text-node-tool" },
  human: { label: "You keep it", style: "bg-node-human/15 text-node-human" },
};

const fmt = (n: number) => Math.round(n).toLocaleString("en");

export function AnalysisResult({
  input,
  analysis,
  agent,
  onEdit,
  onRestart,
}: {
  input: WorkflowInput;
  analysis: Analysis;
  agent: Agent | null;
  onEdit: () => void;
  onRestart: () => void;
}) {
  const { savings, scores, gates } = analysis;
  const week = savings.savedHoursWeek;

  return (
    <div className="space-y-10">
      <section className="rounded-3xl border border-ember/30 bg-paper-raised p-6 sm:p-8">
        <p className="text-ink-muted">AI agents could free up about</p>
        <p className="mt-1 font-display text-5xl font-semibold tracking-tight sm:text-6xl">
          {week.base} hours
          <span className="text-2xl text-ink-muted"> a week</span>
        </p>
        <p className="mt-3 text-ink-muted">
          on "{input.name}". Realistic range: {week.low} to {week.high} hours a week.
        </p>
        {savings.valueYear && (
          <p className="mt-2 text-ink-muted">
            That time is worth about{" "}
            <strong className="text-ink">€{fmt(savings.valueYear.base)} a year</strong>.
          </p>
        )}
      </section>

      {(gates.defer || gates.fixFirst) && (
        <p className="rounded-xl border border-node-tool/50 bg-node-tool/10 p-4">
          {gates.fixFirst
            ? "Tip: many items need fixing along the way. Smoothing those steps first will make automation work much better."
            : "Tip: this process is about to change. It's best to automate it once the change has settled."}
        </p>
      )}

      <section aria-labelledby="steps-title">
        <h3 id="steps-title" className="font-display text-xl font-semibold">
          What AI can do in each step
        </h3>
        <ol className="mt-4 divide-y divide-line rounded-2xl border border-line">
          {input.steps.map((step, i) => {
            const score = scores[i];
            const saved = savings.steps[i];
            if (!score || !saved) return null;
            const verdict = score.alreadyAutomated
              ? { label: "Already automated", style: "bg-line text-ink-muted" }
              : VERDICT[score.finalClass];
            return (
              <li key={step.id} className="flex flex-wrap items-start gap-x-4 gap-y-2 p-4">
                <span className="w-5 shrink-0 font-mono text-xs text-ink-muted">{i + 1}</span>
                <div className="min-w-0 flex-1">
                  <p className="font-semibold">{step.name}</p>
                  <p className="mt-0.5 text-sm text-ink-muted">
                    {score.reason.replace(/ Capped by risk.*$/, "")}
                  </p>
                </div>
                <span
                  className={`shrink-0 rounded-full px-3 py-1 text-sm font-medium ${verdict.style}`}
                >
                  {verdict.label}
                </span>
              </li>
            );
          })}
        </ol>
      </section>

      {analysis.toBe && (
        <section aria-labelledby="flow-title">
          <h3 id="flow-title" className="font-display text-xl font-semibold">
            How it would work
          </h3>
          <div className="mt-4 rounded-3xl border border-line bg-paper/60 p-5 sm:p-6">
            <WorkflowDiagram workflow={analysis.toBe} />
            <ul className="mt-6 space-y-1.5 border-t border-line pt-5 text-sm text-ink-muted">
              {analysis.toBe.guardrails.slice(0, 4).map((g) => (
                <li key={g} className="flex gap-2">
                  <span aria-hidden="true" className="text-node-human">
                    ✓
                  </span>
                  {g}
                </li>
              ))}
            </ul>
          </div>
        </section>
      )}

      <details className="rounded-2xl border border-line p-5 text-sm">
        <summary className="cursor-pointer font-semibold">How we worked this out</summary>
        <p className="mt-3 text-ink-muted">
          Today this takes about {fmt(savings.baselineHoursYear)} hours a year. Each step is scored
          on how rule-based it is, what kind of information it uses and whether AI can do it well,
          then limited by what's at stake (money, customers, personal data). Exceptions stay with
          your team, and time to oversee the agent is subtracted.
        </p>
        <dl className="mt-4 space-y-1.5">
          {savings.assumptions.map((a) => (
            <div key={a.label} className="flex justify-between gap-3 border-b border-line/60 py-1">
              <dt className="text-ink-muted">{a.label}</dt>
              <dd className="shrink-0 text-right">
                {a.value}{" "}
                <span className="text-xs text-ink-muted">({PROVENANCE_LABEL[a.provenance]})</span>
              </dd>
            </div>
          ))}
        </dl>
        {savings.valueYear && (
          <p className="mt-3 text-xs text-ink-muted">
            The euro figure is the value of time freed up, not cash saved, unless you reduce paid
            hours, overtime or outsourcing.
          </p>
        )}
      </details>

      <div className="flex flex-wrap items-center gap-3">
        <ButtonLink href="/contact">Build this with us</ButtonLink>
        <button
          type="button"
          onClick={onEdit}
          className="rounded-lg border border-line px-5 py-2.5 text-sm font-semibold hover:border-ink-muted"
        >
          Adjust my steps
        </button>
        <button
          type="button"
          onClick={onRestart}
          className="px-2 py-2.5 text-sm text-ink-muted hover:text-ink"
        >
          Analyse another task
        </button>
      </div>
      {agent && (
        <p className="text-sm text-ink-muted">
          Closest ready-made agent:{" "}
          <Link
            href={`/agents/${agent.slug}`}
            className="font-semibold text-ember hover:text-ember-strong"
          >
            {agent.name} →
          </Link>
        </p>
      )}
    </div>
  );
}
