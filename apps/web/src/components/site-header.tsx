import { ButtonLink } from "@wyrm/ui";
import { Logo } from "./logo";
import { NavLinks } from "./nav-links";

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-20 border-b border-line bg-paper/90 backdrop-blur">
      <nav
        aria-label="Main"
        className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3 sm:px-6"
      >
        <Logo />

        <NavLinks className="hidden items-center gap-1 md:flex" />

        <div className="flex items-center gap-2">
          {/* Always visible, including on phones: it is the main call to action. */}
          <ButtonLink href="/contact">Book a call</ButtonLink>

          {/* Mobile menu: no JavaScript needed. */}
          <details className="group relative md:hidden">
            <summary className="flex cursor-pointer list-none items-center rounded-md border border-line px-3 py-2 text-sm font-medium [&::-webkit-details-marker]:hidden">
              Menu
            </summary>
            <div className="absolute right-0 mt-2 w-56 rounded-xl border border-line bg-paper-raised p-2 shadow-lg">
              <NavLinks />
            </div>
          </details>
        </div>
      </nav>
    </header>
  );
}
