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
  no_turns: "There are no customer messages to test with.",
  not_ready: "Finish the required steps (and Wyrm's sign-off) before going live.",
  bad_url: "That doesn't look like a public website address.",
  unreachable: "We couldn't open that website. Check the address and try again.",
  blocked_robots: "That website asks automated readers not to visit, so we didn't.",
  nothing_found: "We couldn't find readable text on that website.",
  no_model: "The AI service is busy. Try again in a minute.",
  calendar_off: "Calendar booking isn't switched on yet.",
  calendar_denied: "Google access wasn't granted.",
  calendar_failed: "Connecting the calendar didn't work. Try again.",
  calendar_no_token: "Google didn't give lasting access. Try connecting again.",
  tests_failed:
    "A required test failed, so nothing was published. Check the results below, fix the policy or the test, then publish again.",
  note_required: "Say briefly what changed: a few words are enough.",
  bad_rule: "A rule is 5 to 300 characters.",
  rule_limit: "An agent can have up to 15 rules. Remove or merge one first.",
  already_added: "That procedure is already added.",
  bad_procedure: "Describe when to use the procedure in a sentence.",
  bad_template: "Unknown procedure.",
  no_file: "Choose at least one file.",
  too_big: "That file is too big. Upload files up to 4 MB, or split the document.",
  unsupported:
    "That file type isn't supported. Use PDF, Word (.docx), text, Markdown, CSV or HTML.",
  unreadable: "We couldn't read that file. If it's a scanned PDF, export it with text first.",
  empty_document: "We couldn't find readable text in that document.",
  too_many_sources: "This agent has the most documents it can hold. Remove some first.",
  knowledge_full: "This agent's document space is full. Remove some documents first.",
  bad_name: "Give it a name.",
  drive_denied: "Google Drive didn't allow access to that file.",
  bad_file: "That file wasn't found in Google Drive.",
  agent_paused: "This agent is paused.",
  bad_level: "Choose an access level.",
  connection_failed: "The check didn't pass, so the agent won't use this connection yet:",
  connector: "The connection didn't work:",
  not_read_only:
    "Only reading is allowed. Use a single SELECT, or an account without write permissions.",
  microsoft_off: "Microsoft sign-in isn't switched on yet.",
  microsoft_denied: "Microsoft access wasn't granted.",
  microsoft_failed: "Signing in with Microsoft didn't work. Try again.",
  bad_host: "Enter the server's public host name (not a private or local address).",
  bad_port: "Enter a valid port.",
  bad_config: "Fill in all the connection details.",
  bad_secret: "That password or token is too long.",
  bad_type: "Choose a type.",
  bad_param: "Check the value names and types.",
  missing_param: "A value the lookup needs is missing.",
  bad_object: "Choose contacts, companies, deals or tickets.",
  no_lookups: "This connection is searched automatically: no lookups needed.",
  too_many_lookups: "This agent has the most lookups it can hold.",
  bad_description: "Say when the agent should use it, in a sentence.",
  secret_unreadable: "The saved password or token can't be read. Enter it again.",
  unknown: "Something went wrong. Nothing was changed.",
};

/** Badge colour for a conversation result. */
export const outcomeTone = (o: string | null) =>
  o === "booked" || o === "lead" || o === "resolved_confirmed"
    ? "good"
    : o === "handed_off"
      ? "warn"
      : o === "failed"
        ? "bad"
        : "plain";

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
