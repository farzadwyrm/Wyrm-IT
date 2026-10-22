import "server-only";
import { compileSelect, LOOKUP_LIMITS, type SqlKind } from "@wyrm/core";
import { assertPublicHost } from "../site-import";

/**
 * Read-only SQL for "Ask your documents": Postgres, MySQL/MariaDB and SQL Server. Every
 * connection is encrypted (TLS), checked to be read-only before it is saved as working, and
 * each approved lookup runs with a 5-second limit and at most 50 rows (Postgres and MySQL also
 * inside a READ ONLY transaction). The host must resolve to a public address.
 */

export interface SqlConfig {
  host: string;
  port: number;
  database: string;
  user: string;
}

export interface CheckResult {
  ok: boolean;
  note: string;
  error?: string;
}

export class ConnectorError extends Error {}

const CONNECT_MS = 8000;
const ROWS = LOOKUP_LIMITS.rows;
const TIMEOUT = LOOKUP_LIMITS.timeoutMs;

/** Turns driver errors into short, safe messages (never the password or full connection string). */
export function explainSqlError(e: unknown): string {
  const raw = e instanceof Error ? `${(e as { code?: string }).code ?? ""} ${e.message}` : "";
  if (/not_public/.test(raw)) return "That host isn't a public address Wyrm can reach.";
  if (/ENOTFOUND|EAI_AGAIN/.test(raw)) return "The host name wasn't found.";
  if (/ECONNREFUSED|ETIMEDOUT|ESOCKET|timeout|timed out/i.test(raw))
    return "Couldn't reach the server. Allow connections from Wyrm (see the setup guide) and check the port.";
  if (/password|authentication|login failed|access denied|28P01|ER_ACCESS_DENIED/i.test(raw))
    return "The user name or password was refused.";
  if (/ssl|tls|certificate/i.test(raw))
    return "The server needs a secure (TLS) connection we couldn't set up.";
  if (/does not exist|unknown database|cannot open database/i.test(raw))
    return "That database wasn't found.";
  if (/permission denied|denied|not allowed/i.test(raw))
    return "The read-only user isn't allowed to read that.";
  if (/canceling statement|max_execution_time|timeout/i.test(raw))
    return "The lookup took longer than 5 seconds.";
  if (/syntax|column|relation|invalid object|doesn't exist/i.test(raw))
    return "The query doesn't match the database (check table and column names).";
  return "The database returned an error.";
}

function clean(rows: Record<string, unknown>[]) {
  return rows.slice(0, ROWS).map((r) => {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(r).slice(0, 20)) {
      out[k.slice(0, 60)] =
        v instanceof Date
          ? v.toISOString()
          : typeof v === "bigint"
            ? v.toString()
            : Buffer.isBuffer(v)
              ? "(binary)"
              : typeof v === "object" && v !== null
                ? JSON.stringify(v).slice(0, 300)
                : typeof v === "string"
                  ? v.slice(0, 300)
                  : v;
    }
    return out;
  });
}

// ---------------------------------------------------------------------------------------------
// Postgres

async function withPostgres<T>(
  config: SqlConfig,
  password: string,
  run: (sql: import("postgres").Sql) => Promise<T>,
) {
  const postgres = (await import("postgres")).default;
  const sql = postgres({
    host: config.host,
    port: config.port,
    database: config.database,
    username: config.user,
    password,
    ssl: "require",
    max: 1,
    prepare: false,
    connect_timeout: CONNECT_MS / 1000,
    idle_timeout: 1,
    connection: { application_name: "wyrm-readonly", statement_timeout: TIMEOUT },
  });
  try {
    return await run(sql);
  } finally {
    await sql.end({ timeout: 1 }).catch(() => undefined);
  }
}

const PG_CHECK = `
select r.rolsuper, r.rolcreaterole, r.rolcreatedb, r.rolreplication, r.rolbypassrls,
  (select count(*) from pg_class c join pg_namespace n on n.oid = c.relnamespace
    where c.relkind in ('r','p','v','m','f') and n.nspname not in ('pg_catalog','information_schema')
      and n.nspname not like 'pg_toast%'
      and (has_table_privilege(c.oid, 'INSERT') or has_table_privilege(c.oid, 'UPDATE')
        or has_table_privilege(c.oid, 'DELETE') or has_table_privilege(c.oid, 'TRUNCATE')))::int as writable,
  (select count(*) from pg_class c join pg_namespace n on n.oid = c.relnamespace
    where c.relkind in ('r','p','v','m','f') and n.nspname not in ('pg_catalog','information_schema')
      and has_table_privilege(c.oid, 'SELECT'))::int as readable,
  (select count(*) from pg_namespace n where n.nspname not in ('pg_catalog','information_schema')
      and n.nspname not like 'pg_%' and has_schema_privilege(n.oid, 'CREATE'))::int as can_create
from pg_roles r where r.rolname = current_user`;

// ---------------------------------------------------------------------------------------------
// MySQL / MariaDB

