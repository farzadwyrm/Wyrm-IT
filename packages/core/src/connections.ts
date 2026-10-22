import { check, ForbiddenError } from "@wyrm/auth";
import {
  type AgentConnection,
  agentConnections,
  type ConnectionKind,
  type ConnectionLookup,
  connectionCalls,
  connectionLookups,
  type LookupParam,
} from "@wyrm/db";
import { and, asc, desc, eq } from "drizzle-orm";
import { audit } from "./audit";
import { decryptToken, encryptToken } from "./calendar";
import { type Ctx, DomainError, guarded } from "./context";
import { agentGate } from "./operations";

/**
 * Read-only connections from an agent to the client's own systems: SQL databases, HubSpot CRM,
 * SharePoint and the client's own search API. Managing them needs `security.manage` (owners and
 * admins) and `agents.configure` for the agent; secrets are encrypted and never returned.
 * The agent can only run "approved lookups": named, parameterised SELECTs (or CRM searches)
 * the client wrote and tested. Drivers live in the portal; this module holds the rules.
 */

export const SQL_KINDS = ["postgres", "mysql", "sqlserver"] as const;
export type SqlKind = (typeof SQL_KINDS)[number];
export const isSqlKind = (k: string): k is SqlKind => (SQL_KINDS as readonly string[]).includes(k);

export const LOOKUP_LIMITS = { rows: 50, timeoutMs: 5000, params: 5, perAgent: 30 } as const;
export const HUBSPOT_OBJECTS = ["contacts", "companies", "deals", "tickets"] as const;

/** Wyrm staff need platform rights; a client needs security.manage and to configure this agent. */
function assertCanManage(ctx: Ctx, tenantId: string, agentId: string) {
  if (ctx.actor?.kind === "platform") {
    const d = check(ctx.actor, "platform_agents.manage");
    if (!d.allowed) throw new ForbiddenError("platform_agents.manage", d.reason);
    return;
  }
  const d = check(ctx.actor, "security.manage", { tenantId });
  if (!d.allowed) throw new ForbiddenError("security.manage", d.reason);
  agentGate(ctx, "agents.configure", tenantId, agentId);
}

function userOf(ctx: Ctx): string | null {
  const a = ctx.actor;
  if (!a) return null;
  return a.kind === "impersonating" ? a.platform.userId : a.userId;
}

// ---------------------------------------------------------------------------------------------
// SQL safety: one read-only SELECT with :named parameters

const FORBIDDEN =
  /\b(insert|update|delete|merge|upsert|drop|alter|create|truncate|rename|grant|revoke|deny|exec|execute|call|do|copy|into|lock|unlock|vacuum|analyze|reindex|cluster|set|reset|load|handler|prepare|deallocate|listen|notify|refresh|comment|security|attach|detach|pragma|outfile|dumpfile|shutdown|kill|backup|restore|bulk|openrowset|opendatasource|openquery|waitfor|sleep|pg_sleep|benchmark|dblink|lo_import|lo_export|pg_read_file|pg_read_binary_file|load_file|xp_\w*|sp_\w*)\b/i;
/** Quoted text (left alone) or a :name placeholder (not a ::cast). */
const TOKENS =
  /('(?:''|[^'])*')|("(?:""|[^"])*")|(`[^`]*`)|(\[[^\]]*\])|(?<![:\w]):([A-Za-z_]\w{0,30})/g;

export interface SelectCheck {
  ok: boolean;
  reason?: string;
  /** Placeholder names in order of first use. */
  params: string[];
}

