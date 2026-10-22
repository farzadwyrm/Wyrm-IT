"use client";

import { useState } from "react";
import { input, secondary } from "../../../classes";

/**
 * Row editors for the business facts the agent quotes: services and prices, frequent questions
 * and locations. Each list is posted as JSON in one hidden field and cleaned on the server.
 */

type Row = Record<string, string>;

interface Column {
  key: string;
  label: string;
  placeholder: string;
  /** Grid width class; long text spans the whole row. */
  wide?: boolean;
  max: number;
}

const SERVICE_COLUMNS: Column[] = [
  { key: "name", label: "Service or product", placeholder: "Check-up and clean", max: 80 },
  { key: "price", label: "Price", placeholder: "€65 or from €30", max: 40 },
  { key: "duration", label: "Duration", placeholder: "30 min", max: 40 },
  {
    key: "description",
    label: "Details (optional)",
    placeholder: "What's included, who it's for",
    wide: true,
    max: 300,
  },
];
const FAQ_COLUMNS: Column[] = [
  { key: "question", label: "Question", placeholder: "Is there parking?", wide: true, max: 200 },
  {
    key: "answer",
    label: "Answer",
    placeholder: "Yes, free parking behind the building.",
    wide: true,
    max: 600,
  },
];
const LOCATION_COLUMNS: Column[] = [
  { key: "name", label: "Name (optional)", placeholder: "City centre", max: 80 },
  { key: "address", label: "Address", placeholder: "12 Harbour Street", wide: true, max: 200 },
];

/** Starting points by type of business. Examples only: the owner edits every value. */
const STARTERS: Record<string, { label: string; services: Row[]; faqs: Row[] }> = {
  dental: {
    label: "Dental or medical clinic",
    services: [
      { name: "Check-up and clean", price: "€65", duration: "30 min", description: "" },
      { name: "Whitening", price: "from €250", duration: "60 min", description: "" },
      { name: "Emergency appointment", price: "€80", duration: "30 min", description: "" },
    ],
    faqs: [
      { question: "Do you take new patients?", answer: "Yes, we welcome new patients." },
      { question: "How do I pay?", answer: "Card or cash at reception after the visit." },
    ],
  },
  salon: {
    label: "Hair or beauty salon",
    services: [
      { name: "Women's cut and blow-dry", price: "€45", duration: "60 min", description: "" },
      { name: "Men's cut", price: "€25", duration: "30 min", description: "" },
      { name: "Full colour", price: "from €70", duration: "120 min", description: "" },
    ],
    faqs: [
      {
        question: "What if I'm late?",
        answer: "We keep your slot for 10 minutes, then we may need to rebook.",
      },
    ],
  },
  garage: {
    label: "Garage or repair shop",
    services: [
      { name: "Annual service", price: "from €150", duration: "3 hours", description: "" },
      { name: "Tyre change (set of 4)", price: "€40 fitting", duration: "45 min", description: "" },
      { name: "Diagnostic check", price: "€50", duration: "60 min", description: "" },
    ],
    faqs: [
      {
        question: "Can I wait while the work is done?",
        answer: "Yes, for jobs under an hour. Longer jobs: drop the car off in the morning.",
      },
    ],
  },
  restaurant: {
    label: "Restaurant or café",
    services: [
      { name: "Table booking", price: "", duration: "90 min", description: "Up to 8 people" },
      { name: "Lunch menu", price: "€14", duration: "", description: "Starter, main and coffee" },
    ],
    faqs: [
      {
        question: "Do you have vegetarian options?",
        answer: "Yes, several dishes every day.",
      },
    ],
  },
  shop: {
    label: "Shop or online store",
    services: [
      { name: "Standard delivery", price: "€4.95", duration: "2–4 days", description: "" },
      { name: "Click and collect", price: "Free", duration: "Same day", description: "" },
    ],
    faqs: [
      {
        question: "What is your returns policy?",
        answer: "Return unused items within 30 days for a full refund.",
      },
    ],
  },
};

const blank = (columns: Column[]): Row => Object.fromEntries(columns.map((c) => [c.key, ""]));
const filled = (rows: Row[], columns: Column[]) =>
  rows.filter((r) => columns.some((c) => (r[c.key] ?? "").trim()));

