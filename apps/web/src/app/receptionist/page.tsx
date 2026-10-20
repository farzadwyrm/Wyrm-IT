import type { Metadata } from "next";
import { ReceptionistDemo } from "@/components/receptionist/receptionist-demo";
import { Container, CtaBand, PageHeader } from "@/components/sections";

export const metadata: Metadata = {
  title: "AI Receptionist demo",
  description:
    "Chat with a demo receptionist for a fictional dental clinic: it answers questions and books appointments, and never books without your confirmation.",
};

const TRY_THIS = [
  "Press Call and talk to it like a real phone call (Chrome, Edge or Safari)",
  "Talk naturally: “hi, my tooth's been killing me since the weekend”",
  "Ask for “something after work on Wednesday”",
  "Change your mind halfway: “actually, could my partner come instead on Friday?”",
  "Ask for a Sunday, or yesterday",
  "Ask about parking in the middle of booking",
];

export default function ReceptionistPage() {
  return (
    <>
      <PageHeader
        eyebrow="live demo · voice agent"
        title="Call a voice agent"
        intro="A voice agent for Harbor Lane Dental, a fictional clinic. Call it or chat the way a patient would: it understands natural speech, checks the calendar, books and confirms. Nothing is really booked."
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
              <li>Checks the live calendar before offering a time; it never guesses.</li>
              <li>
                Refuses past, closed or already-taken times, and suggests the nearest free ones.
              </li>
              <li>Shows a confirmation card and books only after you clearly say yes.</li>
              <li>Asks only for a first name: no phone, email or health details.</li>
            </ul>
          </div>

          <div className="rounded-2xl border border-line p-5 text-sm text-ink-muted">
            <p className="font-semibold text-ink">About this demo</p>
            <p className="mt-2">
              The receptionist is an AI (Claude) that understands natural language, while our own
              code checks every time slot and every booking, so the AI cannot invent availability or
              book without your yes. If the AI is unavailable, a simpler rule-based version takes
              over. For clients we connect it to the real calendar and phone line.
            </p>
          </div>
        </aside>
      </Container>

      <CtaBand />
    </>
  );
}
