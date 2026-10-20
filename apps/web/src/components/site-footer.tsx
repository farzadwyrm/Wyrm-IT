import Link from "next/link";
import { NAV, SITE } from "@/lib/site";
import { LogoMark } from "./logo";

export function SiteFooter() {
  return (
    <footer className="border-t border-line">
      <div className="mx-auto grid max-w-6xl gap-8 px-4 py-12 sm:grid-cols-[2fr_1fr_1fr] sm:px-6">
        <div>
          <p className="flex items-center gap-2 font-display text-lg font-semibold">
            <LogoMark className="size-6" />
            {SITE.name}
          </p>
          <p className="mt-3 max-w-sm text-sm text-ink-muted">{SITE.tagline}.</p>
        </div>
        <div>
          <p className="text-sm font-semibold">Explore</p>
          <ul className="mt-3 space-y-2 text-sm text-ink-muted">
            {NAV.map((item) => (
              <li key={item.href}>
                <Link href={item.href} className="hover:text-ink">
                  {item.label}
                </Link>
              </li>
            ))}
            <li>
              <Link href="/blog" className="hover:text-ink">
                Blog
              </Link>
            </li>
          </ul>
        </div>
        <div>
          <p className="text-sm font-semibold">Get in touch</p>
          <ul className="mt-3 space-y-2 text-sm text-ink-muted">
            <li>
              <Link href="/contact" className="hover:text-ink">
                Book a call
              </Link>
            </li>
            {SITE.contactEmail && (
              <li>
                <a href={`mailto:${SITE.contactEmail}`} className="hover:text-ink">
                  {SITE.contactEmail}
                </a>
              </li>
            )}
          </ul>
        </div>
      </div>
      <p className="mx-auto max-w-6xl px-4 pb-8 text-xs text-ink-muted sm:px-6">
        © {new Date().getFullYear()} {SITE.name}
      </p>
    </footer>
  );
}
