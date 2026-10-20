"use client";

import Link from "next/link";
import { type FormEvent, useCallback, useEffect, useId, useRef, useState } from "react";
import { WorkflowDiagram, WorkflowFacts } from "@/components/workflow-diagram";
import type { PlanRequest, PlanResponse } from "@/lib/plan-api";

const EXAMPLES = [
  "We miss phone calls while we're with customers",
  "Every Monday we type supplier invoices into Xero",
  "New website leads wait a day before anyone replies",
  "Customers keep asking where their order is on WhatsApp",
];

type State =
  | { kind: "idle" }
  | { kind: "busy"; task: string }
  | { kind: "done"; task: string; result: PlanResponse };

/**
 * The AI workflow planner: a visitor describes a task, the server designs an agent workflow,
 * and it is drawn as a diagram. Takes a first task from `?q=` (the home page's input).
 */
export function WorkflowPlanner() {
  const [input, setInput] = useState("");
  const [state, setState] = useState<State>({ kind: "idle" });
  const inputId = useId();
  const resultRef = useRef<HTMLDivElement>(null);
  const busy = state.kind === "busy";

  const plan = useCallback(async (raw: string) => {
    const task = raw.trim().slice(0, 600);
    if (task.length < 3) return;
    setState({ kind: "busy", task });
    let result: PlanResponse;
    try {
      const response = await fetch("/api/plan", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ task } satisfies PlanRequest),
      });
      result = (await response.json()) as PlanResponse;
    } catch {
      result = { status: "error" };
    }
    setState({ kind: "done", task, result });
    resultRef.current?.focus();
  }, []);

  const started = useRef(false);
  useEffect(() => {
    if (started.current) return;
    started.current = true;
    const q = new URLSearchParams(window.location.search).get("q");
    if (q) {
      setInput(q);
      void plan(q);
    }
  }, [plan]);

  const onSubmit = (event: FormEvent) => {
    event.preventDefault();
    if (!busy) void plan(input);
  };

  return (
    <div className="grid gap-8 lg:grid-cols-[1fr_1.15fr]">
      <div>
        <form
          onSubmit={onSubmit}
          className="rounded-2xl border border-line bg-paper-raised/80 p-5 focus-within:border-ember/60"
        >
          <label
            htmlFor={inputId}
            className="font-mono text-xs uppercase tracking-wider text-signal"
          >
            Describe a task your team does by hand
          </label>
          <textarea
            id={inputId}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                if (!busy) void plan(input);
              }
            }}
            maxLength={600}
            rows={4}
            placeholder="e.g. Customers email us for quotes and we write each one by hand…"
            className="mt-3 w-full resize-none bg-transparent text-lg outline-none placeholder:text-ink-muted/60"
          />
          <div className="mt-3 flex items-center justify-between gap-3">
            <p className="text-xs text-ink-muted">No names, passwords or customer data, please.</p>
            <button
              type="submit"
              disabled={busy || input.trim().length < 3}
              className="rounded-lg bg-ember px-4 py-2 text-sm font-semibold text-paper hover:bg-ember-strong disabled:opacity-50"
            >
              {busy ? "Designing…" : "Design workflow"}
            </button>
          </div>
        </form>

        <p className="mt-6 font-mono text-xs uppercase tracking-wider text-ink-muted">
          Or try an example
        </p>
        <ul className="mt-3 space-y-2">
          {EXAMPLES.map((example) => (
            <li key={example}>
              <button
                type="button"
                disabled={busy}
                onClick={() => {
                  setInput(example);
                  void plan(example);
                }}
                className="w-full rounded-xl border border-line px-4 py-3 text-left text-sm hover:border-ember/60 disabled:opacity-50"
              >
                {example}
              </button>
            </li>
          ))}
        </ul>
      </div>

      <div
        ref={resultRef}
        tabIndex={-1}
        aria-live="polite"
        aria-busy={busy}
        className="min-h-80 rounded-3xl border border-line bg-paper/60 p-5 outline-none sm:p-8"
      >
        {state.kind === "idle" && (
          <div className="flex h-full min-h-72 flex-col items-center justify-center text-center text-ink-muted">
            <p className="font-mono text-xs uppercase tracking-wider">awaiting task</p>
            <p className="mt-2 max-w-xs text-sm">
              Your agent workflow appears here: trigger, agent steps, systems, human checks and
              guardrails.
            </p>
          </div>
        )}
        {state.kind === "busy" && (
          <div className="flex h-full min-h-72 flex-col items-center justify-center text-center">
            <p className="font-mono text-xs uppercase tracking-wider text-signal motion-safe:animate-pulse">
              designing workflow…
            </p>
            <p className="mt-2 max-w-sm text-sm text-ink-muted">“{state.task}”</p>
          </div>
        )}
        {state.kind === "done" && <PlanResult result={state.result} />}
      </div>
    </div>
  );
}

function PlanResult({ result }: { result: PlanResponse }) {
  if (result.status !== "ok") {
    const message =
      result.status === "off_topic"
        ? "That doesn't look like a business task an agent could take on. Try describing something your team does every week."
        : result.status === "unavailable"
          ? "The AI is resting right now. Try one of the examples, or describe the task with words like calls, email, invoices, leads or support."
          : "Something went wrong. Please try again in a moment.";
    return <p className="text-ink-muted">{message}</p>;
  }
  const { workflow, agent, provider } = result;
  return (
    <div>
      <p className="font-mono text-xs uppercase tracking-wider text-signal">
        {provider === "claude" || provider === "groq"
          ? "designed by AI for your task"
          : "closest standard agent workflow"}
      </p>
      <h2 className="mt-2 font-display text-2xl font-semibold tracking-tight">{workflow.title}</h2>
      <div className="mt-6">
        <WorkflowDiagram workflow={workflow} />
      </div>
      <div className="mt-8 border-t border-line pt-6">
        <WorkflowFacts workflow={workflow} />
      </div>
      <div className="mt-8 flex flex-wrap gap-x-6 gap-y-2 text-sm font-semibold">
        <Link href="/contact" className="text-ember hover:text-ember-strong">
          Build this with us →
        </Link>
        {agent && (
          <Link href={agent.href} className="text-ink-muted hover:text-ink">
            See the {agent.name.toLowerCase()} →
          </Link>
        )}
      </div>
      <p className="mt-4 text-xs text-ink-muted">
        A first sketch from AI. We refine every workflow with your team before building it.
      </p>
    </div>
  );
}