export function checkSelect(sql: string): SelectCheck {
  const text = sql.trim().replace(/;\s*$/, "");
  if (text.length < 8 || text.length > 4000) return { ok: false, reason: "length", params: [] };
  const bare = text.replace(TOKENS, (_m, s1, s2, s3, s4) => (s1 || s2 || s3 || s4 ? "''" : " ?"));
  if (/--|\/\*|\*\/|#/.test(bare)) return { ok: false, reason: "comments", params: [] };
  if (bare.includes(";")) return { ok: false, reason: "one_statement", params: [] };
  if (!/^\s*(select|with)\b/i.test(bare)) return { ok: false, reason: "select_only", params: [] };
  const bad = bare.match(FORBIDDEN);
  if (bad) return { ok: false, reason: `forbidden:${bad[1]?.toLowerCase()}`, params: [] };
  const params: string[] = [];
  for (const m of text.matchAll(TOKENS)) {
    const name = m[5];
    if (name && !params.includes(name)) params.push(name);
  }
  if (params.length > LOOKUP_LIMITS.params) return { ok: false, reason: "too_many_params", params };
  return { ok: true, params };
}

/** The query in the driver's placeholder style, with values in order. Values are never inlined. */
export function compileSelect(
  sql: string,
  kind: SqlKind,
  values: Record<string, string | number>,
): { text: string; values: (string | number)[] } {
  const out: (string | number)[] = [];
  const index = new Map<string, number>();
  const text = sql
    .trim()
    .replace(/;\s*$/, "")
    .replace(TOKENS, (m, s1, s2, s3, s4, name: string | undefined) => {
      if (s1 || s2 || s3 || s4 || !name) return m;
      if (!(name in values)) throw new DomainError("missing_param", `Missing value for ${name}.`);
      const value = values[name] as string | number;
      if (kind === "postgres") {
        let i = index.get(name);
        if (!i) {
          out.push(value);
          i = out.length;
          index.set(name, i);
        }
        return `$${i}`;
      }
      if (kind === "sqlserver") {
        let i = index.get(name);
        if (!i) {
          out.push(value);
          i = out.length;
          index.set(name, i);
        }
        return `@p${i}`;
      }
      out.push(value);
      return "?";
    });
  return { text, values: out };
}

/** A parameter value as its declared type, or an error the agent can explain. */
export function coerceParam(param: LookupParam, raw: unknown): string | number {
  const value = String(raw ?? "").trim();
  if (!value) throw new DomainError("missing_param", `Missing ${param.label}.`);
  if (param.type === "number") {
    const n = Number(value.replace(",", "."));
    if (!Number.isFinite(n)) throw new DomainError("bad_param", `${param.label} must be a number.`);
    return n;
  }
  if (param.type === "date") {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value) || Number.isNaN(Date.parse(value)))
      throw new DomainError("bad_param", `${param.label} must be a date (YYYY-MM-DD).`);
    return value;
  }
  return value.slice(0, 200);
}

/** Rows as short text passages the model can cite: "col: value; col: value" per row. */
export function rowsToText(rows: Record<string, unknown>[], max = 1800): string {
  if (!rows.length) return "No matching records.";
  const lines: string[] = [];
  let size = 0;
  for (const row of rows.slice(0, LOOKUP_LIMITS.rows)) {
    const line = Object.entries(row)
      .map(
        ([k, v]) => `${k}: ${v instanceof Date ? v.toISOString().slice(0, 10) : String(v ?? "")}`,
      )
      .join("; ")
      .slice(0, 400);
    if (size + line.length > max) {
      lines.push(`… ${rows.length - lines.length} more`);
      break;
    }
    lines.push(line);
    size += line.length + 1;
  }
  return lines.join("\n");
}

// ---------------------------------------------------------------------------------------------
// Connections

export type PublicConnection = Omit<AgentConnection, "secretEnc"> & { hasSecret: boolean };

const strip = ({ secretEnc, ...rest }: AgentConnection): PublicConnection => ({
  ...rest,
  hasSecret: Boolean(secretEnc),
});

