"use client";

import { useState } from "react";
import { input, secondary } from "../../../classes";

/**
 * Sales setup editor: the offer, who is a good fit, up to five qualifying questions with rated
 * answers, and the "hot" threshold. Posted as JSON in one hidden field and cleaned on the server.
 */

type Rating = "great" | "ok" | "no";
interface Option {
  label: string;
  rating: Rating;
}
interface Question {
  key?: string;
  question: string;
  options: Option[];
}
export interface SalesFormValue {
  offer: string;
  idealCustomer: string;
  notFit: string;
  questions: Question[];
  hotAt: number;
  notFitMessage: string;
}

const RATINGS: [Rating, string][] = [
  ["great", "Great fit (2 points)"],
  ["ok", "Possible (1 point)"],
  ["no", "Not a fit (ends it)"],
];
const POINTS: Record<Rating, number> = { great: 2, ok: 1, no: 0 };
const MAX_QUESTIONS = 5;

function Text({
  label,
  hint,
  value,
  onChange,
  max,
  rows = 2,
}: {
  label: string;
  hint?: string;
  value: string;
  onChange: (v: string) => void;
  max: number;
  rows?: number;
}) {
  return (
    <label className="block">
      <span className="text-sm font-semibold">{label}</span>
      {hint && <span className="block text-sm text-ink-muted">{hint}</span>}
      <textarea
        rows={rows}
        maxLength={max}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={`${input} mt-1`}
      />
    </label>
  );
}

