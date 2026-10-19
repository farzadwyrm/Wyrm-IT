import { PILLAR_INFO, readinessBand } from "./pillars";
import type { AssessmentResult, Pillar, PillarScore } from "./types";

/** A first AI project we can honestly recommend, and what it needs to be safe. */
const AI_USE_CASES = {
  receptionist: {
    name: "an AI receptionist that answers routine calls and books appointments",
    why: "it needs access only to your calendar and a list of common questions, not your files, so it is a low-risk place to start",
  },
  documents: {
    name: "an assistant that answers staff questions from your own documents and shows its sources",
    why: "your documents and access controls look organised enough for an AI to read them without exposing the wrong files",
  },
  automation: {
    name: "a small automation that drafts replies or moves enquiry details between your tools",
    why: "your accounts and data basics are solid, so connecting tools carries little extra risk",
  },
} as const;

const scoreOf = (pillars: readonly PillarScore[], pillar: Pillar) =>
  pillars.find((p) => p.pillar === pillar)?.percent ?? null;

function pickUseCase(result: AssessmentResult) {
  const identity = scoreOf(result.pillars, "identity") ?? 0;
  const data = scoreOf(result.pillars, "data") ?? 0;
  const applications = scoreOf(result.pillars, "applications") ?? 0;
  if (identity >= 75 && data >= 75) return AI_USE_CASES.automation;
  if (identity >= 60 && data >= 60 && applications >= 50) return AI_USE_CASES.documents;
  return AI_USE_CASES.receptionist;
}

/**
 * Rule-based written summary: free, instant, and deterministic.
 * Used when the AI summary is switched off, over budget, or unavailable.
 * Three paragraphs separated by blank lines, matching the AI summary's shape.
 */
export function writeBasicSummary(result: AssessmentResult): string {
  if (result.overall === null) {
    return "Most questions were marked as not applying to your business, so there is not enough to score. A short call is the quickest way to see where AI could help.";
  }

  const band = readinessBand(result.overall);
  const scored = result.pillars.filter((p) => p.percent !== null);
  const strongest = scored.reduce((a, b) => ((b.percent ?? 0) > (a.percent ?? 0) ? b : a));
  const weakest = scored.reduce((a, b) => ((b.percent ?? 0) < (a.percent ?? 0) ? b : a));

  const overview =
    strongest.pillar === weakest.pillar
      ? `Based on your answers, your overall score is ${result.overall}%: ${band.label.toLowerCase()}. ${band.summary}`
      : `Based on your answers, your overall score is ${result.overall}%: ${band.label.toLowerCase()}. Your strongest area is ${PILLAR_INFO[strongest.pillar].label.toLowerCase()} (${strongest.percent}%) and the one needing most attention is ${PILLAR_INFO[weakest.pillar].label.toLowerCase()} (${weakest.percent}%).`;

  const top = result.findings.slice(0, 3);
  const priorities =
    top.length === 0
      ? "You reported no gaps, which is rare. Keep reviewing these basics once a year."
      : `Fix these first. ${top
          .map((f, i) => `${["First", "Second", "Third"][i]}: ${f.prompt} ${f.whyItMatters}`)
          .join(" ")}`;

  const useCase = pickUseCase(result);
  const ai =
    result.overall < 45
      ? `Once the basics above are fixed, a sensible first AI project would be ${useCase.name}, because ${useCase.why}.`
      : `A sensible first AI project would be ${useCase.name}, because ${useCase.why}.`;

  return [overview, priorities, ai].join("\n\n");
}
