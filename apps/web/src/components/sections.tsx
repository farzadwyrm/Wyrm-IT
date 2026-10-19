import { ButtonLink } from "@wyrm/ui";
import type { ReactNode } from "react";

export function Container({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return <div className={`mx-auto max-w-6xl px-4 sm:px-6 ${className}`}>{children}</div>;
}

/** Top-of-page title block for inner pages. */
export function PageHeader({
  eyebrow,
  title,
  intro,
}: {
  eyebrow: string;
  title: string;
  intro: string;
}) {
  return (
    <Container className="pt-16 pb-10 sm:pt-24">
      <p className="text-sm font-semibold uppercase tracking-wider text-ember">{eyebrow}</p>
      <h1 className="mt-3 max-w-3xl font-display text-4xl font-semibold leading-tight text-balance sm:text-5xl">
        {title}
      </h1>
      <p className="mt-5 max-w-2xl text-lg text-ink-muted text-pretty">{intro}</p>
    </Container>
  );
}

export function SectionTitle({ id, title, intro }: { id?: string; title: string; intro?: string }) {
  return (
    <div className="max-w-2xl">
      <h2 id={id} className="font-display text-3xl font-semibold text-balance">
        {title}
      </h2>
      {intro && <p className="mt-3 text-ink-muted text-pretty">{intro}</p>}
    </div>
  );
}

/** Closing call to action used at the bottom of most pages. */
export function CtaBand() {
  return (
    <Container className="py-16">
      <div className="rounded-3xl bg-ink px-6 py-12 text-paper sm:px-12">
        <h2 className="max-w-2xl font-display text-3xl font-semibold text-balance">
          Not sure where AI fits in your business?
        </h2>
        <p className="mt-4 max-w-2xl text-paper/80">
          Book a free 30-minute call. We will find the one task where AI would save your team the
          most time, and tell you honestly if the answer is "not yet".
        </p>
        <div className="mt-8">
          <ButtonLink href="/contact">Book a free call</ButtonLink>
        </div>
      </div>
    </Container>
  );
}