async function withMysql<T>(
  config: SqlConfig,
  password: string,
  run: (c: import("mysql2/promise").Connection) => Promise<T>,
) {
  const mysql = await import("mysql2/promise");
  const conn = await mysql.createConnection({
    host: config.host,
    port: config.port,
    database: config.database,
    user: config.user,
    password,
    ssl: {},
    connectTimeout: CONNECT_MS,
    dateStrings: true,
    supportBigNumbers: true,
    bigNumberStrings: true,
    multipleStatements: false,
  });
  try {
    return await run(conn);
  } finally {
    await conn.end().catch(() => undefined);
  }
}

const MYSQL_WRITE =
  /\b(ALL PRIVILEGES|INSERT|UPDATE|DELETE|DROP|ALTER|CREATE|INDEX|GRANT OPTION|SUPER|FILE|PROCESS|RELOAD|SHUTDOWN|EVENT|TRIGGER|EXECUTE|REFERENCES|LOCK TABLES)\b/i;

// ---------------------------------------------------------------------------------------------
// SQL Server

async function withSqlServer<T>(
  config: SqlConfig,
  password: string,
  run: (pool: import("mssql").ConnectionPool) => Promise<T>,
) {
  const mssql = (await import("mssql")).default;
  const pool = new mssql.ConnectionPool({
    server: config.host,
    port: config.port,
    database: config.database,
    user: config.user,
    password,
    options: { encrypt: true, trustServerCertificate: false, appName: "wyrm-readonly" },
    connectionTimeout: CONNECT_MS,
    requestTimeout: TIMEOUT,
    pool: { max: 1, min: 0 },
  });
  await pool.connect();
  try {
    return await run(pool);
  } finally {
    await pool.close().catch(() => undefined);
  }
}

const MSSQL_CHECK = `
SELECT IS_SRVROLEMEMBER('sysadmin') AS sa, IS_MEMBER('db_owner') AS owner,
  IS_MEMBER('db_datawriter') AS writer, IS_MEMBER('db_ddladmin') AS ddl,
  (SELECT COUNT(*) FROM fn_my_permissions(NULL, 'DATABASE')
    WHERE permission_name IN ('INSERT','UPDATE','DELETE','ALTER','CONTROL','TAKE OWNERSHIP',
      'CREATE TABLE','CREATE PROCEDURE','ALTER ANY SCHEMA')) AS db_writes,
  (SELECT COUNT(*) FROM (SELECT TOP 300 t.object_id, s.name AS sname, t.name AS tname FROM sys.tables t
      JOIN sys.schemas s ON s.schema_id = t.schema_id) x
    CROSS APPLY fn_my_permissions(QUOTENAME(x.sname) + '.' + QUOTENAME(x.tname), 'OBJECT') p
    WHERE p.permission_name IN ('INSERT','UPDATE','DELETE','ALTER','CONTROL')) AS table_writes,
  (SELECT COUNT(*) FROM sys.objects WHERE type IN ('U','V')) AS readable`;

// ---------------------------------------------------------------------------------------------

/** Connects, then proves the user can read but not write. Saving as "working" needs ok: true. */
export async function checkSql(
  kind: SqlKind,
  config: SqlConfig,
  password: string,
): Promise<CheckResult> {
  try {
    await assertPublicHost(config.host);
    if (kind === "postgres") {
      const [r] = await withPostgres(config, password, (sql) => sql.unsafe(PG_CHECK));
      if (!r) return { ok: false, note: "", error: "Couldn't read the user's rights." };
      if (r.rolsuper || r.rolcreaterole || r.rolcreatedb || r.rolreplication || r.rolbypassrls)
        return {
          ok: false,
          note: "",
          error:
            "This user has admin rights. Create a separate read-only user (see the setup guide).",
        };
      if (r.writable > 0)
        return {
          ok: false,
          note: "",
          error: `This user can change data in ${r.writable} table(s). Give Wyrm a user with SELECT only.`,
        };
      return {
        ok: true,
        note: `Read-only user: can read ${r.readable} table(s) or view(s), can change none.${
          r.can_create > 0
            ? " It can still create new tables in a schema; revoking CREATE is recommended."
            : ""
        }`,
      };
    }
    if (kind === "mysql") {
      const grants = await withMysql(config, password, async (c) => {
        const [rows] = await c.query("SHOW GRANTS FOR CURRENT_USER()");
        return (rows as Record<string, string>[]).map((r) => Object.values(r)[0] ?? "");
      });
      // "GRANT USAGE ON *.*" is just the right to log in.
      const risky = grants.filter((g) => MYSQL_WRITE.test(g.replace(/^GRANT USAGE ON/i, "")));
      if (risky.length)
        return {
          ok: false,
          note: "",
          error:
            "This user can change data or settings. Give Wyrm a user with SELECT only (see the setup guide).",
        };
      if (!grants.some((g) => /\bSELECT\b/i.test(g)))
        return {
          ok: false,
          note: "",
          error: "This user can't read any tables yet. Grant SELECT on the views Wyrm should use.",
        };
      return { ok: true, note: `Read-only user: ${grants.length} grant(s), SELECT only.` };
    }
    const r = await withSqlServer(
      config,
      password,
      async (pool) => (await pool.request().query(MSSQL_CHECK)).recordset[0],
    );
    if (!r) return { ok: false, note: "", error: "Couldn't read the user's rights." };
    if (r.sa || r.owner || r.writer || r.ddl || r.db_writes > 0 || r.table_writes > 0)
      return {
        ok: false,
        note: "",
        error:
          "This user can change data or the database. Give Wyrm a user with db_datareader (or SELECT on views) only.",
      };
    return {
      ok: true,
      note: `Read-only user: ${r.readable} table(s) or view(s) in the database, no write rights.`,
    };
  } catch (e) {
    return { ok: false, note: "", error: explainSqlError(e) };
  }
}

