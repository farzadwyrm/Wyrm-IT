import type { AnchorHTMLAttributes } from "react";

type Variant = "primary" | "secondary";

const base =
  "inline-flex items-center justify-center rounded-lg px-5 py-2.5 text-sm font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ember";

const variants: Record<Variant, string> = {
  primary: "bg-ember text-paper shadow-[0_0_24px_-6px] shadow-ember/60 hover:bg-ember-strong",
  secondary: "border border-line bg-paper-raised/60 text-ink hover:border-ink-muted",
};

export interface ButtonLinkProps extends AnchorHTMLAttributes<HTMLAnchorElement> {
  variant?: Variant;
}

/** Link styled as a button. Use for navigation and calls to action. */
export function ButtonLink({ variant = "primary", className = "", ...props }: ButtonLinkProps) {
  return <a className={`${base} ${variants[variant]} ${className}`} {...props} />;
}
