import type { ReactNode } from "react";
import { NOTICES } from "@/lib/portal";

/** Small shared pieces for the client area. Server components only. */

export const input =
  "w-full rounded-xl border border-line bg-paper px-3 py-2.5 outline-none focus-visible:border-ember";
export const primary =
  "inline-flex min-h-11 items-center rounded-lg bg-ember px-4 font-semibold text-paper hover:bg-ember-strong";
export const secondary =
  "inline-flex min-h-11 items-center rounded-lg border border-line px-4 font-semibold hover:border-ink-muted";

const ERRORS: Record<string, string> = {
  forbidden: "Your role doesn't allow this.",
  read_only: "This is a view-only session.",
  approval_used: "This request was already decided.",
  approval_expired: "This request expired. Someone should follow up with the customer.",
  reason_required: "Please give a short reason.",
  too_short: "Please write a bit more.",
  not_found: "That item no longer exists.",
  bad_budget: "Enter a monthly budget between $0 and $1,000.",
  tenant_suspended: "Your organisation is suspended.",
  no_turns: "That conversation has no customer messages to test with.",
  unknown: "Something went wrong. Nothing was changed.",
};

export function Notice({ params }: { params: Record<string, string | string[] | undefined> }) {
  const notice = typeof params.notice === "string" ? NOTICES[params.notice] : undefined;
  const error =
    typeof params.error === "string" ? (ERRORS[params.error] ?? ERRORS.unknown) : undefined;
  if (!notice && !error) return null;
  return (
    <p
      role={error ? "alert" : "status"}
      className={`rounded-xl border p-3 ${error ? "border-node-output/50 bg-node-output/10" : "border-moss/50 bg-moss/10"}`}
    >
      {error ?? notice}
    </p>
  );
}

export function PageHeader({
  title,
  intro,
  children,
}: {
  title: string;
  intro?: string;
  children?: ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 className="font-display text-3xl font-semibold tracking-tight">{title}</h1>
        {intro && <p className="mt-2 max-w-2xl text-ink-muted">{intro}</p>}
      </div>
      {children}
    </div>
  );
}

export function Card({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <div className={`rounded-2xl border border-line bg-paper-raised/80 p-5 ${className}`}>
      {children}
    </div>
  );
}

export function Empty({ children }: { children: ReactNode }) {
  return (
    <p className="rounded-2xl border border-dashed border-line p-6 text-ink-muted">{children}</p>
  );
}

export function Badge({
  children,
  tone = "plain",
}: {
  children: ReactNode;
  tone?: "plain" | "good" | "warn" | "bad";
}) {
  const tones = {
    plain: "border-line text-ink-muted",
    good: "border-moss/60 text-moss",
    warn: "border-signal/60 text-signal",
    bad: "border-node-output/60 text-node-output",
  };
  return (
    <span
      className={`inline-flex rounded-full border px-2 py-0.5 text-xs font-semibold ${tones[tone]}`}
    >
      {children}
    </span>
  );
}
