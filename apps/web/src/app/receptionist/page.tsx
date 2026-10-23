import type { Metadata } from "next";
import { ReceptionistDemo } from "@/components/receptionist/receptionist-demo";
import { Container, CtaBand, PageHeader } from "@/components/sections";
import { SITE } from "@/lib/site";

export const metadata: Metadata = {
  title: "AI Receptionist demo",
  description:
    "Chat with a demo receptionist for a fictional dental clinic: it answers questions and books appointments, and never books without your confirmation.",
};

const TRY_THIS = [
  "Press Call and talk to it like a real phone call",
  "Change your mind halfway: “actually, could we do Friday instead?”",
  "Ask about parking in the middle of booking",
];

export default function ReceptionistPage() {
  return (
    <>
      <PageHeader
        title="Call a voice agent"
        intro="Chat with or call the receptionist of Harbor Lane Dental, a pretend clinic. Try booking an appointment. Nothing is really booked."
      />

      <Container className="grid gap-10 pb-16 lg:grid-cols-[3fr_2fr]">
        <ReceptionistDemo />

        <aside className="space-y-8">
          <div>
            <h2 className="font-display text-xl font-semibold">Things to try</h2>
            <ul className="mt-3 space-y-2 text-ink-muted">
              {TRY_THIS.map((item) => (
                <li key={item} className="flex gap-2">
                  <span aria-hidden="true" className="text-ember">
                    →
                  </span>
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h2 className="font-display text-xl font-semibold">What it always does</h2>
            <ul className="mt-3 space-y-2 text-ink-muted">
              <li>Checks the calendar before offering a time.</li>
              <li>Books only after you clearly say yes.</li>
              <li>Asks only for a first name.</li>
            </ul>
          </div>

          <div className="rounded-2xl border border-ember/40 bg-ember/5 p-5 text-sm text-ink-muted">
            <h2 className="font-display text-lg font-semibold text-ink">
              Your business, your answers
            </h2>
            <p className="mt-2">
              Clients set up their own agent in the Wyrm portal: services and prices, opening hours,
              questions and answers, rules and booking steps. They try the changes in a test chat,
              then publish when they're happy.
            </p>
            <p className="mt-3 flex flex-wrap gap-x-4 gap-y-1 font-semibold">
              <a href={`${SITE.portalUrl}/login`} className="text-ember hover:underline">
                Clients: sign in to set up your agent →
              </a>
            </p>
          </div>

          <div className="rounded-2xl border border-line p-5 text-sm text-ink-muted">
            <p className="font-semibold text-ink">About this demo</p>
            <p className="mt-2">
              Our own checks confirm every time and booking, so it never invents a free slot or
              double-books.
            </p>
          </div>
        </aside>
      </Container>

      <CtaBand />
    </>
  );
}
