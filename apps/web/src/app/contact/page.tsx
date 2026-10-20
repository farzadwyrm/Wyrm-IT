import { ButtonLink } from "@wyrm/ui";
import type { Metadata } from "next";
import { Container, PageHeader } from "@/components/sections";
import { SITE } from "@/lib/site";

export const metadata: Metadata = {
  title: "Book a call",
  description:
    "Book a free 30-minute call with Wyrm IT to find where AI would save your business the most time.",
};

const STEPS = [
  {
    title: "You book a time",
    body: "Pick a 30-minute slot that suits you. No preparation needed.",
  },
  {
    title: "We talk about your week",
    body: "Where does time go? Which calls, emails or documents slow the team down?",
  },
  {
    title: "You get a straight answer",
    body: 'One recommended next step, or an honest "AI is not worth it here yet".',
  },
] as const;

const FAQ = [
  {
    q: "Is the first call really free?",
    a: "Yes. It is a conversation, not a sales pitch. If we cannot help, we will say so.",
  },
  {
    q: "Do we need technical staff?",
    a: "No. We explain everything in plain language and handle the technical work.",
  },
  {
    q: "Will our data be used to train AI models?",
    a: "We choose providers and settings where your business data is not used for model training, and we tell you exactly which services touch your data.",
  },
] as const;

export default function ContactPage() {
  return (
    <>
      <PageHeader
        eyebrow="contact"
        title="Book a free 30-minute call"
        intro="Talk to an engineer, not a salesperson. We will map one of your workflows and show how an agent would run it."
      />

      <Container className="grid gap-10 pb-20 md:grid-cols-[3fr_2fr]">
        <div>
          <ol className="space-y-6">
            {STEPS.map((step, index) => (
              <li key={step.title} className="flex gap-4">
                <span
                  aria-hidden="true"
                  className="flex size-9 shrink-0 items-center justify-center rounded-full bg-ember font-semibold text-paper"
                >
                  {index + 1}
                </span>
                <div>
                  <h2 className="font-semibold">{step.title}</h2>
                  <p className="mt-1 text-ink-muted">{step.body}</p>
                </div>
              </li>
            ))}
          </ol>

          <h2 className="mt-14 font-display text-2xl font-semibold">Questions</h2>
          <dl className="mt-6 space-y-6">
            {FAQ.map((item) => (
              <div key={item.q}>
                <dt className="font-semibold">{item.q}</dt>
                <dd className="mt-1 text-ink-muted">{item.a}</dd>
              </div>
            ))}
          </dl>
        </div>

        <aside
          aria-label="Booking"
          className="h-fit rounded-3xl border border-line bg-paper-raised p-6 sm:p-8"
        >
          {SITE.bookingUrl ? (
            <>
              <h2 className="font-display text-xl font-semibold">Choose a time</h2>
              <p className="mt-2 text-ink-muted">Opens our calendar in a new tab.</p>
              <ButtonLink
                href={SITE.bookingUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-6 w-full"
              >
                Open booking calendar
              </ButtonLink>
            </>
          ) : (
            <>
              <h2 className="font-display text-xl font-semibold">Online booking opens soon</h2>
              <p className="mt-2 text-ink-muted">
                Our booking calendar is being set up.
                {SITE.contactEmail
                  ? " In the meantime, email us and we will reply within one working day."
                  : " Please check back shortly."}
              </p>
            </>
          )}
          {SITE.contactEmail && (
            <p className="mt-6 text-sm text-ink-muted">
              Prefer email?{" "}
              <a
                href={`mailto:${SITE.contactEmail}`}
                className="font-semibold text-ember hover:text-ember-strong"
              >
                {SITE.contactEmail}
              </a>
            </p>
          )}
        </aside>
      </Container>
    </>
  );
}
