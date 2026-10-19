import { ButtonLink } from "@wyrm/ui";
import { DEMOS, OFFERS, SITE } from "@/lib/site";

export default function HomePage() {
  return (
    <main className="mx-auto max-w-5xl px-4 sm:px-6">
      <header className="flex items-center justify-between py-6">
        <span className="font-display text-xl font-semibold">{SITE.name}</span>
        <ButtonLink href={SITE.bookingUrl} variant="secondary">
          Book a call
        </ButtonLink>
      </header>

      <section className="py-16 sm:py-24">
        <p className="text-sm font-semibold uppercase tracking-wider text-ember">{SITE.tagline}</p>
        <h1 className="mt-4 max-w-3xl font-display text-4xl font-semibold leading-tight sm:text-5xl">
          AI that works for your business, on IT foundations you can trust.
        </h1>
        <p className="mt-6 max-w-2xl text-lg text-ink-muted">{SITE.description}</p>
        <div className="mt-8 flex flex-wrap gap-3">
          <ButtonLink href="#demos">Try a demo</ButtonLink>
          <ButtonLink href="#offer" variant="secondary">
            See how we work
          </ButtonLink>
        </div>
      </section>

      <section id="demos" className="border-t border-line py-16">
        <h2 className="font-display text-2xl font-semibold">Live demos</h2>
        <ul className="mt-8 grid gap-4 sm:grid-cols-3">
          {DEMOS.map((demo) => (
            <li key={demo.slug} className="rounded-2xl border border-line bg-paper-raised p-5">
              <h3 className="font-semibold">{demo.name}</h3>
              <p className="mt-2 text-sm text-ink-muted">{demo.summary}</p>
              {demo.status === "coming-soon" && (
                <p className="mt-4 text-xs font-semibold uppercase tracking-wider text-moss">
                  Coming soon
                </p>
              )}
            </li>
          ))}
        </ul>
      </section>

      <section id="offer" className="border-t border-line py-16">
        <h2 className="font-display text-2xl font-semibold">How we work</h2>
        <ol className="mt-8 grid gap-4 sm:grid-cols-2">
          {OFFERS.map((offer, index) => (
            <li key={offer.name} className="rounded-2xl border border-line p-5">
              <p className="text-xs font-semibold text-ink-muted">Step {index + 1}</p>
              <h3 className="mt-1 font-semibold">{offer.name}</h3>
              <p className="mt-2 text-sm text-ink-muted">{offer.summary}</p>
              <p className="mt-3 text-sm font-semibold text-ember">{offer.price}</p>
            </li>
          ))}
        </ol>
      </section>

      <section id="contact" className="border-t border-line py-16">
        <h2 className="font-display text-2xl font-semibold">Talk to an engineer</h2>
        <p className="mt-4 max-w-2xl text-ink-muted">
          A 30-minute call to find the one AI use case that would save your team the most time.
          Booking opens soon.
        </p>
      </section>

      <footer className="border-t border-line py-8 text-sm text-ink-muted">
        © {new Date().getFullYear()} {SITE.name}
      </footer>
    </main>
  );
}
