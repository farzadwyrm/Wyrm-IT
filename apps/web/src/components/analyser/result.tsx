"use client";

import {
  type Agent,
  type Analysis,
  CLASS_LABELS,
  type Finding,
  INTEGRATION_LABELS,
  QUADRANT_LABELS,
  type Quadrant,
  type Report,
  type StepClass,
  TIER_CONTROLS,
  TIER_LABELS,
  type Tier,
  VERDICT_LABELS,
  type Verdict,
  WAIT_LABELS,
  type WorkflowInput,
} from "@wyrm/agents";
import Link from "next/link";
import { type ReactNode, type RefObject, useState } from "react";
import { WorkflowDiagram } from "@/components/workflow-diagram";
import { PROVENANCE_LABEL } from "./options";

const CLASS_STYLE: Record<StepClass, string> = {
  automate: "border-node-trigger/50 text-node-trigger",
  agent_check: "border-node-agent/50 text-node-agent",
  assist: "border-node-tool/50 text-node-tool",
  human: "border-node-human/50 text-node-human",
};

const VERDICT_STYLE: Record<Verdict, string> = {
  prioritise: "border-moss/60 bg-moss/10 text-moss",
  pilot: "border-node-agent/60 bg-node-agent/10 text-node-agent",
  fix_first: "border-node-tool/60 bg-node-tool/10 text-node-tool",
  defer: "border-line bg-paper-raised text-ink-muted",
  not_now: "border-line bg-paper-raised text-ink-muted",
};

const SEVERITY_STYLE = {
  high: "border-node-output/60 text-node-output",
  medium: "border-node-tool/60 text-node-tool",
  low: "border-line text-ink-muted",
} as const;

const ENGINE_LABEL = { code: "Integration", llm: "AI model", person: "Person" } as const;

const n = (v: number) => Math.round(v).toLocaleString("en");
const pct = (v: number) => `${Math.round(v * 100)}%`;

function Section({
  number,
  title,
  children,
}: {
  number: number;
  title: string;
  children: ReactNode;
}) {
  return (
    <section className="space-y-4 border-t border-line pt-8">
      <h3 className="flex items-baseline gap-3 font-display text-xl font-semibold tracking-tight">
        <span className="font-mono text-sm text-ember">{String(number).padStart(2, "0")}</span>
        {title}
      </h3>
      {children}
    </section>
  );
}

function Kpi({ label, value, note }: { label: string; value: string; note?: string | undefined }) {
  return (
    <div className="rounded-xl border border-line p-4">
      <p className="text-xs text-ink-muted">{label}</p>
      <p className="mt-1 font-display text-2xl font-semibold tabular-nums">{value}</p>
      {note && <p className="mt-0.5 text-xs text-ink-muted">{note}</p>}
    </div>
  );
}

const th =
  "px-3 py-2 text-left font-mono text-[11px] font-normal uppercase tracking-wider text-ink-muted";
const td = "px-3 py-2.5 align-top";
const action =
  "rounded-lg border border-line px-4 py-2 text-sm font-semibold hover:border-ink-muted";

/** Plain-text version for email or a document (Markdown). */
function markdown(input: WorkflowInput, a: Analysis, r: Report): string {
  return [
    `# Workflow assessment: ${input.name}`,
    "",
    `**Recommendation: ${VERDICT_LABELS[r.verdict]}** (confidence: ${r.confidence})`,
    r.rationale,
    "",
    "## Executive summary",
    ...r.summary,
    "",
    "## Step assessment",
    "| # | Step | Recommendation | Consequence | Hours/yr today | Released/yr |",
    "|---|---|---|---|---|---|",
    ...input.steps.map((s, i) => {
      const sc = a.scores[i];
      const sv = a.savings.steps[i];
      const verdict = sc?.alreadyAutomated
        ? "Already automated"
        : CLASS_LABELS[sc?.finalClass ?? "human"];
      return `| ${i + 1} | ${s.name} | ${verdict} | Tier ${sc?.tier ?? 1} | ${n(sv?.baselineHoursYear ?? 0)} | ${n(sv?.savedHoursYear.base ?? 0)} |`;
    }),
    "",
    "## Findings",
    ...r.findings.map((f) => `- **${f.title}** (${f.severity}): ${f.detail}`),
    "",
    "## Roadmap",
    ...r.roadmap.map(
      (p, i) =>
        `${i + 1}. **${p.name}** (${p.duration}): ${p.actions.join("; ")}. Exit: ${p.exitCriteria}`,
    ),
  ].join("\n");
}

