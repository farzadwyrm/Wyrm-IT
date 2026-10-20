import { AREAS, getArea, PHASES, PILLARS } from "@wyrm/guide";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { AskPanel } from "@/components/guide/ask-panel";
import { AreaCard, PhaseBadge, PillarTag } from "@/components/guide/pillar";
import { Container, CtaBand } from "@/components/sections";

// Only the guide's areas exist; anything else is a 404.
export const dynamicParams = false;

export function generateStaticParams() {
  return AREAS.map((area) => ({ slug: area.slug }));
}

export async function generateMetadata({ params }: PageProps<"/guide/[slug]">): Promise<Metadata> {
  const area = getArea((await params).slug);
  if (!area) return {};
  return { title: `${area.title}: IT explained`, description: area.oneLiner };
}

function Block({ id, title, children }: { id: string; title: string; children: React.ReactNode }) {
  return (
    <section aria-labelledby={id} className="scroll-mt-20">
      <h2 id={id} className="font-display text-2xl font-semibold">
        {title}
      </h2>
      <div className="mt-4 text-ink-muted">{children}</div>
    </section>
  );
}

export default async function AreaPage({ params }: PageProps<"/guide/[slug]">) {
  const area = getArea((await params).slug);
  if (!area) notFound();
  const related = area.related.flatMap((slug) => getArea(slug) ?? []);

  return (
    <>
      <Container className="pt-12 sm:pt-16">
        <nav aria-label="Breadcrumb" className="text-sm text-ink-muted">
          <Link href="/guide" className="font-semibold text-ember hover:text-ember-strong">
            IT explained
          </Link>
          <span aria-hidden="true"> › </span>
          <Link href={`/guide#${area.pillar}`} className="hover:text-ink">
            {PILLARS[area.pillar].question}
          </Link>
        </nav>
        <div className="mt-6 flex flex-wrap items-center gap-3">
          <PillarTag pillar={area.pillar} />
          <PhaseBadge phase={area.phase} />
        </div>
        <h1 className="mt-3 max-w-3xl font-display text-4xl font-semibold leading-tight text-balance sm:text-5xl">
          {area.title}
        </h1>
        <p className="mt-3 text-sm text-ink-muted">IT people call this: {area.technical}</p>
      </Container>

      <Container className="grid gap-12 py-12 lg:grid-cols-[3fr_2fr]">
        <div className="space-y-12 text-lg leading-relaxed">
          <Block id="plain" title="In plain words">
            <p>{area.summary}</p>
            {area.specialist && (
              <p className="mt-3 text-base">
                Mainly relevant if you have engineering, lab or compute-heavy teams.
              </p>
            )}
          </Block>

          <Block id="why" title="Why it matters to your business">
            <p>{area.whyItMatters}</p>
          </Block>

          <Block id="parts" title="What it covers">
            <dl className="space-y-4 text-base">
              {area.parts.map((part) => (
                <div key={part.name}>
                  <dt className="font-semibold text-ink">{part.name}</dt>
                  <dd className="mt-1">{part.plain}</dd>
                </div>
              ))}
            </dl>
          </Block>

          <Block id="warning-signs" title="Warning signs">
            <p className="text-base">You might have a gap if:</p>
            <ul className="mt-3 space-y-2 text-base">
              {area.warningSigns.map((sign) => (
                <li key={sign} className="flex gap-3">
                  <span aria-hidden="true" className="text-ember">
                    !
                  </span>
                  {sign}
                </li>
              ))}
            </ul>
          </Block>

          <Block id="quick-wins" title="Quick wins">
            <ol className="list-decimal space-y-2 pl-6 text-base marker:font-semibold marker:text-ember">
              {area.quickWins.map((win) => (
                <li key={win}>{win}</li>
              ))}
            </ol>
          </Block>

          <Block id="questions" title="Questions to ask your IT person">
            <ul className="space-y-2 text-base">
              {area.questions.map((question) => (
                <li key={question} className="rounded-xl border border-line bg-paper-raised p-4">
                  {question}
                </li>
              ))}
            </ul>
          </Block>

          <p className="text-base text-ink-muted">
            Priority: <strong className="text-ink">{PHASES[area.phase].name}</strong>.{" "}
            {PHASES[area.phase].plain}
          </p>
        </div>

        <aside aria-label={`Ask about ${area.title}`} className="lg:sticky lg:top-20 lg:self-start">
          <AskPanel areaSlug={area.slug} areaTitle={area.title} />
        </aside>
      </Container>

      <section aria-labelledby="related" className="border-t border-line bg-paper-raised">
        <Container className="py-14">
          <h2 id="related" className="font-display text-2xl font-semibold">
            Related areas
          </h2>
          <ul className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {related.map((r) => (
              <li key={r.slug}>
                <AreaCard area={r} />
              </li>
            ))}
          </ul>
        </Container>
      </section>
      <CtaBand />
    </>
  );
}