export function SalesForm({ initial }: { initial: SalesFormValue }) {
  const [v, setV] = useState<SalesFormValue>(initial);
  const set = (patch: Partial<SalesFormValue>) => setV((old) => ({ ...old, ...patch }));
  const setQuestion = (i: number, q: Question) =>
    set({ questions: v.questions.map((x, n) => (n === i ? q : x)) });
  const maxPoints = v.questions.reduce((sum, q) => sum + (q.options.length ? 2 : 0), 0);
  const hotAt = Math.min(Math.max(1, v.hotAt || maxPoints || 1), Math.max(maxPoints, 1));

  return (
    <div className="space-y-5">
      <input type="hidden" name="sales_json" value={JSON.stringify({ ...v, hotAt })} />

      <div className="space-y-3 rounded-2xl border border-line bg-paper-raised/80 p-4">
        <h2 className="font-display text-xl font-semibold">What you sell</h2>
        <Text
          label="Your offer"
          hint="What you sell and roughly what it costs. The agent explains it in its own words."
          value={v.offer}
          onChange={(offer) => set({ offer })}
          max={1000}
          rows={3}
        />
        <Text
          label="A good fit"
          hint="Who you want to hear from, e.g. small businesses in Lisbon with a budget over 2,000 EUR."
          value={v.idealCustomer}
          onChange={(idealCustomer) => set({ idealCustomer })}
          max={600}
        />
        <Text
          label="Not a fit (optional)"
          hint="Who you can't help, so the agent doesn't waste their time."
          value={v.notFit}
          onChange={(notFit) => set({ notFit })}
          max={600}
        />
      </div>

      <div className="space-y-3 rounded-2xl border border-line bg-paper-raised/80 p-4">
        <div>
          <h2 className="font-display text-xl font-semibold">Qualifying questions</h2>
          <p className="text-sm text-ink-muted">
            Up to {MAX_QUESTIONS}. The agent asks them naturally. Rate each possible answer: our
            code adds up the points, so the AI can't be talked into a better score.
          </p>
        </div>
        <ol className="space-y-3">
          {v.questions.map((q, i) => (
            <li
              // biome-ignore lint/suspicious/noArrayIndexKey: rows have no id until saved
              key={i}
              className="space-y-2 rounded-xl border border-line bg-paper p-3"
            >
              <label className="block">
                <span className="text-xs font-semibold text-ink-muted">Question {i + 1}</span>
                <input
                  value={q.question}
                  maxLength={200}
                  onChange={(e) => setQuestion(i, { ...q, question: e.target.value })}
                  placeholder="e.g. Roughly what budget do you have in mind?"
                  className={input}
                />
              </label>
              <fieldset className="space-y-2">
                <legend className="text-xs font-semibold text-ink-muted">
                  Possible answers (leave empty for an open question that isn't scored)
                </legend>
                {q.options.map((o, n) => (
                  <div
                    // biome-ignore lint/suspicious/noArrayIndexKey: options have no id
                    key={n}
                    className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_13rem_auto]"
                  >
                    <input
                      value={o.label}
                      maxLength={80}
                      aria-label={`Question ${i + 1}, answer ${n + 1}`}
                      onChange={(e) =>
                        setQuestion(i, {
                          ...q,
                          options: q.options.map((x, m) =>
                            m === n ? { ...x, label: e.target.value } : x,
                          ),
                        })
                      }
                      placeholder="e.g. Over 2,000 EUR"
                      className={input}
                    />
                    <select
                      value={o.rating}
                      aria-label={`Question ${i + 1}, answer ${n + 1} rating`}
                      onChange={(e) =>
                        setQuestion(i, {
                          ...q,
                          options: q.options.map((x, m) =>
                            m === n ? { ...x, rating: e.target.value as Rating } : x,
                          ),
                        })
                      }
                      className={input}
                    >
                      {RATINGS.map(([value, label]) => (
                        <option key={value} value={value}>
                          {label}
                        </option>
                      ))}
                    </select>
                    <button
                      type="button"
                      onClick={() =>
                        setQuestion(i, { ...q, options: q.options.filter((_, m) => m !== n) })
                      }
                      className="text-sm font-semibold text-node-output hover:underline"
                    >
                      Remove<span className="sr-only"> answer {n + 1}</span>
                    </button>
                  </div>
                ))}
                {q.options.length < 6 && (
                  <button
                    type="button"
                    onClick={() =>
                      setQuestion(i, { ...q, options: [...q.options, { label: "", rating: "ok" }] })
                    }
                    className="text-sm font-semibold text-ember hover:underline"
                  >
                    + Add an answer<span className="sr-only"> to question {i + 1}</span>
                  </button>
                )}
              </fieldset>
              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={() => set({ questions: v.questions.filter((_, n) => n !== i) })}
                  className="text-sm font-semibold text-node-output hover:underline"
                >
                  Remove question {i + 1}
                </button>
              </div>
            </li>
          ))}
        </ol>
        {v.questions.length < MAX_QUESTIONS && (
          <button
            type="button"
            onClick={() =>
              set({
                questions: [
                  ...v.questions,
                  {
                    question: "",
                    options: [
                      { label: "", rating: "great" },
                      { label: "", rating: "ok" },
                    ],
                  },
                ],
              })
            }
            className={secondary}
          >
            + Add a question
          </button>
        )}
      </div>

      <div className="space-y-3 rounded-2xl border border-line bg-paper-raised/80 p-4">
        <h2 className="font-display text-xl font-semibold">What happens next</h2>
        <label className="block max-w-sm">
          <span className="text-sm font-semibold">Points for a hot lead</span>
          <span className="block text-sm text-ink-muted">
            Out of {maxPoints || 0}. Hot leads are told someone will call them shortly; the rest are
            told the team will be in touch. Any "not a fit" answer ends it politely.
          </span>
          <input
            type="number"
            min={1}
            max={Math.max(maxPoints, 1)}
            value={hotAt}
            onChange={(e) => set({ hotAt: Number(e.target.value) })}
            className={`${input} mt-1`}
          />
        </label>
        <Text
          label="Message for visitors who aren't a fit"
          value={v.notFitMessage}
          onChange={(notFitMessage) => set({ notFitMessage })}
          max={400}
        />
      </div>
      <p className="text-sm text-ink-muted">
        A great answer is worth {POINTS.great} points, a possible one {POINTS.ok}.
      </p>
    </div>
  );
}