/** Runs one approved lookup read-only and returns at most 50 rows. */
export async function runSql(
  kind: SqlKind,
  config: SqlConfig,
  password: string,
  query: string,
  values: Record<string, string | number>,
): Promise<Record<string, unknown>[]> {
  await assertPublicHost(config.host);
  const compiled = compileSelect(query, kind, values);
  try {
    if (kind === "postgres") {
      const rows = await withPostgres(config, password, (sql) =>
        sql.begin("read only", async (tx) => {
          await tx.unsafe(`set local statement_timeout = ${TIMEOUT}`);
          return tx.unsafe(
            `select * from (${compiled.text}) as wyrm_lookup limit ${ROWS}`,
            compiled.values,
          );
        }),
      );
      return clean(rows as unknown as Record<string, unknown>[]);
    }
    if (kind === "mysql") {
      const rows = await withMysql(config, password, async (c) => {
        await c.query("SET SESSION TRANSACTION READ ONLY");
        await c.query(`SET SESSION MAX_EXECUTION_TIME = ${TIMEOUT}`).catch(() => undefined); // MySQL only
        await c.query("START TRANSACTION READ ONLY");
        try {
          const [result] = await c.execute(
            `SELECT * FROM (${compiled.text}) AS wyrm_lookup LIMIT ${ROWS}`,
            compiled.values,
          );
          return result as Record<string, unknown>[];
        } finally {
          await c.query("ROLLBACK").catch(() => undefined);
        }
      });
      return clean(rows);
    }
    const rows = await withSqlServer(config, password, async (pool) => {
      const request = pool.request();
      compiled.values.forEach((v, i) => {
        request.input(`p${i + 1}`, v);
      });
      // SQL Server has no read-only transaction: the read-only user (checked) is the guarantee.
      const result = await request.query(`SET ROWCOUNT ${ROWS}; ${compiled.text}`);
      return result.recordset as Record<string, unknown>[];
    });
    return clean(rows);
  } catch (e) {
    throw new ConnectorError(explainSqlError(e));
  }
}

/** Tables and views the read-only user can see, with a few columns each (to help write lookups). */
export async function listSqlTables(
  kind: SqlKind,
  config: SqlConfig,
  password: string,
): Promise<{ name: string; columns: string[] }[]> {
  await assertPublicHost(config.host);
  try {
    let rows: { t: string; c: string }[] = [];
    if (kind === "postgres")
      rows = (await withPostgres(config, password, (sql) =>
        sql.unsafe(`select table_schema || '.' || table_name as t, column_name as c
          from information_schema.columns
          where table_schema not in ('pg_catalog','information_schema')
          order by table_schema, table_name, ordinal_position limit 2000`),
      )) as unknown as { t: string; c: string }[];
    else if (kind === "mysql")
      rows = await withMysql(config, password, async (c) => {
        const [r] = await c.query(
          `SELECT TABLE_NAME AS t, COLUMN_NAME AS c FROM information_schema.COLUMNS
           WHERE TABLE_SCHEMA = DATABASE() ORDER BY TABLE_NAME, ORDINAL_POSITION LIMIT 2000`,
        );
        return r as { t: string; c: string }[];
      });
    else
      rows = await withSqlServer(
        config,
        password,
        async (pool) =>
          (
            await pool
              .request()
              .query(`SELECT TOP 2000 TABLE_SCHEMA + '.' + TABLE_NAME AS t, COLUMN_NAME AS c
            FROM INFORMATION_SCHEMA.COLUMNS ORDER BY TABLE_SCHEMA, TABLE_NAME, ORDINAL_POSITION`)
          ).recordset as { t: string; c: string }[],
      );
    const tables = new Map<string, string[]>();
    for (const r of rows) {
      const cols = tables.get(r.t) ?? [];
      if (cols.length < 25) cols.push(r.c);
      tables.set(r.t, cols);
    }
    return [...tables].slice(0, 100).map(([name, columns]) => ({ name, columns }));
  } catch (e) {
    throw new ConnectorError(explainSqlError(e));
  }
}
