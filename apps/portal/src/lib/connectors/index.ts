import "server-only";
import {
  type AgentConnection,
  addKnowledgeSource,
  type Ctx,
  coerceParam,
  decryptToken,
  deleteKnowledgeSource,
  isSqlKind,
  type KnowledgeDeps,
  listKnowledgeSources,
  listLookups,
  openConnection,
  recordConnectionCheck,
  storeConnectionSecret,
} from "@wyrm/core";
import { checkHubspot, searchHubspot } from "./hubspot";
import { checkSearchApi, querySearchApi } from "./search-api";
import { listFiles, listLibraries, readFile, refreshAccess, writeScopes } from "./sharepoint";
import {
  type CheckResult,
  ConnectorError,
  checkSql,
  listSqlTables,
  runSql,
  type SqlConfig,
} from "./sql";

export { ConnectorError } from "./sql";

/** Connection secrets are encrypted with a key derived from the server's Supabase secret key. */
export function connectionKey() {
  const key = process.env.SUPABASE_SECRET_KEY?.trim();
  if (!key) throw new ConnectorError("The server isn't configured to store secrets.");
  return key;
}

const sqlConfig = (c: Pick<AgentConnection, "config">): SqlConfig => ({
  host: String(c.config.host ?? ""),
  port: Number(c.config.port ?? 0),
  database: String(c.config.database ?? ""),
  user: String(c.config.user ?? ""),
});

function secretOf(c: AgentConnection) {
  if (!c.secretEnc) throw new ConnectorError("No password or token is saved.");
  return decryptToken(c.secretEnc, connectionKey());
}

/** Tests a connection (including the read-only check) and records the result. */
export async function testConnection(
  ctx: Ctx,
  input: { tenantId: string; agentId: string; id: string },
): Promise<CheckResult> {
  const { connection, secret } = await openConnection(
    ctx,
    { ...input, encryptionKey: connectionKey() },
    "manage",
  );
  let result: CheckResult;
  if (!secret) result = { ok: false, note: "", error: "Save the password or token first." };
  else if (isSqlKind(connection.kind))
    result = await checkSql(connection.kind, sqlConfig(connection), secret);
  else if (connection.kind === "hubspot") result = await checkHubspot(secret);
  else if (connection.kind === "search_api")
    result = await checkSearchApi(String(connection.config.url ?? ""), secret);
  else {
    // SharePoint: refresh the sign-in and make sure a library is chosen.
    try {
      const t = await refreshAccess(secret);
      const writes = writeScopes(t.scope ?? "");
      if (writes.length)
        result = {
          ok: false,
          note: "",
          error: "The sign-in has write permissions. Sign in again.",
        };
      else if (!connection.config.driveId)
        result = { ok: false, note: "", error: "Choose a document library first." };
      else
        result = {
          ok: true,
          note: `Read-only Microsoft sign-in (${String(connection.config.account ?? "account")}), library ${String(connection.config.driveName ?? "")}.`,
        };
      if (t.refresh_token && t.refresh_token !== secret)
        await storeConnectionSecret(ctx, {
          ...input,
          secret: t.refresh_token,
          encryptionKey: connectionKey(),
        });
    } catch (e) {
      result = {
        ok: false,
        note: "",
        error: e instanceof ConnectorError ? e.message : "Sign-in check failed.",
      };
    }
  }
  await recordConnectionCheck(ctx, {
    ...input,
    ok: result.ok,
    note: result.note,
    error: result.error ?? null,
  });
  return result;
}

/** Runs any approved lookup (SQL or CRM) for the agent. */
export async function runLookup(input: {
  connection: AgentConnection;
  lookup: { query: string };
  values: Record<string, string | number>;
}) {
  const { connection, lookup, values } = input;
  return runWith(connection, secretOf(connection), lookup.query, values);
}

function runWith(
  connection: Pick<AgentConnection, "kind" | "config">,
  secret: string,
  query: string,
  values: Record<string, string | number>,
) {
  if (isSqlKind(connection.kind))
    return runSql(connection.kind, sqlConfig(connection), secret, query, values);
  if (connection.kind === "hubspot")
    return searchHubspot(secret, query, String(values.search ?? ""));
  throw new ConnectorError("This connection has no lookups.");
}

/** Runs a lookup with sample values for the manager ("Try it"): owners and admins only. */
export async function tryLookup(
  ctx: Ctx,
  input: { tenantId: string; agentId: string; lookupId: string; values: Record<string, string> },
) {
  const lookup = (await listLookups(ctx, input.tenantId, input.agentId)).find(
    (l) => l.id === input.lookupId,
  );
  if (!lookup) throw new ConnectorError("That lookup no longer exists.");
  const { connection, secret } = await openConnection(
    ctx,
    {
      tenantId: input.tenantId,
      agentId: input.agentId,
      id: lookup.connectionId,
      encryptionKey: connectionKey(),
    },
    "manage",
  );
  const typed: Record<string, string | number> = {};
  for (const param of lookup.params)
    typed[param.name] = coerceParam(param, input.values?.[param.name]);
  return runWith(connection, secret, lookup.query, typed);
}

