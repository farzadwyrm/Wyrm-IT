import Link from "next/link";
import { SITE } from "@/lib/site";

/** Wyrm AI mark: a single serpent stroke forming a "W", with an ember eye. */
export function LogoMark({ className = "size-8" }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={className} aria-hidden="true" focusable="false">
      <path
        d="M3 10 C5 10 6 12 7 15 L10 23 L16 11 L22 23 L25 15 C26 12 27 9 29.5 9"
        fill="none"
        stroke="currentColor"
        strokeWidth="3"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="29" cy="9" r="2.2" className="fill-ember" />
    </svg>
  );
}

export function Logo() {
  return (
    <Link
      href="/"
      className="inline-flex items-center gap-2 rounded-md font-display text-xl font-semibold tracking-tight focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ember"
    >
      <LogoMark />
      <span>{SITE.name}</span>
    </Link>
  );
}
