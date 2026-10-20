import { ButtonLink } from "@wyrm/ui";
import type { Metadata } from "next";
import { Container, CtaBand, PageHeader } from "@/components/sections";
import { OFFERS } from "@/lib/site";

export const metadata: Metadata = {
  title: "Services",
  description:
    "From a discovery sprint to fully managed AI agents: how Wyrm designs, deploys and runs AI agents for small and medium businesses.",
};

export default function ServicesPage() {
  return (
    <>
      <PageHeader
        eyebrow="services"
        title="From one workflow to agents that run every day"
        intro="Three steps, each useful on its own. Most clients start with one workflow and add agents only when the first one clearly pays for itself."
      />

      <Container className="pb-8">
        <ol className="space-y-6">
          {OFFERS.map((offer, index) => (
            <li
              key={offer.slug}
              id={offer.slug}
              className="scroll-mt-24 rounded-3xl border border-line bg-paper-raised/80 p-6 sm:p-10"
            >
              <div className="flex flex-wrap items-baseline justify-between gap-3">
                <h2 className="font-display text-2xl font-semibold">
                  <span className="mr-3 text-ink-muted">{index + 1}.</span>
                  {offer.name}
                </h2>
                <p className="rounded-full border border-line px-3 py-1 text-sm font-semibold text-ember">
                  {offer.price}
                </p>
              </div>
              <p className="mt-4 max-w-3xl text-lg text-ink-muted">{offer.summary}</p>
              <div className="mt-6 grid gap-6 md:grid-cols-2">
                <div>
                  <h3 className="text-sm font-semibold uppercase tracking-wider">Who it is for</h3>
                  <p className="mt-2 text-ink-muted">{offer.forWho}</p>
                </div>
                <div>
                  <h3 className="text-sm font-semibold uppercase tracking-wider">What you get</h3>
                  <ul className="mt-2 space-y-2 text-ink-muted">
                    {offer.deliverables.map((item) => (
                      <li key={item} className="flex gap-2">
                        <span aria-hidden="true" className="text-moss">
                          ✓
                        </span>
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
              {offer.slug === "workflow-sprint" && (
                <ButtonLink href="/planner" className="mt-8" variant="secondary">
                  Sketch a workflow with the AI planner
                </ButtonLink>
              )}
            </li>
          ))}
        </ol>
      </Container>

      <CtaBand />
    </>
  );
}