/** Live parts of "Ask your documents" for one asking person (their email goes to search APIs). */
export function liveDeps(user: string | null): Pick<KnowledgeDeps, "runLookup" | "searchApi"> {
  return {
    runLookup,
    searchApi: (connection, question) =>
      querySearchApi(String(connection.config.url ?? ""), secretOf(connection), question, user),
  };
}

/**
 * Copies new or changed files from the chosen SharePoint library into the agent's documents
 * (at most 15 files per run, so one click stays within the server's time limit).
 */
export async function syncSharePoint(
  ctx: Ctx,
  input: { tenantId: string; agentId: string; id: string },
): Promise<{ added: number; skipped: number; removed: number; remaining: number; failed: number }> {
  const { connection, secret } = await openConnection(
    ctx,
    { ...input, encryptionKey: connectionKey() },
    "manage",
  );
  if (connection.kind !== "sharepoint") throw new ConnectorError("Not a SharePoint connection.");
  if (connection.status !== "ok") throw new ConnectorError("Test the connection first.");
  const driveId = String(connection.config.driveId ?? "");
  if (!driveId) throw new ConnectorError("Choose a document library first.");
  const t = await refreshAccess(secret);
  if (t.refresh_token && t.refresh_token !== secret)
    await storeConnectionSecret(ctx, {
      ...input,
      secret: t.refresh_token,
      encryptionKey: connectionKey(),
    });
  const { files, complete } = await listFiles(
    t.access_token,
    driveId,
    String(connection.config.folderPath ?? ""),
  );
  const existing = (await listKnowledgeSources(ctx, input.tenantId, input.agentId)).filter((s) =>
    s.location?.startsWith(`sharepoint:${connection.id}:`),
  );
  const known = new Map(existing.map((s) => [s.location as string, s]));
  const todo = files.filter((f) => {
    const s = known.get(`sharepoint:${connection.id}:${f.id}`);
    return !s || s.updatedAt < f.modified;
  });
  let added = 0;
  let failed = 0;
  for (const f of todo.slice(0, 15)) {
    try {
      const text = await readFile(t.access_token, driveId, f);
      await addKnowledgeSource(ctx, {
        tenantId: input.tenantId,
        agentId: input.agentId,
        kind: "upload",
        name: f.path,
        location: `sharepoint:${connection.id}:${f.id}`,
        mime: f.mime,
        text,
      });
      added += 1;
    } catch {
      failed += 1;
    }
  }
  // Files removed from the library are removed here too (only after a full listing).
  let removed = 0;
  if (complete) {
    const present = new Set(files.map((f) => `sharepoint:${connection.id}:${f.id}`));
    for (const s of existing)
      if (!present.has(s.location as string)) {
        await deleteKnowledgeSource(ctx, {
          tenantId: input.tenantId,
          agentId: input.agentId,
          sourceId: s.id,
        });
        removed += 1;
      }
  }
  return {
    added,
    skipped: files.length - todo.length,
    removed,
    remaining: Math.max(0, todo.length - 15),
    failed,
  };
}

/** Document libraries the connected Microsoft account can read (to choose one). */
export async function sharePointLibraries(
  ctx: Ctx,
  input: { tenantId: string; agentId: string; id: string },
) {
  const { connection, secret } = await openConnection(
    ctx,
    { ...input, encryptionKey: connectionKey() },
    "manage",
  );
  if (connection.kind !== "sharepoint" || !secret)
    throw new ConnectorError("Sign in with Microsoft first.");
  const t = await refreshAccess(secret);
  if (t.refresh_token && t.refresh_token !== secret)
    await storeConnectionSecret(ctx, {
      ...input,
      secret: t.refresh_token,
      encryptionKey: connectionKey(),
    });
  return listLibraries(t.access_token);
}

/** Tables and columns the read-only SQL user can see (to help write lookups). */
export async function sqlTables(
  ctx: Ctx,
  input: { tenantId: string; agentId: string; id: string },
) {
  const { connection, secret } = await openConnection(
    ctx,
    { ...input, encryptionKey: connectionKey() },
    "manage",
  );
  if (!isSqlKind(connection.kind)) throw new ConnectorError("Not a database connection.");
  return listSqlTables(connection.kind, sqlConfig(connection), secret);
}