function RowList({
  name,
  title,
  hint,
  columns,
  rows,
  setRows,
  addLabel,
  max,
}: {
  name: string;
  title: string;
  hint: string;
  columns: Column[];
  rows: Row[];
  setRows: (rows: Row[]) => void;
  addLabel: string;
  max: number;
}) {
  const update = (i: number, key: string, value: string) =>
    setRows(rows.map((r, n) => (n === i ? { ...r, [key]: value } : r)));
  const move = (i: number, by: number) => {
    const next = [...rows];
    const [row] = next.splice(i, 1);
    if (row) next.splice(i + by, 0, row);
    setRows(next);
  };
  return (
    <div className="space-y-3">
      <input type="hidden" name={name} value={JSON.stringify(filled(rows, columns))} />
      <div>
        <h2 className="font-display text-xl font-semibold">{title}</h2>
        <p className="text-sm text-ink-muted">{hint}</p>
      </div>
      {rows.length === 0 && <p className="text-sm text-ink-muted">Nothing added yet.</p>}
      <ol className="space-y-3">
        {rows.map((row, i) => (
          <li
            // biome-ignore lint/suspicious/noArrayIndexKey: rows have no id until saved
            key={i}
            className="rounded-xl border border-line bg-paper p-3"
          >
            <fieldset className="grid gap-2 sm:grid-cols-3">
              <legend className="sr-only">
                {title} {i + 1}
              </legend>
              {columns.map((c) => (
                <label key={c.key} className={c.wide ? "sm:col-span-3" : ""}>
                  <span className="text-xs font-semibold text-ink-muted">{c.label}</span>
                  <input
                    value={row[c.key] ?? ""}
                    maxLength={c.max}
                    onChange={(e) => update(i, c.key, e.target.value)}
                    placeholder={c.placeholder}
                    aria-label={`${c.label} ${i + 1}`}
                    className={input}
                  />
                </label>
              ))}
            </fieldset>
            <div className="mt-2 flex justify-end gap-3 text-sm">
              <button
                type="button"
                disabled={i === 0}
                onClick={() => move(i, -1)}
                className="text-ink-muted hover:text-ink disabled:opacity-40"
              >
                Move up<span className="sr-only"> {i + 1}</span>
              </button>
              <button
                type="button"
                onClick={() => setRows(rows.filter((_, n) => n !== i))}
                className="font-semibold text-node-output hover:underline"
              >
                Remove<span className="sr-only"> {i + 1}</span>
              </button>
            </div>
          </li>
        ))}
      </ol>
      {rows.length < max && (
        <button
          type="button"
          onClick={() => setRows([...rows, blank(columns)])}
          className={secondary}
        >
          + {addLabel}
        </button>
      )}
    </div>
  );
}

export function ProfileLists({
  services,
  faqs,
  locations,
}: {
  services: Row[];
  faqs: Row[];
  locations: Row[];
}) {
  const [serviceRows, setServices] = useState<Row[]>(services);
  const [faqRows, setFaqs] = useState<Row[]>(faqs);
  const [locationRows, setLocations] = useState<Row[]>(locations);
  const empty = serviceRows.length === 0 && faqRows.length === 0;

  return (
    <>
      {empty && (
        <div className="rounded-2xl border border-dashed border-line p-4">
          <h2 className="font-semibold">Start from an example</h2>
          <p className="text-sm text-ink-muted">
            Fills in typical services and questions for your type of business. Change every price
            and answer to your own before you publish.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            {Object.entries(STARTERS).map(([key, s]) => (
              <button
                key={key}
                type="button"
                onClick={() => {
                  setServices(s.services.map((r) => ({ ...r })));
                  setFaqs(s.faqs.map((r) => ({ ...r })));
                }}
                className={secondary}
              >
                {s.label}
              </button>
            ))}
          </div>
        </div>
      )}
      <div className="rounded-2xl border border-line bg-paper-raised/80 p-4">
        <RowList
          name="services_json"
          title="Services and prices"
          hint="The agent quotes these exactly and never makes up a price. Write prices the way you say them."
          columns={SERVICE_COLUMNS}
          rows={serviceRows}
          setRows={setServices}
          addLabel="Add a service"
          max={50}
        />
      </div>
      <div className="rounded-2xl border border-line bg-paper-raised/80 p-4">
        <RowList
          name="faqs_json"
          title="Frequent questions"
          hint="Questions customers ask, with your answer."
          columns={FAQ_COLUMNS}
          rows={faqRows}
          setRows={setFaqs}
          addLabel="Add a question"
          max={40}
        />
      </div>
      <div className="rounded-2xl border border-line bg-paper-raised/80 p-4">
        <RowList
          name="locations_json"
          title="Locations"
          hint="Where customers find you."
          columns={LOCATION_COLUMNS}
          rows={locationRows}
          setRows={setLocations}
          addLabel="Add a location"
          max={10}
        />
      </div>
    </>
  );
}
