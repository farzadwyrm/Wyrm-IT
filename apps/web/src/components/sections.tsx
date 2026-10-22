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

/** Small monospace label above headings, e.g. "// agents". */
export function Eyebrow({ children }: { children: ReactNode }) {
  return (
    <p className="font-mono text-xs font-medium uppercase tracking-[0.2em] text-signal">
      <span aria-hidden="true" className="text-ink-muted">
        {"// "}
      </span>
      {children}
    </p>
  );
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
    <Container className="pt-16 pb-10 sm:pt-24 print:hidden">
      <Eyebrow>{eyebrow}</Eyebrow>
      <h1 className="mt-4 max-w-3xl font-display text-4xl font-semibold leading-[1.05] tracking-tight text-balance sm:text-6xl">
        {title}
      </h1>
      <p className="mt-6 max-w-2xl text-lg text-ink-muted text-pretty">{intro}</p>
    </Container>
  );
}

export function SectionTitle({
  id,
  eyebrow,
  title,
  intro,
}: {
  id?: string;
  eyebrow?: string;
  title: string;
  intro?: string;
}) {
  return (
    <div className="max-w-2xl">
      {eyebrow && <Eyebrow>{eyebrow}</Eyebrow>}
      <h2
        id={id}
        className="mt-3 font-display text-3xl font-semibold tracking-tight text-balance sm:text-4xl"
      >
        {title}
      </h2>
      {intro && <p className="mt-4 text-ink-muted text-pretty">{intro}</p>}
    </div>
  );
}

/** Closing call to action used at the bottom of most pages. */
export function CtaBand() {
  return (
    <Container className="py-20 print:hidden">
      <div className="relative overflow-hidden rounded-3xl border border-ember/30 bg-paper-raised px-6 py-12 sm:px-12">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -top-24 -right-24 size-72 rounded-full bg-ember/20 blur-3xl"
        />
        <Eyebrow>next step</Eyebrow>
        <h2 className="mt-3 max-w-2xl font-display text-3xl font-semibold tracking-tight text-balance">
          Which workflow should your first agent run?
        </h2>
        <p className="mt-4 max-w-2xl text-ink-muted">
          Book a free 30-minute call. We map one workflow with you, show how an agent would run it,
          and tell you honestly if it is worth automating.
        </p>
        <div className="mt-8 flex flex-wrap gap-3">
          <ButtonLink href="/contact">Book a free call</ButtonLink>
          <ButtonLink href="/analyse" variant="secondary">
            Analyse a workflow now
          </ButtonLink>
        </div>
      </div>
    </Container>
  );
}
