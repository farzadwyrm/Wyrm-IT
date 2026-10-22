"use client";

import { type ReactNode, useId } from "react";

/** Form controls for the assessment workspace. Every control has a visible label. */

export const control =
  "w-full rounded-lg border border-line bg-paper px-3 py-2 text-sm outline-none placeholder:text-ink-muted/60 focus-visible:border-ember";

const labelStyle = "block text-sm font-semibold";

export function Field({
  label,
  hint,
  required,
  children,
  id,
}: {
  label: string;
  hint?: string | undefined;
  required?: boolean | undefined;
  children: ReactNode;
  id: string;
}) {
  return (
    <div className="space-y-1.5">
      <label htmlFor={id} className={labelStyle}>
        {label}
        {required && (
          <span className="ml-1 text-ember" aria-hidden="true">
            *
          </span>
        )}
      </label>
      {children}
      {hint && <p className="text-xs leading-relaxed text-ink-muted">{hint}</p>}
    </div>
  );
}

export function TextInput({
  label,
  hint,
  value,
  onChange,
  placeholder,
  maxLength = 200,
  required,
}: {
  label: string;
  hint?: string | undefined;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  maxLength?: number;
  required?: boolean | undefined;
}) {
  const id = useId();
  return (
    <Field label={label} hint={hint} required={required} id={id}>
      <input
        id={id}
        value={value}
        maxLength={maxLength}
        placeholder={placeholder}
        required={required}
        onChange={(e) => onChange(e.target.value)}
        className={control}
      />
    </Field>
  );
}

export function TextArea({
  label,
  hint,
  value,
  onChange,
  rows = 3,
  placeholder,
  maxLength = 600,
}: {
  label: string;
  hint?: string | undefined;
  value: string;
  onChange: (v: string) => void;
  rows?: number;
  placeholder?: string;
  maxLength?: number;
}) {
  const id = useId();
  return (
    <Field label={label} hint={hint} id={id}>
      <textarea
        id={id}
        rows={rows}
        value={value}
        maxLength={maxLength}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        className={`${control} leading-relaxed`}
      />
    </Field>
  );
}

export function NumberField({
  label,
  hint,
  value,
  onChange,
  suffix,
  min = 0,
  max = 100000,
  required,
  step,
}: {
  label: string;
  hint?: string | undefined;
  value: number | null;
  onChange: (v: number | null) => void;
  suffix?: string;
  min?: number;
  max?: number;
  required?: boolean | undefined;
  step?: number;
}) {
  const id = useId();
  return (
    <Field label={label} hint={hint} required={required} id={id}>
      <div className="flex items-center gap-2">
        <input
          id={id}
          type="number"
          inputMode="decimal"
          min={min}
          max={max}
          step={step}
          value={value ?? ""}
          onChange={(e) => {
            const n = e.target.value === "" ? null : Number(e.target.value);
            onChange(n === null || Number.isNaN(n) ? null : Math.min(max, Math.max(min, n)));
          }}
          className={`${control} max-w-32 tabular-nums`}
        />
        {suffix && <span className="text-sm text-ink-muted">{suffix}</span>}
      </div>
    </Field>
  );
}

export function Select<T extends string>({
  label,
  hint,
  options,
  value,
  onChange,
  required,
}: {
  label: string;
  hint?: string | undefined;
  options: readonly (readonly [T, string])[];
  value: T;
  onChange: (v: T) => void;
  required?: boolean | undefined;
}) {
  const id = useId();
  return (
    <Field label={label} hint={hint} required={required} id={id}>
      <select
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value as T)}
        className={control}
      >
        {options.map(([v, l]) => (
          <option key={v} value={v}>
            {l}
          </option>
        ))}
      </select>
    </Field>
  );
}

/** Checkbox list; options may carry a one-line description. */
export function CheckGroup<T extends string>({
  legend,
  hint,
  options,
  value,
  onChange,
  columns = 2,
}: {
  legend: string;
  hint?: string | undefined;
  options: readonly (readonly [T, string] | readonly [T, string, string])[];
  value: T[];
  onChange: (v: T[]) => void;
  columns?: 1 | 2 | 3;
}) {
  const grid = { 1: "", 2: "sm:grid-cols-2", 3: "sm:grid-cols-3" }[columns];
  return (
    <fieldset className="space-y-2">
      <legend className={labelStyle}>{legend}</legend>
      {hint && <p className="-mt-1 text-xs text-ink-muted">{hint}</p>}
      <div className={`grid gap-2 ${grid}`}>
        {options.map(([v, label, description]) => (
          <label
            key={v}
            className="flex cursor-pointer items-start gap-2.5 rounded-lg border border-line px-3 py-2 text-sm transition-colors hover:border-ink-muted has-[:checked]:border-ember/70 has-[:checked]:bg-ember/5"
          >
            <input
              type="checkbox"
              checked={value.includes(v)}
              onChange={(e) =>
                onChange(e.target.checked ? [...value, v] : value.filter((x) => x !== v))
              }
              className="mt-0.5 accent-ember"
            />
            <span>
              {label}
              {description && <span className="block text-xs text-ink-muted">{description}</span>}
            </span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}
