import { ButtonLink } from "@wyrm/ui";
import Link from "next/link";
import { Container, CtaBand, SectionTitle } from "@/components/sections";
import { DEMOS, OFFERS, PRINCIPLES, SITE, USE_CASES } from "@/lib/site";

export default function HomePage() {
  return (
    <>
      <Container className="pt-16 pb-20 sm:pt-28 sm:pb-28">
        <p className="text-sm font-semibold uppercase tracking-wider text-ember">{SITE.tagline}</p>
        <h1 className="mt-4 max-w-4xl font-display text-4xl font-semibold leading-[1.1] text-balance sm:text-6xl">
          AI that works for your business, on IT foundations you can trust.
        </h1>
        <p className="mt-6 max-w-2xl text-lg text-ink-muted text-pretty">
          We check that your accounts, data and backups are ready, then build AI assistants that
          answer calls, find answers in your documents and take busywork off your team.
        </p>
        <div className="mt-10 flex flex-wrap gap-3">
          <ButtonLink href="/contact">Book a free call</ButtonLink>
          <ButtonLink href="#demos" variant="secondary">
            Try a demo
          </ButtonLink>
        </div>
      </Container>

      <section aria-labelledby="use-cases" className="border-t border-line bg-paper-raised">
        <Container className="py-20">
          <SectionTitle
            id="use-cases"
            title="Where AI pays off first"
            intro="We start with one task that costs your team real hours every week."
          />
          <ul className="mt-10 grid gap-6 md:grid-cols-3">
            {USE_CASES.map((useCase) => (
              <li key={useCase.sector} className="rounded-2xl border border-line bg-paper p-6">
                <h3 className="font-semibold">{useCase.sector}</h3>
                <p className="mt-3 text-sm text-ink-muted">
                  <span className="font-medium text-ink">The problem: </span>
                  {useCase.problem}
                </p>
                <p className="mt-2 text-sm text-ink-muted">
                  <span className="font-medium text-ink">With AI: </span>
                  {useCase.solution}
                </p>
              </li>
            ))}
          </ul>
        </Container>
      </section>

      <section
        id="demos"
        aria-labelledby="demos-title"
        className="scroll-mt-20 border-t border-line"
      >
        <Container className="py-20">
          <SectionTitle
            id="demos-title"
            title="Try it before you talk to us"
            intro="Live demos with fictional businesses, so you can see exactly how it behaves."
          />
          <ul className="mt-10 grid gap-6 md:grid-cols-3">
            {DEMOS.map((demo) => (
              <li
                key={demo.slug}
                className="flex flex-col rounded-2xl border border-line bg-paper-raised p-6"
              >
                <h3 className="font-semibold">{demo.name}</h3>
                <p className="mt-2 flex-1 text-sm text-ink-muted">{demo.summary}</p>
                {demo.status === "coming-soon" && (
                  <p className="mt-5 text-xs font-semibold uppercase tracking-wider text-moss">
                    Coming soon
                  </p>
                )}
              </li>
            ))}
          </ul>
        </Container>
      </section>

      <section aria-labelledby="how" className="border-t border-line bg-paper-raised">
        <Container className="py-20">
          <SectionTitle
            id="how"
            title="How we work"
            intro="Start small and free. Go further only when it is clearly worth it."
          />
          <ol className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {OFFERS.map((offer, index) => (
              <li key={offer.slug} className="rounded-2xl border border-line bg-paper p-6">
                <p className="text-xs font-semibold text-ink-muted">Step {index + 1}</p>
                <h3 className="mt-1 font-semibold">{offer.name}</h3>
                <p className="mt-2 text-sm text-ink-muted">{offer.summary}</p>
                <p className="mt-4 text-sm font-semibold text-ember">{offer.price}</p>
              </li>
            ))}
          </ol>
          <p className="mt-8">
            <Link href="/services" className="font-semibold text-ember hover:text-ember-strong">
              See all services →
            </Link>
          </p>
        </Container>
      </section>

      <section aria-labelledby="why" className="border-t border-line">
        <Container className="py-20">
          <SectionTitle id="why" title="Why Wyrm IT" />
          <dl className="mt-10 grid gap-8 sm:grid-cols-2">
            {PRINCIPLES.map((principle) => (
              <div key={principle.title}>
                <dt className="font-semibold">{principle.title}</dt>
                <dd className="mt-2 text-ink-muted">{principle.body}</dd>
              </div>
            ))}
          </dl>
        </Container>
      </section>

      <CtaBand />
    </>
  );
}
