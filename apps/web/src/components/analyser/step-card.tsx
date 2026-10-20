"use client";

import type { StepInput } from "@wyrm/agents";
import { useId } from "react";
import { Multi, NumberInput, Select } from "./fields";
import { ACTORS, DECISIONS, FLAGS, INPUTS, MONEY_BANDS, REVERSIBILITY, WAITS } from "./options";

/**
 * One step on the confirmation card (questions 7-15c and 18 of the method). Fields arrive
 * pre-filled from the walk-through; the owner corrects them.
 */
export function StepCard({
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
  const nameId = useId();
  const roleId = useId();
  const ruleId = useId();
  const set = (patch: Partial<StepInput>) => onChange({ ...step, ...patch, confirmed: true });
  const flagged = step.impactFlags.length > 0;

  return (
    <li className="rounded-2xl border border-line bg-paper-raised/80 p-4 sm:p-5">
      <div className="flex items-start gap-3">
        <span className="mt-2 font-mono text-xs text-ember">
          {String(index + 1).padStart(2, "0")}
        </span>
        <div className="min-w-0 flex-1">
          <label htmlFor={nameId} className="sr-only">
            Step {index + 1} name
          </label>
          <input
            id={nameId}
            value={step.name}
            maxLength={70}
            onChange={(e) => set({ name: e.target.value })}
            className="w-full rounded-lg border border-transparent bg-transparent px-2 py-1.5 font-semibold outline-none hover:border-line focus-visible:border-ember"
          />
        </div>
        <div className="flex shrink-0 gap-1">
          <button
            type="button"
            onClick={() => onMove(-1)}
            disabled={index === 0}
            aria-label={`Move step ${index + 1} up`}
            className="rounded-md border border-line px-2 py-1 text-xs disabled:opacity-30"
          >
            ↑
          </button>
          <button
            type="button"
            onClick={() => onMove(1)}
            disabled={index === count - 1}
            aria-label={`Move step ${index + 1} down`}
            className="rounded-md border border-line px-2 py-1 text-xs disabled:opacity-30"
          >
            ↓
          </button>
          <button
            type="button"
            onClick={onRemove}
            aria-label={`Remove step ${index + 1}`}
            className="rounded-md border border-line px-2 py-1 text-xs hover:border-node-output hover:text-node-output"
          >
            ✕
          </button>
        </div>
      </div>

      <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Select
          label="Who does it"
          options={ACTORS}
          value={step.actorType}
          onChange={(actorType) => set({ actorType })}
        />
        <Select
          label="Information comes from"
          options={INPUTS}
          value={step.inputFormat}
          onChange={(inputFormat) => set({ inputFormat })}
        />
        <Select
          label="Decision"
          options={DECISIONS}
          value={step.decisionType}
          onChange={(decisionType) => set({ decisionType })}
        />
        <Select
          label="Then it waits"
          options={WAITS}
          value={step.waitBand}
          onChange={(waitBand) => set({ waitBand })}
        />
      </div>

      {step.actorType === "staff" && (
        <div className="mt-3">
          <label
            htmlFor={roleId}
            className="block font-mono text-[11px] uppercase tracking-wider text-ink-muted"
          >
            Role (not a name)
          </label>
          <input
            id={roleId}
            value={step.actorRole ?? ""}
            maxLength={40}
            placeholder="e.g. office manager"
            onChange={(e) => set({ actorRole: e.target.value || null })}
            className="mt-1 w-full max-w-xs rounded-lg border border-line bg-paper px-3 py-2 text-sm outline-none focus-visible:border-ember"
          />
        </div>
      )}
      {step.decisionType === "fixed_rule" && (
        <div className="mt-3">
          <label
            htmlFor={ruleId}
            className="block font-mono text-[11px] uppercase tracking-wider text-ink-muted"
          >
            The rule
          </label>
          <input
            id={ruleId}
            value={step.decisionRule ?? ""}
            maxLength={160}
            placeholder="e.g. if over 1,000, the owner approves"
            onChange={(e) => set({ decisionRule: e.target.value || null })}
            className="mt-1 w-full rounded-lg border border-line bg-paper px-3 py-2 text-sm outline-none focus-visible:border-ember"
          />
        </div>
      )}

      <div className="mt-4 flex flex-wrap items-center gap-x-8 gap-y-3 text-sm">
        <div className="flex items-center gap-2">
          <span className="text-ink-muted">Hands-on time</span>
          <NumberInput
            label={`Minutes for step ${index + 1}`}
            value={step.touchMinutes}
            onChange={(touchMinutes) => set({ touchMinutes })}
            suffix="min"
            max={600}
          />
        </div>
        <div className="flex items-center gap-2">
          <span className="text-ink-muted">Right first time</span>
          <NumberInput
            label={`Right first time out of 10, step ${index + 1}`}
            value={step.firstPassOutOf10}
            onChange={(firstPassOutOf10) => set({ firstPassOutOf10 })}
            suffix="out of 10"
            max={10}
          />
        </div>
        <label className="flex cursor-pointer items-center gap-2">
          <input
            type="checkbox"
            checked={step.rekeying}
            onChange={(e) => set({ rekeying: e.target.checked })}
            className="accent-ember"
          />
          Copies or re-types data
        </label>
        <label className="flex cursor-pointer items-center gap-2">
          <input
            type="checkbox"
            checked={step.keepHuman}
            onChange={(e) => set({ keepHuman: e.target.checked })}
            className="accent-ember"
          />
          Never let software do this
        </label>
      </div>

      <details className="mt-4 group" open={flagged}>
        <summary className="cursor-pointer font-mono text-[11px] uppercase tracking-wider text-ink-muted">
          What's at stake in this step {flagged ? `(${step.impactFlags.length})` : "(none ticked)"}
        </summary>
        <div className="mt-3 space-y-3">
          <Multi
            options={FLAGS}
            value={step.impactFlags}
            onChange={(impactFlags) => set({ impactFlags })}
          />
          {step.impactFlags.includes("money") && (
            <Select
              label="Largest amount in one go"
              options={MONEY_BANDS}
              value={step.moneyBand ?? "50_500"}
              onChange={(moneyBand) => set({ moneyBand })}
            />
          )}
          {flagged && (
            <Select
              label="If it went wrong, could you undo it?"
              options={REVERSIBILITY}
              value={step.reversibility}
              onChange={(reversibility) => set({ reversibility })}
            />
          )}
        </div>
      </details>
    </li>
  );
}
