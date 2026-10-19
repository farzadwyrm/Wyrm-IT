import {
  type Answer,
  type Answers,
  type AssessmentResult,
  type Finding,
  PILLARS,
  type PillarScore,
  type Question,
} from "./types";

const ANSWER_POINTS: Record<Exclude<Answer, "not_applicable">, number> = {
  in_place: 1,
  partial: 0.5,
  gap: 0,
};

function weightedPercent(items: { weight: number; points: number }[]): number | null {
  const total = items.reduce((sum, item) => sum + item.weight, 0);
  if (total === 0) return null;
  const earned = items.reduce((sum, item) => sum + item.weight * item.points, 0);
  return Math.round((earned / total) * 100);
}

/**
 * Score a set of answers. Unanswered and "not_applicable" questions are excluded
 * from the denominator so they neither help nor hurt the score.
 */
export function scoreAssessment(
  questions: readonly Question[],
  answers: Answers,
): AssessmentResult {
  const scored: { question: Question; points: number }[] = [];
  const findings: Finding[] = [];

  for (const question of questions) {
    const answer = answers[question.id];
    if (answer === undefined || answer === "not_applicable") continue;
    scored.push({ question, points: ANSWER_POINTS[answer] });
    if (answer === "gap" || answer === "partial") {
      findings.push({
        questionId: question.id,
        pillar: question.pillar,
        phase: question.phase,
        answer,
        prompt: question.prompt,
        whyItMatters: question.whyItMatters,
      });
    }
  }

  const pillars: PillarScore[] = PILLARS.map((pillar) => {
    const inPillar = scored.filter((s) => s.question.pillar === pillar);
    return {
      pillar,
      percent: weightedPercent(
        inPillar.map((s) => ({ weight: s.question.weight, points: s.points })),
      ),
      answered: inPillar.length,
    };
  });

  const weightOf = new Map(questions.map((q) => [q.id, q.weight]));
  findings.sort(
    (a, b) =>
      a.phase - b.phase ||
      (a.answer === b.answer ? 0 : a.answer === "gap" ? -1 : 1) ||
      (weightOf.get(b.questionId) ?? 0) - (weightOf.get(a.questionId) ?? 0),
  );

  return {
    overall: weightedPercent(scored.map((s) => ({ weight: s.question.weight, points: s.points }))),
    pillars,
    findings,
  };
}
