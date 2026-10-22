"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";

/** The My agent sections. Studio sections share one page and switch with `?tab=`. */
export function AgentTabs({
  agentId,
  conflicts,
  type,
}: {
  agentId: string;
  conflicts: number;
  type: string;
}) {
  const path = usePathname();
  const tab = useSearchParams().get("tab") ?? "facts";
  const base = `/dashboard/agents/${agentId}`;
  const studio = (key: string) => ({ href: `${base}/studio?tab=${key}`, key });
  type Item = { label: string; href: string; key: string; badge?: number };
  const knowledge: Item[] = [
    { label: "Ask", href: `${base}/ask`, key: "ask" },
    { label: "Documents", href: `${base}/documents`, key: "documents" },
    { label: "Questions", href: `${base}/questions`, key: "questions" },
    { label: "Rules", ...studio("rules"), badge: conflicts },
    { label: "Limits & handoff", ...studio("limits") },
    { label: "Go live", href: `${base}/launch`, key: "launch" },
    { label: "History", ...studio("changes") },
  ];
  const items: Item[] =
    type === "knowledge"
      ? knowledge
      : [
          { label: "Business info", ...studio("facts") },
          { label: "Answers", href: `${base}/answers`, key: "answers" },
          { label: "Rules", ...studio("rules"), badge: conflicts },
          { label: "Tasks & booking", ...studio("procedures") },
          { label: "Limits & handoff", ...studio("limits") },
          { label: "Try & test", ...studio("tests") },
          { label: "Go live", href: `${base}/launch`, key: "launch" },
          { label: "History", ...studio("changes") },
        ];
  const isActive = (key: string, href: string) =>
    href.includes("/studio?")
      ? path.endsWith("/studio") && tab === key
      : path === href.split("?")[0];

  return (
    <nav aria-label="Agent sections" className="-mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
      <ul className="flex min-w-max gap-1 border-b border-line">
        {items.map((t) => {
          const active = isActive(t.key, t.href);
          return (
            <li key={t.key}>
              <Link
                href={t.href}
                aria-current={active ? "page" : undefined}
                className={`inline-flex min-h-11 items-center gap-2 border-b-2 px-3 text-sm font-semibold ${
                  active
                    ? "border-ember text-ink"
                    : "border-transparent text-ink-muted hover:text-ink"
                }`}
              >
                {t.label}
                {t.badge ? (
                  <span className="rounded-full border border-signal/60 px-1.5 text-xs text-signal">
                    {t.badge}
                    <span className="sr-only"> conflicts</span>
                  </span>
                ) : null}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
