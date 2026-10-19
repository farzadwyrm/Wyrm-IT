"use client";

import { type Answers, type AssessmentResult, PILLAR_INFO, readinessBand } from "@wyrm/assessment";
import Link from "next/link";
import { type RefObject, useState } from "react";
import type { ReportResponse } from "@/lib/scan";
import { primaryButton, secondaryButton } from "./buttons";

const TOP_FIXES = 5;

const FAILED_MESSAGES: Record<
  Extract<ReportResponse, { status: "unavailable" }>["reason"] | "network",
  string
> = {
  too_few_answers: "Answer a few more questions for a meaningful summary.",
  invalid_request: "Something went wrong sending your answers. Please try again.",
  network: "Could not reach the server. Check your connection and try again.",
};

type SummaryState =
  | { kind: "idle" }
  | { kind: "loading" }
  | { kind: "done"; text: string; source: "ai" | "basic" }
  | { kind: "failed"; message: string };

export function ScanResults({
  result,
  answers,
  headingRef,
  onRestart,
}: {
  result: AssessmentResult;
  answers: Answers;
  headingRef: RefObject<HTMLHeadingElement | null>;
  onRestart: () => void;
}) {
  const [summary, setSummary] = useState<SummaryState>({ kind: "idle" });
  const band = result.overall === null ? null : readinessBand(result.overall);

  async function requestSummary() {
    setSummary({ kind: "loading" });
    try {
      const response = await fetch("/api/scan/report", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ answers }),
      });
      const data = (await response.json()) as ReportResponse;
      setSummary(
        data.status === "ok"
          ? { kind: "done", text: data.text, source: data.source }
          : { kind: "failed", message: FAILED_MESSAGES[data.reason] },
      );
    } catch {
      setSummary({ kind: "failed", message: FAILED_MESSAGES.network });
    }
  }

  return (
    <div>
      <h2
        ref={headingRef}
        tabIndex={-1}
        className="scroll-mt-24 font-display text-3xl font-semibold outline-none"
      >
        Your results
      </h2>

      <section
        aria-label="Overall score"
        className="mt-6 grid gap-6 rounded-3xl border border-line bg-paper-raised p-6 sm:grid-cols-[auto_1fr] sm:items-center sm:p-10"
      >
        <p className="font-display text-6xl font-semibold text-ember">
          {result.overall === null ? "–" : `${result.overall}%`}
        </p>
        <div>
          <p className="text-xl font-semibold">{band?.label ?? "Not enough answers to score"}</p>
          <p className="mt-2 text-ink-muted">
            {band?.summary ?? "Most questions were marked as not applying to your business."}
          </p>
        </div>
      </section>

      <section aria-labelledby="areas-title" className="mt-10">
        <h3 id="areas-title" className="text-lg font-semibold">
          By area
        </h3>
        <ul className="mt-4 space-y-4">
          {result.pillars.map((p) => (
            <li key={p.pillar}>
              <div className="flex justify-between gap-4 text-sm">
                <span className="font-medium">{PILLAR_INFO[p.pillar].label}</span>
                <span className="text-ink-muted">
                  {p.percent === null ? "n/a" : `${p.percent}%`}
                </span>
              </div>
              <div className="mt-1.5 h-2.5 overflow-hidden rounded-full bg-line" aria-hidden="true">
                <div
                  className={`h-full rounded-full ${
                    (p.percent ?? 0) >= 75
                      ? "bg-moss"
                      : (p.percent ?? 0) >= 45
                        ? "bg-ember/70"
                        : "bg-ember"
                  }`}
                  style={{ width: `${p.percent ?? 0}%` }}
                />
              </div>
            </li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="fixes-title" className="mt-10">
        <h3 id="fixes-title" className="text-lg font-semibold">
          Fix these first
        </h3>
        {result.findings.length === 0 ? (
          <p className="mt-3 text-ink-muted">No gaps reported. Impressive.</p>
        ) : (
          <ol className="mt-4 space-y-4">
            {result.findings.slice(0, TOP_FIXES).map((finding, index) => (
              <li key={finding.questionId} className="rounded-2xl border border-line p-5">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-sm font-semibold text-ink-muted">{index + 1}.</span>
                  <span
                    className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                      finding.answer === "gap" ? "bg-ember text-paper" : "border border-line"
                    }`}
                  >
                    {finding.answer === "gap" ? "Missing" : "Partly in place"}
                  </span>
                  <span className="text-xs text-ink-muted">
                    {PILLAR_INFO[finding.pillar].label}
                  </span>
                </div>
                <p className="mt-2 font-medium">{finding.prompt}</p>
                <p className="mt-1 text-sm text-ink-muted">{finding.whyItMatters}</p>
              </li>
            ))}
          </ol>
        )}
      </section>

      <section
        aria-labelledby="summary-title"
        aria-live="polite"
        className="mt-10 rounded-3xl border border-line bg-paper-raised p-6 sm:p-8"
      >
        <h3 id="summary-title" className="text-lg font-semibold">
          Your personalised summary
        </h3>
        {summary.kind === "idle" && (
          <>
            <p className="mt-2 text-ink-muted">
              A short plain-language summary of your results: what to fix first, and a realistic
              first AI project. Only your scores are sent, nothing personal.
            </p>
            <button type="button" className={`${primaryButton} mt-5`} onClick={requestSummary}>
              Write my summary
            </button>
          </>
        )}
        {summary.kind === "loading" && (
          <p className="mt-3 animate-pulse text-ink-muted">Writing your summary…</p>
        )}
        {summary.kind === "done" && (
          <div className="mt-3 space-y-3 leading-relaxed">
            {summary.text
              .split(/\n\s*\n/)
              .filter(Boolean)
              .map((paragraph) => (
                <p key={paragraph}>{paragraph}</p>
              ))}
            <p className="text-xs text-ink-muted">
              {summary.source === "ai"
                ? "Written by AI from your answers."
                : "Generated instantly from your answers."}{" "}
              Treat it as a starting point, not professional advice.
            </p>
          </div>
        )}
        {summary.kind === "failed" && (
          <div className="mt-3">
            <p className="text-ink-muted">{summary.message}</p>
            <button type="button" className={`${secondaryButton} mt-4`} onClick={requestSummary}>
              Try again
            </button>
          </div>
        )}
      </section>

      <div className="mt-10 flex flex-wrap gap-3">
        <Link href="/contact" className={primaryButton}>
          Talk through my results
        </Link>
        <button type="button" className={secondaryButton} onClick={onRestart}>
          Start again
        </button>
      </div>
    </div>
  );
}
