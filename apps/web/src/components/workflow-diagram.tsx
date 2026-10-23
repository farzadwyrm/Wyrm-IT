import { STEP_LABELS, type StepKind, type Workflow } from "@wyrm/agents";

/** Full class names per step kind (Tailwind only sees literal class names). */
const KIND_STYLE: Record<StepKind, { text: string; border: string; bg: string }> = {
  trigger: { text: "text-node-trigger", border: "border-node-trigger/50", bg: "bg-node-trigger" },
  agent: { text: "text-node-agent", border: "border-node-agent/50", bg: "bg-node-agent" },
  tool: { text: "text-node-tool", border: "border-node-tool/50", bg: "bg-node-tool" },
  human: { text: "text-node-human", border: "border-node-human/50", bg: "bg-node-human" },
  output: { text: "text-node-output", border: "border-node-output/50", bg: "bg-node-output" },
};

const ICONS: Record<StepKind, string> = {
  // lightning
  trigger: "M13 2 4 14h7l-1 8 9-12h-7l1-8Z",
  // spark / AI
  agent: "M12 3v4M12 17v4M3 12h4M17 12h4M6 6l2.5 2.5M15.5 15.5 18 18M6 18l2.5-2.5M15.5 8.5 18 6",
  // plug / system
  tool: "M9 7V3M15 7V3M7 7h10v4a5 5 0 0 1-10 0V7ZM12 16v5",
  // person
  human: "M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8ZM4 21a8 8 0 0 1 16 0",
  // check
  output: "M5 12.5 10 17 19 7",
};

function KindIcon({ kind }: { kind: StepKind }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className="size-4"
    >
      <path d={ICONS[kind]} />
    </svg>
  );
}

/**
 * An agent workflow as a vertical chain of nodes. Works in server and client components.
 * Colour is never the only signal: each node also has its kind written out and an icon.
 */
export function WorkflowDiagram({
  workflow,
  animate = true,
  compact = false,
}: {
  workflow: Workflow;
  animate?: boolean;
  compact?: boolean;
}) {
  return (
    <figure className="font-sans">
      <figcaption className="sr-only">Workflow: {workflow.title}</figcaption>
      <ol className="relative">
        {workflow.steps.map((step, i) => {
          const style = KIND_STYLE[step.kind];
          const last = i === workflow.steps.length - 1;
          return (
            // biome-ignore lint/suspicious/noArrayIndexKey: steps are a fixed list; labels may repeat
            <li key={i} className={`relative pl-12 ${last ? "" : "pb-4"}`}>
              {!last && (
                <span
                  aria-hidden="true"
                  className="absolute top-9 bottom-0 left-[17px] w-px bg-gradient-to-b from-line to-line/40"
                >
                  {animate && (
                    <span
                      className={`flow-dot absolute -left-[2px] top-0 size-[5px] rounded-full ${style.bg}`}
                      style={{ animationDelay: `${i * 0.3}s` }}
                    />
                  )}
                </span>
              )}
              <span
                aria-hidden="true"
                className={`absolute top-1 left-0 flex size-9 items-center justify-center rounded-lg border bg-paper ${style.border} ${style.text}`}
              >
                <KindIcon kind={step.kind} />
              </span>
              <div
                className={`rounded-xl border border-line bg-paper-raised/80 ${compact ? "px-3 py-2" : "px-4 py-3"}`}
              >
                <p className={`text-xs font-semibold ${style.text}`}>{STEP_LABELS[step.kind]}</p>
                <p className="mt-0.5 font-semibold">{step.label}</p>
                {!compact && step.detail && (
                  <p className="mt-1 text-sm text-ink-muted">{step.detail}</p>
                )}
              </div>
            </li>
          );
        })}
      </ol>
    </figure>
  );
}

/** Integrations and guardrails under a diagram. */
export function WorkflowFacts({ workflow }: { workflow: Workflow }) {
  return (
    <div className="grid gap-6 sm:grid-cols-2">
      <div>
        <h3 className="text-sm font-semibold">Works with</h3>
        <ul className="mt-3 flex flex-wrap gap-2">
          {workflow.integrations.map((name) => (
            <li key={name} className="rounded-md border border-line bg-paper px-2.5 py-1 text-sm">
              {name}
            </li>
          ))}
        </ul>
      </div>
      <div>
        <h3 className="text-sm font-semibold">Always checked</h3>
        <ul className="mt-3 space-y-2 text-sm">
          {workflow.guardrails.map((rule) => (
            <li key={rule} className="flex gap-2">
              <span aria-hidden="true" className="text-node-human">
                ◆
              </span>
              <span className="text-ink-muted">{rule}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
