import type { Metadata } from "next";
import { Container, CtaBand, PageHeader } from "@/components/sections";
import { PRINCIPLES } from "@/lib/site";

export const metadata: Metadata = {
  title: "About",
  description:
    "Wyrm IT is an engineering-led company that designs, deploys and runs AI agents for small and medium businesses.",
};

export default function AboutPage() {
  return (
    <>
      <PageHeader
        eyebrow="about"
        title="Engineers who build agents, deploy them and keep them running"
        intro="Wyrm IT was started by an infrastructure and software engineer who saw the same pattern again and again: teams buried in repetitive work an AI agent could do, and nobody to design, build and run that agent safely."
      />

      <Container className="grid gap-12 pb-8 md:grid-cols-[3fr_2fr]">
        <div className="space-y-5 text-lg text-ink-muted">
          <p>
            Large companies have AI teams. Small and medium businesses have people answering the
            same calls, retyping the same invoices and chasing the same leads. That is exactly the
            work agents are good at.
          </p>
          <p>
            We start with one workflow. We map it with the people who do it, design an agent with
            clear guardrails, connect it to your tools, test it on real cases and run it for you,
            measuring what it actually does every month.
          </p>
          <p>
            The name comes from the wyrm, the dragon of old stories that guards its treasure. Your
            data is your treasure: our agents put it to work without leaving the door open.
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
