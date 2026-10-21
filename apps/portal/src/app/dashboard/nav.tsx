"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const ITEMS = [
  { href: "/dashboard", label: "Home" },
  { href: "/dashboard/conversations", label: "Conversations" },
  { href: "/dashboard/todo", label: "To-do" },
  { href: "/dashboard/teach", label: "Teach" },
  { href: "/dashboard/agents", label: "Agents" },
  { href: "/dashboard/settings", label: "Settings" },
] as const;

export function DashboardNav({ todo }: { todo: number }) {
  const path = usePathname();
  return (
    <nav aria-label="Client area" className="-mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
      <ul className="flex min-w-max gap-1 border-b border-line">
        {ITEMS.map((item) => {
          const active =
            item.href === "/dashboard" ? path === item.href : path.startsWith(item.href);
          return (
            <li key={item.href}>
              <Link
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={`inline-flex min-h-11 items-center gap-2 border-b-2 px-3 text-sm font-semibold ${
                  active
                    ? "border-ember text-ink"
                    : "border-transparent text-ink-muted hover:text-ink"
                }`}
              >
                {item.label}
                {item.href === "/dashboard/todo" && todo > 0 && (
                  <span className="rounded-full bg-ember px-2 py-0.5 text-xs text-paper">
                    {todo}
                    <span className="sr-only"> waiting</span>
                  </span>
                )}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
