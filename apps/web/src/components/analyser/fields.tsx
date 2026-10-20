"use client";

import { type ReactNode, useId } from "react";

/** Small form controls shared by the analyser. Labels are always visible text. */

export function Question({
  title,
  hint,
  children,
}: {
  title: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <fieldset className="space-y-3">
      <legend className="font-semibold">{title}</legend>
      {hint && <p className="-mt-1 text-sm text-ink-muted">{hint}</p>}
      {children}
    </fieldset>
  );
}

const chip =
  "rounded-lg border px-3 py-2 text-left text-sm transition-colors has-[:checked]:border-ember has-[:checked]:bg-ember/10 has-[:checked]:text-ink has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-ember border-line text-ink-muted hover:border-ink-muted";

export function Choice<T extends string>({
  options,
  value,
  onChange,
  name,
}: {
  options: readonly (readonly [T, string])[];
  value: T | null;
  onChange: (v: T) => void;
  name: string;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map(([v, label]) => (
        <label key={v} className={`${chip} cursor-pointer`}>
          <input
            type="radio"
            name={name}
            className="sr-only"
            checked={value === v}
            onChange={() => onChange(v)}
          />
          {label}
        </label>
      ))}
    </div>
  );
}

export function Multi<T extends string>({
  options,
  value,
  onChange,
}: {
  options: readonly (readonly [T, string])[];
  value: T[];
  onChange: (v: T[]) => void;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map(([v, label]) => (
        <label key={v} className={`${chip} cursor-pointer`}>
          <input
            type="checkbox"
            className="sr-only"
            checked={value.includes(v)}
            onChange={(e) =>
              onChange(e.target.checked ? [...value, v] : value.filter((x) => x !== v))
            }
          />
          {label}
        </label>
      ))}
    </div>
  );
}

export function NumberInput({
  label,
  value,
  onChange,
  suffix,
  min = 0,
  max = 100000,
}: {
  label: string;
  value: number | null;
  onChange: (v: number | null) => void;
  suffix?: string;
  min?: number;
  max?: number;
}) {
  const id = useId();
  return (
    <div className="flex items-center gap-2">
      <label htmlFor={id} className="sr-only">
        {label}
      </label>
      <input
        id={id}
        type="number"
        inputMode="decimal"
        min={min}
        max={max}
        value={value ?? ""}
        placeholder="?"
        onChange={(e) => {
          const n = e.target.value === "" ? null : Number(e.target.value);
          onChange(n === null || Number.isNaN(n) ? null : Math.min(max, Math.max(min, n)));
        }}
        className="w-24 rounded-lg border border-line bg-paper px-3 py-2 outline-none focus-visible:border-ember"
      />
      {suffix && <span className="text-sm text-ink-muted">{suffix}</span>}
    </div>
  );
}

export function TextArea({
  label,
  value,
  onChange,
  rows = 3,
  placeholder,
  maxLength = 600,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  rows?: number;
  placeholder?: string;
  maxLength?: number;
}) {
  const id = useId();
  return (
    <div>
      <label htmlFor={id} className="sr-only">
        {label}
      </label>
      <textarea
        id={id}
        rows={rows}
        value={value}
        maxLength={maxLength}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-xl border border-line bg-paper px-4 py-3 outline-none placeholder:text-ink-muted/60 focus-visible:border-ember"
      />
    </div>
  );
}

export function Select<T extends string>({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: readonly (readonly [T, string])[];
  value: T;
  onChange: (v: T) => void;
}) {
  const id = useId();
  return (
    <div className="space-y-1">
      <label
        htmlFor={id}
        className="block font-mono text-[11px] uppercase tracking-wider text-ink-muted"
      >
        {label}
      </label>
      <select
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value as T)}
        className="w-full rounded-lg border border-line bg-paper px-2 py-2 text-sm outline-none focus-visible:border-ember"
      >
        {options.map(([v, l]) => (
          <option key={v} value={v}>
            {l}
          </option>
        ))}
      </select>
    </div>
  );
}
