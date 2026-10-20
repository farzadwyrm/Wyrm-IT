"use client";

import type { StepInput } from "@wyrm/agents";
import { useId } from "react";
import { Multi, Select } from "./fields";
import { ACTORS, DECISIONS, FLAGS, INPUTS, MONEY_BANDS, REVERSIBILITY } from "./options";

/**
 * One step: name and minutes up front; everything the AI guessed (who, where the information
 * comes from, decisions, what's at stake) folded under "More detail" for owners who want it.
 */
export function StepRow({
  step,
  index,
  onChange,
  onRemove,
}: {
  step: StepInput;
  index: number;
  onChange: (s: StepInput) => void;
  onRemove: () => void;
}) {
  const nameId = useId();
  const minutesId = useId();
  const set = (patch: Partial<StepInput>) => onChange({ ...step, ...patch, confirmed: true });

  return (
    <li className="rounded-xl border border-line bg-paper-raised/80">
      <div className="flex items-center gap-3 p-3">
        <span className="w-6 shrink-0 text-center font-mono text-xs text-ember">{index + 1}</span>
        <label htmlFor={nameId} className="sr-only">
          Step {index + 1}
        </label>
        <input
          id={nameId}
          value={step.name}
          maxLength={70}
          placeholder="What happens in this step?"
          onChange={(e) => set({ name: e.target.value })}
          className="min-w-0 flex-1 rounded-lg border border-transparent bg-transparent px-2 py-1.5 outline-none hover:border-line focus-visible:border-ember"
        />
        <label htmlFor={minutesId} className="sr-only">
          Minutes for step {index + 1}
        </label>
        <input
          id={minutesId}
          type="number"
          inputMode="numeric"
          min={0}
          max={600}
          value={step.touchMinutes ?? ""}
          placeholder="min"
          onChange={(e) =>
            set({
              touchMinutes:
                e.target.value === "" ? null : Math.min(600, Math.max(0, Number(e.target.value))),
            })
          }
          className="w-20 shrink-0 rounded-lg border border-line bg-paper px-2 py-1.5 text-right outline-none focus-visible:border-ember"
        />
        <span className="hidden text-sm text-ink-muted sm:inline">min</span>
        <button
          type="button"
          onClick={onRemove}
          aria-label={`Remove step ${index + 1}`}
          className="shrink-0 rounded-md px-2 py-1 text-ink-muted hover:text-node-output"
        >
          ✕
        </button>
      </div>

      <details className="border-t border-line/60 px-3 pb-3 text-sm">
        <summary className="cursor-pointer py-2 pl-9 text-xs text-ink-muted hover:text-ink">
          More detail (optional)
        </summary>
        <div className="space-y-4 pl-9">
          <div className="grid gap-3 sm:grid-cols-3">
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
          </div>
          <div>
            <p className="font-mono text-[11px] uppercase tracking-wider text-ink-muted">
              This step…
            </p>
            <div className="mt-2">
              <Multi
                options={FLAGS}
                value={step.impactFlags}
                onChange={(impactFlags) => set({ impactFlags })}
              />
            </div>
          </div>
          {(step.impactFlags.includes("money") || step.impactFlags.length > 0) && (
            <div className="grid gap-3 sm:grid-cols-2">
              {step.impactFlags.includes("money") && (
                <Select
                  label="Largest amount"
                  options={MONEY_BANDS}
                  value={step.moneyBand ?? "50_500"}
                  onChange={(moneyBand) => set({ moneyBand })}
                />
              )}
              <Select
                label="If it went wrong, could you undo it?"
                options={REVERSIBILITY}
                value={step.reversibility}
                onChange={(reversibility) => set({ reversibility })}
              />
            </div>
          )}
          <label className="flex cursor-pointer items-center gap-2">
            <input
              type="checkbox"
              checked={step.keepHuman}
              onChange={(e) => set({ keepHuman: e.target.checked })}
              className="accent-ember"
            />
            I want a person to always do this step
          </label>
        </div>
      </details>
    </li>
  );
}
