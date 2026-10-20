import { AREAS, PHASES, type Phase, PILLAR_ORDER, PILLARS } from "@wyrm/guide";
import type { Metadata } from "next";
import { AskPanel } from "@/components/guide/ask-panel";
import { AreaCard, PILLAR_STYLE, PillarIcon } from "@/components/guide/pillar";
import { Container, CtaBand, PageHeader } from "@/components/sections";

export const metadata: Metadata = {
  title: "Your IT, explained",
  description:
    "Every part of a company's IT in plain language: what it is, why it matters, warning signs, quick wins and what to ask your IT person. Ask our AI about any of it.",
};

export default function GuidePage() {
  return (
    <>
      <PageHeader
        eyebrow="IT explained"
        title="Your IT, explained in plain words"
        intro="Nineteen areas that every company's IT is made of, grouped by seven questions an owner should be able to answer. Each one covers what it is, why it matters, warning signs, quick wins and what to ask your IT person."
      />

      <Container className="pb-12">
        <div className="max-w-2xl">
          <AskPanel askFromUrl />
        </div>
      </Container>

      <section aria-labelledby="phases" className="border-t border-line bg-paper-raised">
        <Container className="py-14">
          <h2 id="phases" className="font-display text-2xl font-semibold">
            Where to start
          </h2>
          <ol className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {([1, 2, 3, 4] as Phase[]).map((phase) => (
              <li key={phase} className="rounded-2xl border border-line bg-paper p-5">
                <p className={`text-sm font-semibold ${phase === 1 ? "text-ember" : ""}`}>
                  {phase}. {PHASES[phase].name}
                </p>
                <p className="mt-2 text-sm text-ink-muted">{PHASES[phase].plain}</p>
              </li>
            ))}
          </ol>
        </Container>
      </section>

      {PILLAR_ORDER.map((pillar) => {
        const areas = AREAS.filter((a) => a.pillar === pillar).sort((a, b) => a.phase - b.phase);
        return (
          <section
            key={pillar}
            id={pillar}
            aria-labelledby={`${pillar}-title`}
            className="scroll-mt-20 border-t border-line"
          >
            <Container className="py-14">
              <p
                className={`flex items-center gap-2 text-sm font-semibold uppercase tracking-wider ${PILLAR_STYLE[pillar].text}`}
              >
                <PillarIcon pillar={pillar} />
                {PILLARS[pillar].name}
              </p>
              <h2 id={`${pillar}-title`} className="mt-2 font-display text-2xl font-semibold">
                {PILLARS[pillar].question}
              </h2>
              <ul className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {areas.map((area) => (
                  <li key={area.slug}>
                    <AreaCard area={area} />
                  </li>
                ))}
              </ul>
            </Container>
          </section>
        );
      })}

      <CtaBand />
    </>
  );
}
