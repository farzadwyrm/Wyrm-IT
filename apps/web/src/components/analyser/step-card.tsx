"use client";

import type { StepInput } from "@wyrm/agents";
import { useId } from "react";
import { CheckGroup, control, Select, TextInput } from "./fields";
import {
  ACTORS,
  DECISIONS,
  FIRST_PASS,
  FLAGS,
  INPUTS,
  MONEY_BANDS,
  REVERSIBILITY,
  WAITS,
} from "./options";

/**
 * One step of the current process, with the metrics the assessment needs: who does it, in
 * which system, what information it works from, the decision involved, hands-on time, wait,
 * right-first-time rate and what is at stake. AI-drafted steps are marked until reviewed.
 */
export function StepEditor({
  step,
  index,
  count,
  onChange,
  onRemove,
  onMove,
}: {
  step: StepInput;
  index: number;
  count: number;
  onChange: (s: StepInput) => void;
  onRemove: () => void;
  onMove: (delta: -1 | 1) => void;
}) {
  const minutesId = useId();
  const set = (patch: Partial<StepInput>) => onChange({ ...step, ...patch, confirmed: true });
  const needsRule = step.decisionType === "fixed_rule" || step.decisionType === "guided_judgement";

  return (
    <li className="rounded-xl border border-line bg-paper-raised/70">
      <div className="flex flex-wrap items-center gap-3 border-b border-line px-4 py-3">
        <span className="font-mono text-xs text-ember">Step {index + 1}</span>
        {!step.confirmed && (
          <span className="rounded-full border border-signal/50 px-2 py-0.5 text-xs text-signal">
            AI-drafted · review
          </span>
        )}
        <span className="ml-auto flex items-center gap-1">
          <button
            type="button"
            onClick={() => onMove(-1)}
            disabled={index === 0}
            aria-label={`Move step ${index + 1} up`}
            className="rounded-md px-2 py-1 text-ink-muted hover:text-ink disabled:opacity-30"
          >
            ↑
          </button>
          <button
            type="button"
            onClick={() => onMove(1)}
            disabled={index === count - 1}
            aria-label={`Move step ${index + 1} down`}
            className="rounded-md px-2 py-1 text-ink-muted hover:text-ink disabled:opacity-30"
          >
            ↓
          </button>
          <button
            type="button"
            onClick={onRemove}
            className="rounded-md px-2 py-1 text-sm text-ink-muted hover:text-node-output"
          >
            Remove
          </button>
        </span>
      </div>

      <div className="space-y-5 p-4">
        <div className="grid gap-4 md:grid-cols-[2fr_1fr_1fr]">
          <TextInput
            label="Activity"
            required
            value={step.name}
            maxLength={70}
            placeholder="e.g. Enter invoice details in Xero"
            onChange={(name) => set({ name })}
          />
          <TextInput
            label="Role"
            hint="A role, not a name"
            value={step.actorRole ?? ""}
            maxLength={40}
            placeholder="e.g. Office manager"
            onChange={(v) => set({ actorRole: v.trim() ? v : null })}
          />
          <Select
            label="Performed by"
            options={ACTORS}
            value={step.actorType}
            onChange={(actorType) => set({ actorType })}
          />
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          <TextInput
            label="Systems used"
            hint="Comma-separated"
            value={step.tools.join(", ")}
            maxLength={120}
            placeholder="e.g. Gmail, Xero"
            onChange={(v) =>
              set({
                tools: v
                  .split(",")
                  .map((t) => t.trimStart())
                  .slice(0, 5),
              })
            }
          />
          <Select
            label="Works from"
            options={INPUTS}
            value={step.inputFormat}
            onChange={(inputFormat) => set({ inputFormat })}
          />
          <Select
            label="Decision involved"
            options={DECISIONS}
            value={step.decisionType}
            onChange={(decisionType) => set({ decisionType })}
          />
        </div>

        {needsRule && (
          <TextInput
            label="Decision rule or guideline"
            hint="What decides the outcome? This becomes the agent's instruction."
            value={step.decisionRule ?? ""}
            maxLength={200}
            placeholder="e.g. Invoices over 1,000 need owner approval"
            onChange={(v) => set({ decisionRule: v.trim() ? v : null })}
          />
        )}

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="space-y-1.5">
            <label htmlFor={minutesId} className="block text-sm font-semibold">
              Hands-on time
            </label>
            <div className="flex items-center gap-2">
              <input
                id={minutesId}
                type="number"
                inputMode="numeric"
                min={0}
                max={600}
                value={step.touchMinutes ?? ""}
                placeholder="5"
                onChange={(e) =>
                  set({
                    touchMinutes:
                      e.target.value === ""
                        ? null
                        : Math.min(600, Math.max(0, Number(e.target.value))),
                  })
                }
                className={`${control} max-w-24 tabular-nums`}
              />
              <span className="text-sm text-ink-muted">min per case</span>
            </div>
          </div>
          <Select
            label="Wait before next step"
            options={WAITS}
            value={step.waitBand}
            onChange={(waitBand) => set({ waitBand })}
          />
          <Select
            label="Right first time"
            hint="Out of the last 10 cases"
            options={FIRST_PASS}
            value={step.firstPassOutOf10 === null ? "" : String(Math.max(5, step.firstPassOutOf10))}
            onChange={(v) => set({ firstPassOutOf10: v === "" ? null : Number(v) })}
          />
          <label className="flex cursor-pointer items-start gap-2.5 self-end rounded-lg border border-line px-3 py-2 text-sm has-[:checked]:border-ember/70 has-[:checked]:bg-ember/5">
            <input
              type="checkbox"
              checked={step.rekeying}
              onChange={(e) => set({ rekeying: e.target.checked })}
              className="mt-0.5 accent-ember"
            />
            <span>
              Data is re-keyed
              <span className="block text-xs text-ink-muted">Copied from one place to another</span>
            </span>
          </label>
        </div>

        <details
          className="group rounded-lg border border-line/70 px-3 py-2"
          open={step.impactFlags.length > 0}
        >
          <summary className="cursor-pointer text-sm font-semibold">
            Consequences and controls
            <span className="ml-2 font-normal text-ink-muted">
              {step.impactFlags.length
                ? `${step.impactFlags.length} selected`
                : "Sets the risk tier and human checks"}
            </span>
          </summary>
          <div className="mt-3 space-y-4 pb-1">
            <CheckGroup
              legend="This step…"
              options={FLAGS}
              value={step.impactFlags}
              onChange={(impactFlags) => set({ impactFlags })}
            />
            <div className="grid gap-4 sm:grid-cols-2">
              {step.impactFlags.includes("money") && (
                <Select
                  label="Largest amount per case"
                  options={MONEY_BANDS}
                  value={step.moneyBand ?? "50_500"}
                  onChange={(moneyBand) => set({ moneyBand })}
                />
              )}
              <Select
                label="If done wrong"
                options={REVERSIBILITY}
                value={step.reversibility}
                onChange={(reversibility) => set({ reversibility })}
              />
            </div>
            <label className="flex cursor-pointer items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={step.keepHuman}
                onChange={(e) => set({ keepHuman: e.target.checked })}
                className="accent-ember"
              />
              Keep this step with a person, whatever the assessment says
            </label>
          </div>
        </details>

        {!step.confirmed && (
          <button
            type="button"
            onClick={() => set({})}
            className="text-sm font-semibold text-ember hover:text-ember-strong"
          >
            Mark as reviewed
          </button>
        )}
      </div>
    </li>
  );
}
