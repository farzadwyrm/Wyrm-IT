import { isSqlKind, listConnectionCalls, listConnections, listLookups } from "@wyrm/core";
import type { Metadata } from "next";
import { microsoftConfig } from "@/lib/connectors/sharepoint";
import { requireTenant, when } from "@/lib/portal";
import { Badge, Card, Empty, input, Notice, secondary } from "../../../ui";
import {
  chooseLibraryAction,
  deleteConnectionAction,
  deleteLookupAction,
  saveConnectionAction,
  saveLookupAction,
  syncAction,
  testConnectionAction,
  toggleConnectionAction,
} from "./actions";
import { AddConnectionForm, LibraryPicker, ShowTables, TryLookup } from "./widgets";

export const metadata: Metadata = { title: "Connections" };

const KIND_LABELS: Record<string, string> = {
  postgres: "PostgreSQL",
  mysql: "MySQL",
  sqlserver: "SQL Server",
  hubspot: "HubSpot CRM",
  sharepoint: "SharePoint",
  search_api: "Search API",
};
const STATUS = {
  ok: { label: "Read-only ✓", tone: "good" },
  untested: { label: "Not checked", tone: "warn" },
  error: { label: "Problem", tone: "bad" },
  disabled: { label: "Off", tone: "plain" },
} as const;

/**
 * Connections: read-only links from this agent to the client's own systems. Owners and admins
 * manage them; the agent only runs approved lookups on connections that passed the read-only check.
 */
