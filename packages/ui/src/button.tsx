import type { AnchorHTMLAttributes } from "react";

type Variant = "primary" | "secondary";

const base =
  "inline-flex items-center justify-center rounded-full px-5 py-2.5 text-sm font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ember";

const variants: Record<Variant, string> = {
  primary: "bg-ember text-paper hover:bg-ember-strong",
  secondary: "border border-line text-ink hover:bg-paper-raised",
};

export interface ButtonLinkProps extends AnchorHTMLAttributes<HTMLAnchorElement> {
  variant?: Variant;
}

/** Link styled as a button. Use for navigation and calls to action. */
export function ButtonLink({ variant = "primary", className = "", ...props }: ButtonLinkProps) {
  return <a className={`${base} ${variants[variant]} ${className}`} {...props} />;
}
