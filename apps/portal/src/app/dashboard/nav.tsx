"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { type AgentState, STATE } from "./agent-state";

export interface NavAgent {
  id: string;
  name: string;
  state: AgentState;
}

/** Client-area navigation: a sidebar on wide screens, a scrolling tab row on phones. */
export function DashboardNav({
  business,
  waiting,
  agents,
}: {
  business: string;
  waiting: number;
  agents: NavAgent[];
}) {
  const path = usePathname();
  const agentHref =
    agents.length === 1 ? `/dashboard/agents/${agents[0]?.id}` : "/dashboard/agents";
  const items = [
    { href: "/dashboard", label: "Overview", active: path === "/dashboard", badge: 0 },
    {
      href: "/dashboard/inbox",
      label: "Inbox",
      active: path.startsWith("/dashboard/inbox") || path.startsWith("/dashboard/conversations"),
      badge: waiting,
    },
    {
      href: agentHref,
      label: agents.length > 1 ? "My agents" : "My agent",
      active: path.startsWith("/dashboard/agents"),
      badge: 0,
    },
    {
      href: "/dashboard/settings",
      label: "Settings",
      active: path.startsWith("/dashboard/settings"),
      badge: 0,
    },
  ];

  return (
    <nav aria-label="Client area" className="lg:sticky lg:top-6 lg:self-start">
      <p className="hidden truncate font-display text-lg font-semibold lg:block">{business}</p>
      <p className="hidden font-mono text-[11px] uppercase tracking-wider text-ink-muted lg:block">
        Customer portal
      </p>
      <ul className="-mx-4 flex gap-1 overflow-x-auto border-b border-line px-4 lg:mx-0 lg:mt-5 lg:flex-col lg:border-0 lg:px-0">
        {items.map((item) => (
          <li key={item.label} className="shrink-0">
            <Link
              href={item.href}
              aria-current={item.active ? "page" : undefined}
              className={`flex min-h-11 items-center justify-between gap-3 border-b-2 px-3 text-sm font-semibold lg:rounded-lg lg:border-b-0 ${
                item.active
                  ? "border-ember text-ink lg:bg-paper-raised"
                  : "border-transparent text-ink-muted hover:text-ink lg:hover:bg-paper-raised/60"
              }`}
            >
              {item.label}
              {item.badge > 0 && (
                <span className="rounded-full bg-ember px-2 py-0.5 text-xs text-paper">
                  {item.badge}
                  <span className="sr-only"> waiting</span>
                </span>
              )}
            </Link>
          </li>
        ))}
      </ul>
      {agents.length > 0 && (
        <ul className="mt-6 hidden space-y-1 border-t border-line pt-4 lg:block">
          {agents.map((a) => (
            <li key={a.id}>
              <Link
                href={`/dashboard/agents/${a.id}`}
                className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm hover:bg-paper-raised/60"
              >
                <span
                  aria-hidden="true"
                  className={`size-2 shrink-0 rounded-full ${STATE[a.state].dot}`}
                />
                <span className="min-w-0 flex-1 truncate">{a.name}</span>
                <span className="text-xs text-ink-muted">{STATE[a.state].label}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </nav>
  );
}