export default async function ConnectionsPage({
  params,
  searchParams,
}: PageProps<"/dashboard/agents/[id]/connections">) {
  const page = await requireTenant();
  const { id } = await params;
  const query = await searchParams;
  if (!page.can("agents.configure", id))
    return <Empty>Only people who manage this agent can see its connections.</Empty>;
  const [connections, lookups, calls] = await Promise.all([
    listConnections(page.ctx, page.tenantId, id),
    listLookups(page.ctx, page.tenantId, id),
    page.can("agents.logs", id)
      ? listConnectionCalls(page.ctx, page.tenantId, id, 20)
      : Promise.resolve([]),
  ]);
  const canManage =
    page.can("security.manage") && page.can("agents.configure", id) && !page.readOnly;
  const hidden = <input type="hidden" name="agentId" value={id} />;
  const detail = typeof query.detail === "string" ? query.detail.slice(0, 200) : "";
  const synced =
    query.notice === "synced"
      ? `Synced: ${query.added ?? 0} added or updated, ${query.removed ?? 0} removed${
          Number(query.failed ?? 0) ? `, ${query.failed} couldn't be read` : ""
        }${Number(query.remaining ?? 0) ? `. ${query.remaining} more to go: press Sync again.` : "."}`
      : "";

  return (
    <div className="space-y-6">
      <div className="max-w-3xl space-y-2">
        <p className="text-ink-muted">
          Let the agent answer from your live systems: databases, your CRM, SharePoint or your own
          search service. Everything here is <strong>read only</strong>:
        </p>
        <ul className="list-disc space-y-1 pl-5 text-sm text-ink-muted">
          <li>
            Wyrm checks each account when you connect it and refuses one that can change data.
          </li>
          <li>
            The agent can only run the lookups you approve below. It picks one and fills in values
            from the question; it never writes its own queries.
          </li>
          <li>Each lookup reads at most 50 rows within 5 seconds, and every use is logged.</li>
          <li>Passwords and tokens are encrypted and can't be viewed again.</li>
        </ul>
      </div>
      <Notice params={query} />
      {(detail || synced) && (
        <p role="status" className="text-sm text-ink-muted">
          {synced || detail}
        </p>
      )}
      {!canManage && (
        <p className="rounded-xl border border-line p-3 text-sm">
          Only owners and admins can connect systems. You can see what's connected below.
        </p>
      )}

      {connections.length === 0 ? (
        <Empty>No connections yet.{canManage ? " Add one below." : ""}</Empty>
      ) : (
        <ul className="space-y-4">
          {connections.map((c) => {
            const mine = lookups.filter((l) => l.connectionId === c.id);
            const status = STATUS[c.status];
            const sql = isSqlKind(c.kind);
            return (
              <li key={c.id}>
                <Card className="space-y-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="font-display text-lg font-semibold">
                        {c.name}{" "}
                        <span className="text-sm font-normal text-ink-muted">
                          · {KIND_LABELS[c.kind]}
                        </span>
                      </p>
                      <p className="text-sm text-ink-muted">
                        {sql
                          ? `${String(c.config.user)}@${String(c.config.host)}:${String(c.config.port)}/${String(c.config.database)}`
                          : c.kind === "search_api"
                            ? String(c.config.url)
                            : c.kind === "sharepoint"
                              ? c.config.driveName
                                ? `${String(c.config.siteName)} › ${String(c.config.driveName)}${c.config.folderPath ? ` › ${String(c.config.folderPath)}` : ""} (${String(c.config.account ?? "")})`
                                : c.hasSecret
                                  ? `Signed in as ${String(c.config.account ?? "Microsoft account")}. Choose a library.`
                                  : "Not signed in yet."
                              : "Private app token"}
                      </p>
                    </div>
                    <Badge tone={status.tone}>{status.label}</Badge>
                  </div>
                  {c.checkNote && c.status === "ok" && (
                    <p className="text-sm text-moss">{c.checkNote}</p>
                  )}
                  {c.lastError && <p className="text-sm text-node-output">{c.lastError}</p>}
                  {c.lastCheckedAt && (
                    <p className="text-xs text-ink-muted">Last checked {when(c.lastCheckedAt)}</p>
                  )}

                  {canManage && (
                    <div className="flex flex-wrap gap-2">
                      {c.kind === "sharepoint" && (
                        <a
                          href={`/api/connections/microsoft/connect?agent=${id}&connection=${c.id}`}
                          className={secondary}
                        >
                          {c.hasSecret ? "Sign in again" : "Sign in with Microsoft"}
                        </a>
                      )}
                      {c.status !== "disabled" && (
                        <form action={testConnectionAction}>
                          {hidden}
                          <input type="hidden" name="id" value={c.id} />
                          <button type="submit" className={secondary}>
                            Check again
                          </button>
                        </form>
                      )}
                      {c.kind === "sharepoint" && c.status === "ok" && (
                        <form action={syncAction}>
                          {hidden}
                          <input type="hidden" name="id" value={c.id} />
                          <button type="submit" className={secondary}>
                            Sync now
                          </button>
                        </form>
                      )}
                      <form action={toggleConnectionAction}>
                        {hidden}
                        <input type="hidden" name="id" value={c.id} />
                        <input
                          type="hidden"
                          name="enabled"
                          value={c.status === "disabled" ? "1" : "0"}
                        />
                        <button type="submit" className={secondary}>
                          {c.status === "disabled" ? "Turn on" : "Turn off"}
                        </button>
                      </form>
                      <form action={deleteConnectionAction}>
                        {hidden}
                        <input type="hidden" name="id" value={c.id} />
                        <button
                          type="submit"
                          className="min-h-11 px-3 text-sm text-ink-muted hover:text-node-output"
                        >
                          Remove
                        </button>
                      </form>
                    </div>
                  )}

                  {canManage && c.kind === "sharepoint" && c.hasSecret && (
                    <LibraryPicker
                      agentId={id}
                      connectionId={c.id}
                      action={chooseLibraryAction}
                      current={String(c.config.driveId ?? "")}
                    />
                  )}

                  {canManage && c.status !== "disabled" && sql && c.hasSecret && (
                    <ShowTables agentId={id} connectionId={c.id} />
                  )}

                  {(sql || c.kind === "hubspot") && (
                    <div className="space-y-3 border-t border-line pt-4">
                      <h3 className="font-semibold">Approved lookups ({mine.length})</h3>
                      {mine.length === 0 && (
                        <p className="text-sm text-ink-muted">
                          None yet. The agent can't read anything from this connection until you
                          approve a lookup.
                        </p>
                      )}
                      <ul className="space-y-3">
                        {mine.map((l) => (
                          <li key={l.id} className="space-y-2 rounded-xl border border-line p-3">
                            <div className="flex flex-wrap items-center justify-between gap-2">
                              <p className="font-semibold">{l.name}</p>
                              {canManage && (
                                <form action={deleteLookupAction}>
                                  {hidden}
                                  <input type="hidden" name="id" value={l.id} />
                                  <button
                                    type="submit"
                                    className="text-xs text-ink-muted hover:text-node-output"
                                  >
                                    Remove
                                  </button>
                                </form>
                              )}
                            </div>
                            <p className="text-sm text-ink-muted">Used when: {l.description}</p>
                            <pre className="overflow-x-auto rounded-lg bg-paper p-2 font-mono text-xs whitespace-pre-wrap">
                              {sql ? l.query : `Search HubSpot ${l.query}`}
                            </pre>
                            {canManage && c.status === "ok" && (
                              <TryLookup agentId={id} lookupId={l.id} params={l.params} />
                            )}
                          </li>
                        ))}
                      </ul>
                      {canManage && (
                        <form
                          action={saveLookupAction}
                          className="space-y-2 rounded-xl border border-dashed border-line p-3"
                        >
                          {hidden}
                          <input type="hidden" name="connectionId" value={c.id} />
                          <p className="text-sm font-semibold">Approve a new lookup</p>
                          <div className="grid gap-2 sm:grid-cols-2">
                            <label>
                              <span className="text-xs font-semibold">Name</span>
                              <input
                                name="name"
                                required
                                minLength={3}
                                maxLength={80}
                                className={input}
                                placeholder="Order status"
                              />
                            </label>
                            <label>
                              <span className="text-xs font-semibold">Use it when…</span>
                              <input
                                name="description"
                                required
                                minLength={10}
                                maxLength={300}
                                className={input}
                                placeholder="someone asks where an order is"
                              />
                            </label>
                          </div>
                          {sql ? (
                            <>
                              <label className="block">
                                <span className="text-xs font-semibold">
                                  One SELECT. Put values the agent fills in as :name
                                </span>
                                <textarea
                                  name="query"
                                  required
                                  rows={3}
                                  maxLength={4000}
                                  className={`${input} font-mono text-xs`}
                                  placeholder="SELECT status, shipped_on FROM orders_v WHERE order_no = :order_no"
                                />
                              </label>
                              <label className="block">
                                <span className="text-xs font-semibold">
                                  Value types (optional): name:text, name:number or name:date
                                </span>
                                <input
                                  name="params"
                                  maxLength={300}
                                  className={input}
                                  placeholder="order_no:text"
                                />
                              </label>
                            </>
                          ) : (
                            <label className="block">
                              <span className="text-xs font-semibold">Search in</span>
                              <select name="query" className={input}>
                                <option value="contacts">Contacts</option>
                                <option value="companies">Companies</option>
                                <option value="deals">Deals</option>
                                <option value="tickets">Tickets</option>
                              </select>
                            </label>
                          )}
                          <button type="submit" className={secondary}>
                            Approve lookup
                          </button>
                        </form>
                      )}
                    </div>
                  )}
                  {c.kind === "search_api" && (
                    <p className="border-t border-line pt-4 text-sm text-ink-muted">
                      Searched automatically with every question (no lookups needed). Your service
                      receives the question and the asker's email, so it can apply their own
                      permissions.
                    </p>
                  )}
                </Card>
              </li>
            );
          })}
        </ul>
      )}

      {canManage && (
        <Card className="space-y-3">
          <h2 className="font-display text-xl font-semibold">Add a connection</h2>
          <AddConnectionForm
            agentId={id}
            action={saveConnectionAction}
            microsoft={Boolean(microsoftConfig())}
          />
        </Card>
      )}

      {calls.length > 0 && (
        <div className="space-y-3">
          <h2 className="font-display text-xl font-semibold">Recent lookups</h2>
          <div className="overflow-x-auto rounded-2xl border border-line">
            <table className="w-full min-w-[560px] text-left text-sm">
              <caption className="sr-only">Lookups the agent ran recently</caption>
              <thead className="bg-paper-raised font-mono text-[11px] uppercase tracking-wider text-ink-muted">
                <tr>
                  <th scope="col" className="px-4 py-3">
                    When
                  </th>
                  <th scope="col" className="px-4 py-3">
                    Lookup
                  </th>
                  <th scope="col" className="px-4 py-3">
                    Values
                  </th>
                  <th scope="col" className="px-4 py-3 text-right">
                    Rows
                  </th>
                  <th scope="col" className="px-4 py-3">
                    Result
                  </th>
                </tr>
              </thead>
              <tbody>
                {calls.map(({ call, lookup, connection }) => (
                  <tr key={call.id} className="border-t border-line">
                    <td className="px-4 py-2 text-ink-muted">{when(call.createdAt)}</td>
                    <td className="px-4 py-2">{lookup ?? connection ?? "Removed"}</td>
                    <td className="px-4 py-2 font-mono text-xs">
                      {Object.entries(call.params)
                        .map(([k, v]) => `${k}=${v}`)
                        .join(", ")}
                    </td>
                    <td className="px-4 py-2 text-right">{call.rows}</td>
                    <td className="px-4 py-2">
                      {call.ok ? (
                        <Badge tone="good">ok · {call.ms} ms</Badge>
                      ) : (
                        <span className="text-xs text-node-output">{call.error}</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
