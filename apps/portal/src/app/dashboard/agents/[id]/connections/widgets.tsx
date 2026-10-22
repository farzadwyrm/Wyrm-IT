"use client";

import { useState } from "react";
import { librariesAction, tablesAction, tryLookupAction } from "./actions";

const input =
  "w-full rounded-xl border border-line bg-paper px-3 py-2.5 outline-none focus-visible:border-ember";
const secondary =
  "inline-flex min-h-11 items-center rounded-lg border border-line px-4 font-semibold hover:border-ink-muted disabled:opacity-60";

const TYPES = [
  ["postgres", "PostgreSQL database"],
  ["mysql", "MySQL / MariaDB database"],
  ["sqlserver", "Microsoft SQL Server database"],
  ["hubspot", "HubSpot CRM"],
  ["sharepoint", "SharePoint / OneDrive"],
  ["search_api", "Your own search API"],
] as const;

const HELP: Record<string, string> = {
  postgres:
    "Create a user that can only SELECT (see the setup guide). Wyrm checks it can't change anything before using it.",
  mysql: "Create a user with SELECT only on the database or views Wyrm should read.",
  sqlserver: "Create a login with db_datareader (or SELECT on chosen views) and nothing else.",
  hubspot:
    "In HubSpot: Settings → Integrations → Private apps → Create, choose only “read” scopes, then paste the access token.",
  sharepoint:
    "After saving, sign in with Microsoft. Wyrm asks only for read access and copies the text of the library you choose.",
  search_api:
    "Wyrm POSTs each question to your https address, signed with the secret, and your service returns passages.",
};

