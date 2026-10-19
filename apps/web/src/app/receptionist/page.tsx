import type { Metadata } from "next";
import { ReceptionistChat } from "@/components/receptionist/receptionist-chat";
import { Container, CtaBand, PageHeader } from "@/components/sections";

export const metadata: Metadata = {
  title: "AI Receptionist demo",
  description:
    "Chat with a demo receptionist for a fictional dental clinic: it answers questions and books appointments, and never books without your confirmation.",
};

const TRY_THIS = [
  "Book a cleaning on Thursday at 10am",
  "Ask for a Sunday, or yesterday",
  "Change your mind: “actually make it Friday”",
  "Ask “where are you?” in the middle of booking",
  "Say “I have a toothache”",
];

export default function ReceptionistPage() {
  return (
    <>
      <PageHeader
        eyebrow="Live demo"
        title="Meet your AI receptionist"
        intro="This receptionist works for Harbor Lane Dental, a fictional clinic. Ask it anything a patient would, or try to book an appointment. Nothing is really booked."
      />

      <Container className="grid gap-10 pb-16 lg:grid-cols-[3fr_2fr]">
        <ReceptionistChat />

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
              <li>Checks real opening hours and free slots before offering a time.</li>
              <li>
                Refuses past, closed or already-taken times, and suggests the nearest free ones.
              </li>
              <li>Reads back the details and books only after you say yes.</li>
            </ul>
          </div>

          <div className="rounded-2xl border border-line p-5 text-sm text-ink-muted">
            <p className="font-semibold text-ink">About this demo</p>
            <p className="mt-2">
              This free version follows rules and runs entirely in your browser, so it understands
              common phrasings but not everything. The version we install for clients uses AI to
              understand natural speech, answers the phone, and connects to your real calendar.
            </p>
          </div>
        </aside>
      </Container>

      <CtaBand />
    </>
  );
}
