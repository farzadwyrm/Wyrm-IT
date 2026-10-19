"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { NAV } from "@/lib/site";

/** Main navigation links; marks the current page for screen readers and styling. */
export function NavLinks({ className = "" }: { className?: string }) {
  const pathname = usePathname();
  return (
    <ul className={className}>
      {NAV.map((item) => {
        const current = !item.href.includes("#") && pathname.startsWith(item.href);
        return (
          <li key={item.href}>
            <Link
              href={item.href}
              aria-current={current ? "page" : undefined}
              className="block rounded-md px-3 py-2 text-sm font-medium text-ink-muted hover:text-ink aria-[current=page]:text-ink focus-visible:outline-2 focus-visible:outline-ember"
            >
              {item.label}
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