/** "Add a connection" with the fields each type needs. The secret field is write-only. */
export function AddConnectionForm({
  agentId,
  action,
  microsoft,
}: {
  agentId: string;
  action: (form: FormData) => void;
  microsoft: boolean;
}) {
  const [kind, setKind] = useState<string>("postgres");
  const sql = kind === "postgres" || kind === "mysql" || kind === "sqlserver";
  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="agentId" value={agentId} />
      <div className="grid gap-3 sm:grid-cols-2">
        <label>
          <span className="text-sm font-semibold">System</span>
          <select
            name="kind"
            value={kind}
            onChange={(e) => setKind(e.target.value)}
            className={input}
          >
            {TYPES.map(([value, label]) => (
              <option key={value} value={value} disabled={value === "sharepoint" && !microsoft}>
                {label}
                {value === "sharepoint" && !microsoft ? " (being switched on)" : ""}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span className="text-sm font-semibold">Name</span>
          <input
            name="name"
            required
            maxLength={80}
            className={input}
            placeholder="e.g. Orders database"
          />
        </label>
      </div>
      <p className="text-sm text-ink-muted">{HELP[kind]}</p>
      {sql && (
        <div className="grid gap-3 sm:grid-cols-4">
          <label className="sm:col-span-2">
            <span className="text-sm font-semibold">Host</span>
            <input
              name="host"
              required
              maxLength={200}
              className={input}
              placeholder="db.yourcompany.com"
            />
          </label>
          <label>
            <span className="text-sm font-semibold">Port</span>
            <input
              name="port"
              inputMode="numeric"
              maxLength={5}
              className={input}
              placeholder={kind === "postgres" ? "5432" : kind === "mysql" ? "3306" : "1433"}
            />
          </label>
          <label>
            <span className="text-sm font-semibold">Database</span>
            <input name="database" required maxLength={128} className={input} />
          </label>
          <label className="sm:col-span-2">
            <span className="text-sm font-semibold">Read-only user</span>
            <input
              name="user"
              required
              maxLength={128}
              className={input}
              placeholder="wyrm_readonly"
              autoComplete="off"
            />
          </label>
        </div>
      )}
      {kind === "search_api" && (
        <label className="block">
          <span className="text-sm font-semibold">Search address (https)</span>
          <input
            name="url"
            required
            maxLength={500}
            className={input}
            placeholder="https://search.yourcompany.com/wyrm"
          />
        </label>
      )}
      {kind !== "sharepoint" && (
        <label className="block">
          <span className="text-sm font-semibold">
            {sql
              ? "Password"
              : kind === "hubspot"
                ? "Private app access token"
                : "Shared secret (at least 32 characters)"}
          </span>
          <input
            name="secret"
            type="password"
            required
            maxLength={4000}
            minLength={kind === "search_api" ? 32 : 1}
            autoComplete="new-password"
            className={input}
          />
          <span className="text-xs text-ink-muted">
            Stored encrypted. Nobody can see it again, including Wyrm staff.
          </span>
        </label>
      )}
      <button
        type="submit"
        className="inline-flex min-h-11 items-center rounded-lg bg-ember px-4 font-semibold text-paper hover:bg-ember-strong"
      >
        {kind === "sharepoint"
          ? "Save, then sign in with Microsoft"
          : "Save and check it's read-only"}
      </button>
    </form>
  );
}

/** "Try it" for a lookup: run it with sample values and show the rows the agent would read. */
export function TryLookup({
  agentId,
  lookupId,
  params,
}: {
  agentId: string;
  lookupId: string;
  params: { name: string; label: string; type: string }[];
}) {
  const [values, setValues] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ rows?: Record<string, unknown>[]; error?: string } | null>(
    null,
  );
  async function run() {
    setBusy(true);
    const r = await tryLookupAction(agentId, lookupId, values).catch(() => null);
    setBusy(false);
    setResult(
      !r ? { error: "Something went wrong." } : r.ok ? { rows: r.data } : { error: r.error },
    );
  }
  const columns = result?.rows?.[0] ? Object.keys(result.rows[0]) : [];
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-end gap-2">
        {params.map((p) => (
          <label key={p.name}>
            <span className="text-xs font-semibold">{p.label}</span>
            <input
              type={p.type === "date" ? "date" : p.type === "number" ? "number" : "text"}
              value={values[p.name] ?? ""}
              onChange={(e) => setValues((v) => ({ ...v, [p.name]: e.target.value }))}
              className={`${input} py-2`}
            />
          </label>
        ))}
        <button type="button" onClick={run} disabled={busy} className={secondary}>
          {busy ? "Running…" : "Try it"}
        </button>
      </div>
      {result?.error && (
        <p role="alert" className="text-sm text-node-output">
          {result.error}
        </p>
      )}
      {result?.rows &&
        (result.rows.length === 0 ? (
          <p className="text-sm text-ink-muted">No matching records.</p>
        ) : (
          <div className="max-h-64 overflow-auto rounded-xl border border-line">
            <table className="w-full text-left text-xs">
              <thead className="bg-paper-raised">
                <tr>
                  {columns.map((c) => (
                    <th key={c} scope="col" className="px-2 py-1.5 font-mono">
                      {c}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {result.rows.slice(0, 20).map((row, i) => (
                  // biome-ignore lint/suspicious/noArrayIndexKey: rows have no id
                  <tr key={i} className="border-t border-line">
                    {columns.map((c) => (
                      <td key={c} className="px-2 py-1.5">
                        {String(row[c] ?? "")}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ))}
    </div>
  );
}

/** Lists the tables and columns the read-only user can see (helps write a lookup). */
export function ShowTables({ agentId, connectionId }: { agentId: string; connectionId: string }) {
  const [busy, setBusy] = useState(false);
  const [tables, setTables] = useState<{ name: string; columns: string[] }[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  async function load() {
    setBusy(true);
    const r = await tablesAction(agentId, connectionId).catch(() => null);
    setBusy(false);
    if (r?.ok) setTables(r.data);
    else setError(r?.error ?? "Something went wrong.");
  }
  return (
    <div className="space-y-2">
      <button type="button" onClick={load} disabled={busy} className={secondary}>
        {busy ? "Loading…" : "Show tables Wyrm can read"}
      </button>
      {error && <p className="text-sm text-node-output">{error}</p>}
      {tables && (
        <ul className="max-h-64 space-y-1 overflow-auto rounded-xl border border-line p-3 font-mono text-xs">
          {tables.length === 0 && <li>No tables visible to this user.</li>}
          {tables.map((t) => (
            <li key={t.name}>
              <strong>{t.name}</strong>: {t.columns.join(", ")}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/** Loads the Microsoft account's document libraries, then saves the chosen one. */
export function LibraryPicker({
  agentId,
  connectionId,
  action,
  current,
}: {
  agentId: string;
  connectionId: string;
  action: (form: FormData) => void;
  current: string;
}) {
  const [busy, setBusy] = useState(false);
  const [libs, setLibs] = useState<
    { siteId: string; siteName: string; driveId: string; driveName: string }[] | null
  >(null);
  const [error, setError] = useState<string | null>(null);
  async function load() {
    setBusy(true);
    const r = await librariesAction(agentId, connectionId).catch(() => null);
    setBusy(false);
    if (r?.ok) setLibs(r.data);
    else setError(r?.error ?? "Something went wrong.");
  }
  if (!libs)
    return (
      <div className="space-y-2">
        <button type="button" onClick={load} disabled={busy} className={secondary}>
          {busy ? "Loading libraries…" : current ? "Change library" : "Choose a document library"}
        </button>
        {error && <p className="text-sm text-node-output">{error}</p>}
      </div>
    );
  return (
    <form action={action} className="flex flex-wrap items-end gap-2">
      <input type="hidden" name="agentId" value={agentId} />
      <input type="hidden" name="id" value={connectionId} />
      <label className="min-w-64 flex-1">
        <span className="text-xs font-semibold">Library</span>
        <select name="library" required className={input}>
          {libs.map((l) => (
            <option key={l.driveId} value={`${l.siteId}|${l.driveId}|${l.siteName}|${l.driveName}`}>
              {l.siteName} › {l.driveName}
            </option>
          ))}
        </select>
      </label>
      <label>
        <span className="text-xs font-semibold">Folder (optional)</span>
        <input name="folderPath" maxLength={300} className={input} placeholder="Policies/HR" />
      </label>
      <button type="submit" className={secondary}>
        Use this library
      </button>
    </form>
  );
}
