import type { Metadata } from "next";
import { Container, CtaBand, PageHeader } from "@/components/sections";
import { PRINCIPLES } from "@/lib/site";

export const metadata: Metadata = {
  title: "About",
  description:
    "Wyrm AI is an engineering-led company that designs, deploys and runs AI agents for small and medium businesses.",
};

export default function AboutPage() {
  return (
    <>
      <PageHeader
        title="Engineers who build agents and keep them running"
        intro="Wyrm AI was started by a software engineer who kept seeing small teams buried in repetitive work an AI agent could do."
      />

      <Container className="grid gap-12 pb-8 md:grid-cols-[3fr_2fr]">
        <div className="space-y-5 text-lg text-ink-muted">
          <p>
            We start with one task. We see how your team does it today, build an agent for it, test
            it on real cases and run it for you.
          </p>
          <p>
            The name comes from the wyrm, the dragon that guards its treasure. Your data is yours,
            and we look after it.
          </p>
        </div>

        <aside className="rounded-3xl border border-line bg-paper-raised/80 p-6 sm:p-8">
          <h2 className="font-display text-xl font-semibold">What we believe</h2>
          <dl className="mt-6 space-y-5">
            {PRINCIPLES.map((principle) => (
              <div key={principle.title}>
                <dt className="font-semibold">{principle.title}</dt>
                <dd className="mt-1 text-sm text-ink-muted">{principle.body}</dd>
              </div>
            ))}
          </dl>
        </aside>
      </Container>

      <CtaBand />
    </>
  );
}