/** The assessment as a document: recommendation, figures, diagnosis, design, case and plan. */
export function AssessmentReport({
  headingRef,
  input,
  analysis,
  report,
  agent,
  onEdit,
}: {
  headingRef: RefObject<HTMLHeadingElement | null>;
  input: WorkflowInput;
  analysis: Analysis;
  report: Report;
  agent: Agent | null;
  onEdit: () => void;
}) {
  const [copied, setCopied] = useState(false);
  const { savings, scores, quadrants } = analysis;
  const k = report.kpis;
  const value = savings.valueYear;
  const today = new Date().toLocaleDateString("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
  const changing = (i: number) => !scores[i]?.alreadyAutomated && scores[i]?.finalClass !== "human";
  const quadrantSteps = (q: Quadrant) =>
    input.steps.filter((s, i) => quadrants[s.id] === q && changing(i));
  const tiers = ([4, 3, 2, 1] as Tier[]).filter((t) => scores.some((s) => s.tier === t));
  const elapsed =
    k.leadTimeHours < 8
      ? `${k.leadTimeHours} h`
      : `${Math.round((k.leadTimeHours / 8) * 10) / 10} days`;

  return (
    <article className="assessment-report space-y-10">
      <header className="space-y-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="font-mono text-xs uppercase tracking-wider text-ember">
              Workflow assessment
            </p>
            <h2
              ref={headingRef}
              tabIndex={-1}
              className="mt-2 scroll-mt-28 font-display text-3xl font-semibold tracking-tight text-balance outline-none"
            >
              {input.name}
            </h2>
            <p className="mt-1 text-sm text-ink-muted">
              {today} · {input.steps.length} steps assessed
              {k.casesPerYear !== null ? ` · ${n(k.casesPerYear)} cases a year` : ""}
            </p>
          </div>
          <div className="flex flex-wrap gap-2 print:hidden">
            <button type="button" onClick={() => window.print()} className={action}>
              Save as PDF
            </button>
            <button
              type="button"
              onClick={() => {
                void navigator.clipboard
                  .writeText(markdown(input, analysis, report))
                  .then(() => setCopied(true));
              }}
              className={action}
            >
              {copied ? "Copied" : "Copy as text"}
            </button>
            <button type="button" onClick={onEdit} className={action}>
              Edit inputs
            </button>
          </div>
        </div>

        <div className={`rounded-2xl border p-6 ${VERDICT_STYLE[report.verdict]}`}>
          <p className="font-mono text-xs uppercase tracking-wider">Recommendation</p>
          <p className="mt-2 font-display text-2xl font-semibold text-ink">{report.headline}</p>
          <p className="mt-2 max-w-3xl text-ink">{report.rationale}</p>
          <p className="mt-4 text-sm text-ink-muted">
            <span className="font-semibold text-ink">Confidence: {report.confidence}.</span>{" "}
            {report.confidenceNote}
          </p>
        </div>
      </header>

      <Section number={1} title="Executive summary">
        <div className="max-w-3xl space-y-3 leading-relaxed">
          {report.summary.map((p) => (
            <p key={p}>{p}</p>
          ))}
        </div>
      </Section>

      <Section number={2} title="Key figures">
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <Kpi label="Cases per year" value={k.casesPerYear === null ? "—" : n(k.casesPerYear)} />
          <Kpi
            label="Staff time per year"
            value={`${n(k.baselineHoursYear)} h`}
            note={`${k.baselineFte} FTE, incl. rework`}
          />
          <Kpi label="Hands-on time per case" value={`${k.touchMinutesPerCase} min`} />
          <Kpi
            label="Elapsed time per case"
            value={elapsed}
            note={k.activityRatio === null ? undefined : `Activity ratio ${pct(k.activityRatio)}`}
          />
          <Kpi
            label="Right first time"
            value={pct(k.rolledFirstPassYield)}
            note="All steps, rolled yield"
          />
          <Kpi
            label="Exception rate"
            value={k.exceptionRate === null ? "—" : pct(k.exceptionRate)}
          />
          <Kpi
            label="Capacity released"
            value={`${n(k.savedHoursYear.base)} h/yr`}
            note={`Range ${n(k.savedHoursYear.low)}–${n(k.savedHoursYear.high)} h · ${k.savedFte.base} FTE`}
          />
          <Kpi
            label="Value of time released"
            value={value ? `${input.currency} ${n(value.base)}` : "—"}
            note={value ? `Range ${n(value.low)}–${n(value.high)} a year` : "Add an hourly wage"}
          />
        </div>
      </Section>

      <Section number={3} title="Current process">
        <div className="rounded-2xl border border-line bg-paper/60 p-5">
          <WorkflowDiagram workflow={analysis.asIs} />
        </div>
        <div className="overflow-x-auto rounded-xl border border-line">
          <table className="w-full min-w-[680px] text-sm">
            <caption className="sr-only">Current process metrics per step</caption>
            <thead className="bg-paper-raised">
              <tr>
                <th scope="col" className={th}>
                  #
                </th>
                <th scope="col" className={th}>
                  Step
                </th>
                <th scope="col" className={th}>
                  Role
                </th>
                <th scope="col" className={th}>
                  Systems
                </th>
                <th scope="col" className={`${th} text-right`}>
                  Hands-on
                </th>
                <th scope="col" className={th}>
                  Wait after
                </th>
                <th scope="col" className={`${th} text-right`}>
                  Right first time
                </th>
                <th scope="col" className={`${th} text-right`}>
                  Hours / yr
                </th>
              </tr>
            </thead>
            <tbody>
              {input.steps.map((s, i) => (
                <tr key={s.id} className="border-t border-line">
                  <td className={`${td} font-mono text-xs text-ink-muted`}>{i + 1}</td>
                  <td className={td}>
                    {s.name}
                    {s.rekeying && <span className="ml-2 text-xs text-node-tool">re-keyed</span>}
                  </td>
                  <td className={`${td} text-ink-muted`}>{s.actorRole ?? s.actorType}</td>
                  <td className={`${td} text-ink-muted`}>{s.tools.join(", ") || "—"}</td>
                  <td className={`${td} text-right tabular-nums`}>
                    {s.touchMinutes === null ? (
                      <span className="text-ink-muted">5*</span>
                    ) : (
                      `${s.touchMinutes} min`
                    )}
                  </td>
                  <td className={`${td} text-ink-muted`}>{WAIT_LABELS[s.waitBand]}</td>
                  <td className={`${td} text-right tabular-nums`}>{s.firstPassOutOf10 ?? 9}/10</td>
                  <td className={`${td} text-right tabular-nums`}>
                    {n(savings.steps[i]?.baselineHoursYear ?? 0)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {input.steps.some((s) => s.touchMinutes === null) && (
          <p className="text-xs text-ink-muted">* No time given; 5 minutes assumed.</p>
        )}
      </Section>

      <Section number={4} title="Step assessment">
        <p className="max-w-3xl text-sm text-ink-muted">
          Each step is scored 1–5 for how rule-based it is, how structured its input is and how well
          an AI model handles that work. The consequence tier then caps its autonomy: the higher the
          stakes, the more a person stays involved.
        </p>
        <div className="overflow-x-auto rounded-xl border border-line">
          <table className="w-full min-w-[860px] text-sm">
            <caption className="sr-only">Assessment of each step</caption>
            <thead className="bg-paper-raised">
              <tr>
                <th scope="col" className={th}>
                  Step
                </th>
                <th scope="col" className={`${th} text-center`}>
                  Rules
                </th>
                <th scope="col" className={`${th} text-center`}>
                  Input
                </th>
                <th scope="col" className={`${th} text-center`}>
                  AI fit
                </th>
                <th scope="col" className={th}>
                  Consequence
                </th>
                <th scope="col" className={th}>
                  Recommendation
                </th>
                <th scope="col" className={th}>
                  Runs on
                </th>
                <th scope="col" className={`${th} text-right`}>
                  Released / yr
                </th>
              </tr>
            </thead>
            <tbody>
              {input.steps.map((s, i) => {
                const sc = scores[i];
                if (!sc) return null;
                return (
                  <tr key={s.id} className="border-t border-line">
                    <td className={td}>
                      <span className="font-semibold">
                        {i + 1}. {s.name}
                      </span>
                      <span className="mt-0.5 block max-w-72 text-xs text-ink-muted">
                        {sc.reason}
                      </span>
                    </td>
                    <td className={`${td} text-center tabular-nums`}>{sc.rule}</td>
                    <td className={`${td} text-center tabular-nums`}>{sc.input}</td>
                    <td className={`${td} text-center tabular-nums`}>{sc.aiFit}</td>
                    <td className={`${td} whitespace-nowrap`}>{TIER_LABELS[sc.tier]}</td>
                    <td className={td}>
                      <span
                        className={`inline-block whitespace-nowrap rounded-full border px-2.5 py-0.5 text-xs font-semibold ${
                          sc.alreadyAutomated
                            ? "border-line text-ink-muted"
                            : CLASS_STYLE[sc.finalClass]
                        }`}
                      >
                        {sc.alreadyAutomated ? "Already automated" : CLASS_LABELS[sc.finalClass]}
                      </span>
                    </td>
                    <td className={`${td} text-ink-muted`}>{ENGINE_LABEL[sc.engine]}</td>
                    <td className={`${td} text-right tabular-nums`}>
                      {n(savings.steps[i]?.savedHoursYear.base ?? 0)} h
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Section>

      <Section number={5} title="Opportunity matrix">
        <p className="max-w-3xl text-sm text-ink-muted">
          Steps that change, placed by value (hours spent today) and feasibility (process stability,
          system access and share of exceptions).
        </p>
        <div className="grid gap-3 sm:grid-cols-2">
          {(
            [
              ["plan_carefully", "High value · harder to implement"],
              ["do_first", "High value · feasible now"],
              ["not_yet", "Lower value · harder to implement"],
              ["quick_tidy_up", "Lower value · easy to implement"],
            ] as [Quadrant, string][]
          ).map(([q, axis]) => {
            const items = quadrantSteps(q);
            return (
              <div
                key={q}
                className={`min-h-28 rounded-xl border p-4 ${
                  q === "do_first" ? "border-moss/60 bg-moss/5" : "border-line"
                }`}
              >
                <p className="font-semibold">{QUADRANT_LABELS[q]}</p>
                <p className="text-xs text-ink-muted">{axis}</p>
                <ul className="mt-3 space-y-1 text-sm">
                  {items.length ? (
                    items.map((s) => <li key={s.id}>{s.name}</li>)
                  ) : (
                    <li className="text-ink-muted">—</li>
                  )}
                </ul>
              </div>
            );
          })}
        </div>
      </Section>

      <Section number={6} title="Findings">
        {report.findings.length === 0 ? (
          <p className="text-ink-muted">No significant waste found in the inputs given.</p>
        ) : (
          <ul className="space-y-3">
            {report.findings.map((f: Finding) => (
              <li key={f.id} className="rounded-xl border border-line p-4">
                <div className="flex flex-wrap items-center gap-2">
                  <span
                    className={`rounded-full border px-2 py-0.5 font-mono text-[11px] uppercase ${SEVERITY_STYLE[f.severity]}`}
                  >
                    {f.severity}
                  </span>
                  <p className="font-semibold">{f.title}</p>
                </div>
                <p className="mt-2 text-sm leading-relaxed text-ink-muted">{f.detail}</p>
                {f.steps.length > 0 && (
                  <p className="mt-2 text-xs text-ink-muted">Affects: {f.steps.join(" · ")}</p>
                )}
              </li>
            ))}
          </ul>
        )}
      </Section>

      <Section number={7} title="Target design">
        {analysis.toBe ? (
          <div className="rounded-2xl border border-line bg-paper/60 p-5">
            <WorkflowDiagram workflow={analysis.toBe} />
          </div>
        ) : (
          <p className="text-ink-muted">No target design until the planned change has settled.</p>
        )}
        <div className="overflow-x-auto rounded-xl border border-line">
          <table className="w-full min-w-[680px] text-sm">
            <caption className="sr-only">Human controls by consequence tier</caption>
            <thead className="bg-paper-raised">
              <tr>
                <th scope="col" className={th}>
                  Tier
                </th>
                <th scope="col" className={th}>
                  Steps
                </th>
                <th scope="col" className={th}>
                  Human control
                </th>
                <th scope="col" className={th}>
                  Guardrails
                </th>
              </tr>
            </thead>
            <tbody>
              {tiers.map((t) => (
                <tr key={t} className="border-t border-line">
                  <td className={`${td} whitespace-nowrap font-semibold`}>{TIER_LABELS[t]}</td>
                  <td className={td}>
                    {input.steps
                      .filter((_, i) => scores[i]?.tier === t)
                      .map((s) => s.name)
                      .join(" · ")}
                  </td>
                  <td className={td}>{TIER_CONTROLS[t].humanCheck}</td>
                  <td className={`${td} text-ink-muted`}>
                    {TIER_CONTROLS[t].guardrails.join("; ")}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {report.approvers.length > 0 && (
          <p className="text-sm">
            <span className="font-semibold">Approvers:</span> {report.approvers.join(", ")}
          </p>
        )}
      </Section>

      <Section number={8} title="Business case">
        <div className="overflow-x-auto rounded-xl border border-line">
          <table className="w-full min-w-[480px] text-sm">
            <caption className="sr-only">Savings scenarios per year</caption>
            <thead className="bg-paper-raised">
              <tr>
                <th scope="col" className={th}>
                  Per year
                </th>
                <th scope="col" className={`${th} text-right`}>
                  Low
                </th>
                <th scope="col" className={`${th} text-right`}>
                  Base
                </th>
                <th scope="col" className={`${th} text-right`}>
                  High
                </th>
              </tr>
            </thead>
            <tbody>
              <tr className="border-t border-line">
                <th scope="row" className={`${td} text-left font-normal`}>
                  Hours released
                </th>
                <td className={`${td} text-right tabular-nums`}>{n(k.savedHoursYear.low)}</td>
                <td className={`${td} text-right font-semibold tabular-nums`}>
                  {n(k.savedHoursYear.base)}
                </td>
                <td className={`${td} text-right tabular-nums`}>{n(k.savedHoursYear.high)}</td>
              </tr>
              <tr className="border-t border-line">
                <th scope="row" className={`${td} text-left font-normal`}>
                  Full-time equivalent
                </th>
                <td className={`${td} text-right tabular-nums`}>{k.savedFte.low}</td>
                <td className={`${td} text-right font-semibold tabular-nums`}>{k.savedFte.base}</td>
                <td className={`${td} text-right tabular-nums`}>{k.savedFte.high}</td>
              </tr>
              {value && (
                <tr className="border-t border-line">
                  <th scope="row" className={`${td} text-left font-normal`}>
                    Value of time ({input.currency})
                  </th>
                  <td className={`${td} text-right tabular-nums`}>{n(value.low)}</td>
                  <td className={`${td} text-right font-semibold tabular-nums`}>{n(value.base)}</td>
                  <td className={`${td} text-right tabular-nums`}>{n(value.high)}</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <ul className="max-w-3xl list-disc space-y-1 pl-5 text-sm text-ink-muted">
          <li>
            Released hours are capacity. They become cash only if paid hours, overtime or
            outsourcing go down.
          </li>
          <li>Exceptions stay with people, and oversight time is subtracted in every scenario.</li>
          <li>AI usage and implementation costs are not included; they are quoted separately.</li>
        </ul>
        <details className="rounded-xl border border-line p-4 text-sm">
          <summary className="cursor-pointer font-semibold">
            Assumptions ({savings.assumptions.length})
          </summary>
          <table className="mt-3 w-full">
            <caption className="sr-only">Assumptions and their source</caption>
            <tbody>
              {savings.assumptions.map((a) => (
                <tr key={a.label} className="border-t border-line/60">
                  <th scope="row" className="py-1.5 pr-3 text-left font-normal text-ink-muted">
                    {a.label}
                  </th>
                  <td className="py-1.5 pr-3 text-right tabular-nums">{a.value}</td>
                  <td className="py-1.5 text-right text-xs text-ink-muted">
                    {PROVENANCE_LABEL[a.provenance]}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </details>
      </Section>

      <Section number={9} title="Implementation roadmap">
        <ol className="space-y-3">
          {report.roadmap.map((p, i) => (
            <li
              key={p.name}
              className="grid gap-3 rounded-xl border border-line p-4 md:grid-cols-[200px_1fr]"
            >
              <div>
                <p className="font-mono text-xs text-ember">Phase {i + 1}</p>
                <p className="font-semibold">{p.name}</p>
                <p className="text-sm text-ink-muted">{p.duration}</p>
              </div>
              <div className="space-y-2 text-sm">
                <ul className="list-disc space-y-1 pl-5">
                  {p.actions.map((a) => (
                    <li key={a}>{a}</li>
                  ))}
                </ul>
                <p className="text-ink-muted">
                  <span className="font-semibold text-ink">Exit criteria:</span> {p.exitCriteria}
                </p>
              </div>
            </li>
          ))}
        </ol>
      </Section>

      <Section number={10} title="Systems and access">
        {report.systems.length === 0 ? (
          <p className="text-ink-muted">
            No systems named. Add them to each step for an integration plan.
          </p>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-line">
            <table className="w-full min-w-[480px] text-sm">
              <caption className="sr-only">
                Systems involved and how an agent can reach them
              </caption>
              <thead className="bg-paper-raised">
                <tr>
                  <th scope="col" className={th}>
                    System
                  </th>
                  <th scope="col" className={th}>
                    Access for an agent
                  </th>
                  <th scope="col" className={th}>
                    Used in
                  </th>
                </tr>
              </thead>
              <tbody>
                {report.systems.map((s) => (
                  <tr key={s.system} className="border-t border-line">
                    <td className={`${td} font-semibold`}>{s.system}</td>
                    <td className={td}>{INTEGRATION_LABELS[s.access]}</td>
                    <td className={`${td} text-ink-muted`}>{s.steps.join(" · ")}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {report.openQuestions.length > 0 && (
          <div className="rounded-xl border border-line p-4 text-sm">
            <p className="font-semibold">Open questions to confirm</p>
            <ul className="mt-2 list-disc space-y-1 pl-5 text-ink-muted">
              {report.openQuestions.map((q) => (
                <li key={q}>{q}</li>
              ))}
            </ul>
          </div>
        )}
      </Section>

      <footer className="space-y-5 border-t border-line pt-8">
        <p className="max-w-3xl text-xs leading-relaxed text-ink-muted">
          Method: SIPOC scoping; metrics-based process mapping (hands-on time, elapsed time,
          right-first-time); Lean waste probes; two-axis scoring of automation potential and
          feasibility, as in UiPath and Blue Prism assessments; agent-fit criteria from OpenAI and
          Anthropic guidance; consequence tiers following the EU AI Act (Art. 50, Annex III) and the
          NIST AI RMF. Scores and default rates are estimates to validate in a pilot, not
          guarantees.
        </p>
        <div className="flex flex-wrap items-center gap-3 print:hidden">
          <Link
            href="/contact"
            className="inline-flex min-h-11 items-center rounded-lg bg-ember px-5 font-semibold text-paper hover:bg-ember-strong"
          >
            Review this assessment with us
          </Link>
          {agent && (
            <Link
              href={`/agents/${agent.slug}`}
              className="text-sm font-semibold text-ember hover:text-ember-strong"
            >
              Related agent: {agent.name} →
            </Link>
          )}
        </div>
      </footer>
    </article>
  );
}