const HOST =
  /^(?=.{1,253}$)[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?(\.[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?)+$/i;

/**
 * A private, loopback or link-local IPv4 literal. The portal also resolves host names and
 * refuses private addresses before connecting (names can point anywhere).
 */
export function privateIPv4(host: string) {
  const m = host.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (!m) return false;
  const [a, b] = [Number(m[1]), Number(m[2])];
  return (
    a === 0 ||
    a === 10 ||
    a === 127 ||
    (a === 100 && b >= 64 && b <= 127) ||
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168) ||
    a >= 224
  );
}

/** Settings for a connection kind, cleaned; throws on anything missing or unsafe. */
export function cleanConfig(kind: ConnectionKind, input: Record<string, unknown>) {
  const str = (k: string, max = 200) =>
    String(input[k] ?? "")
      .trim()
      .slice(0, max);
  if (isSqlKind(kind)) {
    const host = str("host").toLowerCase();
    if (
      !HOST.test(host) ||
      /(^|\.)(localhost|local|internal|lan|home|corp|intranet)$/.test(host) ||
      privateIPv4(host)
    )
      throw new DomainError("bad_host", "Enter the database server's public host name.");
    const defaults = { postgres: 5432, mysql: 3306, sqlserver: 1433 } as const;
    const port = Number(str("port") || defaults[kind]);
    if (!Number.isInteger(port) || port < 1 || port > 65535)
      throw new DomainError("bad_port", "Enter a valid port.");
    const database = str("database", 128);
    const user = str("user", 128);
    if (!database || !user) throw new DomainError("bad_config", "Enter the database and user.");
    return { host, port, database, user };
  }
  if (kind === "search_api") {
    let url: URL;
    try {
      url = new URL(str("url", 500));
    } catch {
      throw new DomainError("bad_url", "Enter the full https:// address of your search API.");
    }
    if (url.protocol !== "https:" || url.username || url.password)
      throw new DomainError("bad_url", "The search API must use https://.");
    return { url: url.toString() };
  }
  if (kind === "hubspot") return {};
  if (kind === "sharepoint") {
    const out: Record<string, string> = {};
    for (const k of ["siteId", "siteName", "driveId", "driveName", "folderPath", "account"]) {
      const v = str(k, 300);
      if (v) out[k] = v;
    }
    return out;
  }
  throw new DomainError("bad_type", "Unknown connection type.");
}

export async function listConnections(ctx: Ctx, tenantId: string, agentId: string) {
  agentGate(ctx, "agents.configure", tenantId, agentId);
  const rows = await ctx.db
    .select()
    .from(agentConnections)
    .where(and(eq(agentConnections.tenantId, tenantId), eq(agentConnections.agentId, agentId)))
    .orderBy(asc(agentConnections.createdAt));
  return rows.map(strip);
}

/** Adds or edits a connection. A changed setting or secret means it has to be tested again. */
export async function saveConnection(
  ctx: Ctx,
  input: {
    tenantId: string;
    agentId: string;
    id?: string;
    kind: ConnectionKind;
    name: string;
    config: Record<string, unknown>;
    /** New secret (password, token); undefined keeps the stored one. */
    secret?: string;
    encryptionKey: string;
  },
) {
  assertCanManage(ctx, input.tenantId, input.agentId);
  const name = input.name.replace(/\s+/g, " ").trim().slice(0, 80);
  if (!name) throw new DomainError("bad_name", "Give the connection a name.");
  const config = cleanConfig(input.kind, input.config);
  const secret = input.secret?.trim();
  if (secret !== undefined && secret.length > 4000)
    throw new DomainError("bad_secret", "That secret is too long.");
  const values = {
    name,
    config,
    status: "untested" as const,
    checkNote: null,
    lastError: null,
    updatedAt: new Date(),
    ...(secret ? { secretEnc: encryptToken(secret, input.encryptionKey) } : {}),
  };
  const [row] = await guarded(() =>
    input.id
      ? ctx.db
          .update(agentConnections)
          .set(values)
          .where(
            and(
              eq(agentConnections.id, input.id as string),
              eq(agentConnections.agentId, input.agentId),
              eq(agentConnections.tenantId, input.tenantId),
              eq(agentConnections.kind, input.kind),
            ),
          )
          .returning()
      : ctx.db
          .insert(agentConnections)
          .values({
            ...values,
            tenantId: input.tenantId,
            agentId: input.agentId,
            kind: input.kind,
            createdBy: userOf(ctx),
          })
          .returning(),
  );
  if (!row) throw new DomainError("not_found", "That connection no longer exists.");
  await audit(ctx, {
    tenantId: input.tenantId,
    action: input.id ? "connection.updated" : "connection.added",
    targetType: "connection",
    targetId: row.id,
    extra: { agentId: input.agentId, kind: input.kind, secretChanged: Boolean(secret) },
  });
  return strip(row);
}

/** The stored row with its secret decrypted: server-side only, for testing and running lookups. */
export async function openConnection(
  ctx: Ctx,
  input: { tenantId: string; agentId: string; id: string; encryptionKey: string },
  permission: "agents.use" | "manage" = "agents.use",
) {
  if (permission === "manage") assertCanManage(ctx, input.tenantId, input.agentId);
  else agentGate(ctx, "agents.use", input.tenantId, input.agentId);
  const [row] = await ctx.db
    .select()
    .from(agentConnections)
    .where(
      and(
        eq(agentConnections.id, input.id),
        eq(agentConnections.agentId, input.agentId),
        eq(agentConnections.tenantId, input.tenantId),
      ),
    );
  if (!row) throw new DomainError("not_found", "That connection no longer exists.");
  let secret = "";
  if (row.secretEnc) {
    try {
      secret = decryptToken(row.secretEnc, input.encryptionKey);
    } catch {
      throw new DomainError("secret_unreadable", "Enter the password or token again.");
    }
  }
  return { connection: strip(row), secret };
}

/** Stores a test result (including the read-only check) for a connection. */
export async function recordConnectionCheck(
  ctx: Ctx,
  input: {
    tenantId: string;
    agentId: string;
    id: string;
    ok: boolean;
    note?: string | null;
    error?: string | null;
    config?: Record<string, unknown>;
  },
) {
  assertCanManage(ctx, input.tenantId, input.agentId);
  const [current] = await ctx.db
    .select()
    .from(agentConnections)
    .where(and(eq(agentConnections.id, input.id), eq(agentConnections.tenantId, input.tenantId)));
  if (!current || current.agentId !== input.agentId)
    throw new DomainError("not_found", "That connection no longer exists.");
  await ctx.db
    .update(agentConnections)
    .set({
      status: current.status === "disabled" ? "disabled" : input.ok ? "ok" : "error",
      checkNote: input.note?.slice(0, 500) ?? null,
      lastError: input.ok ? null : (input.error ?? "Failed").slice(0, 500),
      lastCheckedAt: new Date(),
      ...(input.config
        ? { config: cleanConfig(current.kind, { ...current.config, ...input.config }) }
        : {}),
    })
    .where(eq(agentConnections.id, input.id));
  await audit(ctx, {
    tenantId: input.tenantId,
    action: input.ok ? "connection.checked" : "connection.check_failed",
    targetType: "connection",
    targetId: input.id,
    extra: { agentId: input.agentId },
  });
}

/** Replaces the secret after an OAuth sign-in (SharePoint) without touching other settings. */
export async function storeConnectionSecret(
  ctx: Ctx,
  input: {
    tenantId: string;
    agentId: string;
    id: string;
    secret: string;
    encryptionKey: string;
    config?: Record<string, unknown>;
  },
) {
  assertCanManage(ctx, input.tenantId, input.agentId);
  const [current] = await ctx.db
    .select()
    .from(agentConnections)
    .where(and(eq(agentConnections.id, input.id), eq(agentConnections.tenantId, input.tenantId)));
  if (!current || current.agentId !== input.agentId)
    throw new DomainError("not_found", "That connection no longer exists.");
  await ctx.db
    .update(agentConnections)
    .set({
      secretEnc: encryptToken(input.secret, input.encryptionKey),
      status: "untested",
      updatedAt: new Date(),
      ...(input.config
        ? { config: cleanConfig(current.kind, { ...current.config, ...input.config }) }
        : {}),
    })
    .where(eq(agentConnections.id, input.id));
  await audit(ctx, {
    tenantId: input.tenantId,
    action: "connection.signed_in",
    targetType: "connection",
    targetId: input.id,
    extra: { agentId: input.agentId },
  });
}

export async function setConnectionEnabled(
  ctx: Ctx,
  input: { tenantId: string; agentId: string; id: string; enabled: boolean },
) {
  assertCanManage(ctx, input.tenantId, input.agentId);
  const updated = await ctx.db
    .update(agentConnections)
    .set({ status: input.enabled ? "untested" : "disabled", updatedAt: new Date() })
    .where(
      and(
        eq(agentConnections.id, input.id),
        eq(agentConnections.agentId, input.agentId),
        eq(agentConnections.tenantId, input.tenantId),
      ),
    )
    .returning({ id: agentConnections.id });
  if (!updated.length) throw new DomainError("not_found", "That connection no longer exists.");
  await audit(ctx, {
    tenantId: input.tenantId,
    action: input.enabled ? "connection.enabled" : "connection.disabled",
    targetType: "connection",
    targetId: input.id,
    extra: { agentId: input.agentId },
  });
}

export async function deleteConnection(
  ctx: Ctx,
  input: { tenantId: string; agentId: string; id: string },
) {
  assertCanManage(ctx, input.tenantId, input.agentId);
  const deleted = await ctx.db
    .delete(agentConnections)
    .where(
      and(
        eq(agentConnections.id, input.id),
        eq(agentConnections.agentId, input.agentId),
        eq(agentConnections.tenantId, input.tenantId),
      ),
    )
    .returning({ id: agentConnections.id });
  if (!deleted.length) throw new DomainError("not_found", "That connection no longer exists.");
  await audit(ctx, {
    tenantId: input.tenantId,
    action: "connection.removed",
    targetType: "connection",
    targetId: input.id,
    extra: { agentId: input.agentId },
  });
}

// ---------------------------------------------------------------------------------------------
// Approved lookups

const PARAM_NAME = /^[A-Za-z_]\w{0,30}$/;

function cleanParams(raw: unknown): LookupParam[] {
  if (!Array.isArray(raw)) return [];
  return raw.slice(0, LOOKUP_LIMITS.params).map((p) => {
    const o = (p ?? {}) as Record<string, unknown>;
    const name = String(o.name ?? "").trim();
    if (!PARAM_NAME.test(name))
      throw new DomainError("bad_param", "Parameter names use letters, digits and _.");
    const type = ["text", "number", "date"].includes(String(o.type))
      ? (o.type as LookupParam["type"])
      : "text";
    return {
      name,
      label:
        String(o.label ?? name)
          .trim()
          .slice(0, 60) || name,
      type,
    };
  });
}

export async function listLookups(ctx: Ctx, tenantId: string, agentId: string) {
  agentGate(ctx, "agents.configure", tenantId, agentId);
  return ctx.db
    .select()
    .from(connectionLookups)
    .where(and(eq(connectionLookups.tenantId, tenantId), eq(connectionLookups.agentId, agentId)))
    .orderBy(asc(connectionLookups.createdAt));
}

/** Adds or edits an approved lookup after checking it is read-only and its parameters match. */
export async function saveLookup(
  ctx: Ctx,
  input: {
    tenantId: string;
    agentId: string;
    id?: string;
    connectionId: string;
    name: string;
    description: string;
    query: string;
    params: unknown;
  },
) {
  assertCanManage(ctx, input.tenantId, input.agentId);
  const [connection] = await ctx.db
    .select()
    .from(agentConnections)
    .where(
      and(
        eq(agentConnections.id, input.connectionId),
        eq(agentConnections.agentId, input.agentId),
        eq(agentConnections.tenantId, input.tenantId),
      ),
    );
  if (!connection) throw new DomainError("not_found", "That connection no longer exists.");
  const name = input.name.replace(/\s+/g, " ").trim().slice(0, 80);
  const description = input.description.replace(/\s+/g, " ").trim().slice(0, 300);
  if (name.length < 3) throw new DomainError("bad_name", "Name the lookup (3 characters or more).");
  if (description.length < 10)
    throw new DomainError("bad_description", "Say when the agent should use it, in a sentence.");
  let params = cleanParams(input.params);
  let query = input.query.trim();
  if (isSqlKind(connection.kind)) {
    const checked = checkSelect(query);
    if (!checked.ok)
      throw new DomainError(
        "not_read_only",
        checked.reason?.startsWith("forbidden:")
          ? `Only reading is allowed: "${checked.reason.slice(10)}" isn't permitted.`
          : "Use one SELECT statement, without comments.",
      );
    const declared = new Map(params.map((p) => [p.name, p]));
    params = checked.params.map(
      (n) => declared.get(n) ?? { name: n, label: n.replace(/_/g, " "), type: "text" as const },
    );
  } else if (connection.kind === "hubspot") {
    if (!(HUBSPOT_OBJECTS as readonly string[]).includes(query))
      throw new DomainError("bad_object", "Choose contacts, companies, deals or tickets.");
    params = [{ name: "search", label: params[0]?.label || "Search words", type: "text" }];
  } else {
    throw new DomainError(
      "no_lookups",
      "This connection is searched automatically: no lookups needed.",
    );
  }
  query = query.replace(/;\s*$/, "");
  const existing = await ctx.db
    .select({ id: connectionLookups.id })
    .from(connectionLookups)
    .where(eq(connectionLookups.agentId, input.agentId));
  if (!input.id && existing.length >= LOOKUP_LIMITS.perAgent)
    throw new DomainError("too_many_lookups", "This agent has the most lookups it can hold.");
  const values = {
    name,
    description,
    query,
    params,
    connectionId: connection.id,
    updatedAt: new Date(),
  };
  const [row] = await guarded(() =>
    input.id
      ? ctx.db
          .update(connectionLookups)
          .set(values)
          .where(
            and(
              eq(connectionLookups.id, input.id as string),
              eq(connectionLookups.agentId, input.agentId),
              eq(connectionLookups.tenantId, input.tenantId),
            ),
          )
          .returning()
      : ctx.db
          .insert(connectionLookups)
          .values({
            ...values,
            tenantId: input.tenantId,
            agentId: input.agentId,
            createdBy: userOf(ctx),
          })
          .returning(),
  );
  if (!row) throw new DomainError("not_found", "That lookup no longer exists.");
  await audit(ctx, {
    tenantId: input.tenantId,
    action: input.id ? "lookup.updated" : "lookup.added",
    targetType: "lookup",
    targetId: row.id,
    extra: { agentId: input.agentId, connectionId: connection.id },
  });
  return row;
}

export async function deleteLookup(
  ctx: Ctx,
  input: { tenantId: string; agentId: string; id: string },
) {
  assertCanManage(ctx, input.tenantId, input.agentId);
  const deleted = await ctx.db
    .delete(connectionLookups)
    .where(
      and(
        eq(connectionLookups.id, input.id),
        eq(connectionLookups.agentId, input.agentId),
        eq(connectionLookups.tenantId, input.tenantId),
      ),
    )
    .returning({ id: connectionLookups.id });
  if (!deleted.length) throw new DomainError("not_found", "That lookup no longer exists.");
  await audit(ctx, {
    tenantId: input.tenantId,
    action: "lookup.removed",
    targetType: "lookup",
    targetId: input.id,
    extra: { agentId: input.agentId },
  });
}

/** What the agent may use while answering: enabled lookups on tested connections, and search APIs. */
export async function liveSources(db: Ctx["db"], tenantId: string, agentId: string) {
  const connections = await db
    .select()
    .from(agentConnections)
    .where(
      and(
        eq(agentConnections.tenantId, tenantId),
        eq(agentConnections.agentId, agentId),
        eq(agentConnections.status, "ok"),
      ),
    );
  const ok = new Map(connections.map((c) => [c.id, c]));
  const lookups = (
    await db
      .select()
      .from(connectionLookups)
      .where(
        and(
          eq(connectionLookups.tenantId, tenantId),
          eq(connectionLookups.agentId, agentId),
          eq(connectionLookups.enabled, true),
        ),
      )
  ).filter((l) => ok.has(l.connectionId));
  return {
    lookups: lookups.map((l) => ({
      lookup: l,
      connection: ok.get(l.connectionId) as AgentConnection,
    })),
    searchApis: connections.filter((c) => c.kind === "search_api"),
  };
}

export async function logConnectionCall(
  ctx: Ctx,
  input: {
    tenantId: string;
    agentId: string;
    connectionId: string;
    lookupId?: string | null;
    questionId?: string | null;
    params?: Record<string, string>;
    rows: number;
    ms: number;
    ok: boolean;
    error?: string | null;
  },
) {
  await ctx.db.insert(connectionCalls).values({
    tenantId: input.tenantId,
    agentId: input.agentId,
    connectionId: input.connectionId,
    lookupId: input.lookupId ?? null,
    questionId: input.questionId ?? null,
    askedBy: userOf(ctx),
    params: input.params ?? {},
    rows: input.rows,
    ms: Math.round(input.ms),
    ok: input.ok,
    error: input.error?.slice(0, 300) ?? null,
  });
}

export async function listConnectionCalls(ctx: Ctx, tenantId: string, agentId: string, limit = 50) {
  agentGate(ctx, "agents.logs", tenantId, agentId);
  return ctx.db
    .select({
      call: connectionCalls,
      lookup: connectionLookups.name,
      connection: agentConnections.name,
    })
    .from(connectionCalls)
    .leftJoin(connectionLookups, eq(connectionLookups.id, connectionCalls.lookupId))
    .leftJoin(agentConnections, eq(agentConnections.id, connectionCalls.connectionId))
    .where(and(eq(connectionCalls.tenantId, tenantId), eq(connectionCalls.agentId, agentId)))
    .orderBy(desc(connectionCalls.createdAt))
    .limit(Math.min(limit, 200));
}

export type { AgentConnection, ConnectionKind, ConnectionLookup };
