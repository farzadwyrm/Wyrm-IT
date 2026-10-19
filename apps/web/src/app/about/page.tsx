import type { Metadata } from "next";
import { Container, CtaBand, PageHeader } from "@/components/sections";
import { PRINCIPLES } from "@/lib/site";

export const metadata: Metadata = {
  title: "About",
  description:
    "Wyrm IT is an engineering-led company helping small and medium businesses use AI safely and practically.",
};

export default function AboutPage() {
  return (
    <>
      <PageHeader
        eyebrow="About"
        title="Engineers who build it, run it and explain it plainly"
        intro="Wyrm IT was started by an infrastructure and software engineer who saw the same pattern again and again: businesses wanted AI, but their accounts, data and backups were not ready for it."
      />

      <Container className="grid gap-12 pb-8 md:grid-cols-[3fr_2fr]">
        <div className="space-y-5 text-lg text-ink-muted">
          <p>
            Large companies have IT departments and AI teams. Small and medium businesses usually
            have one busy person who "knows computers". We fill that gap.
          </p>
          <p>
            We start by looking at the basics: who can log in to what, where your data lives,
            whether backups would really work. Then we pick one task where AI saves real time, and
            build it with clear limits on what the AI may do.
          </p>
          <p>
            The name comes from the wyrm, the dragon of old stories that guards its treasure. Your
            data is your treasure; our job is to put it to work without leaving the door open.
          </p>
        </div>

        <aside className="rounded-3xl border border-line bg-paper-raised p-6 sm:p-8">
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
