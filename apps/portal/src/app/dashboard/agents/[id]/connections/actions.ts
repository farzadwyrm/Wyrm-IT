"use server";

import { ForbiddenError } from "@wyrm/auth";
import {
  type ConnectionKind,
  DomainError,
  deleteConnection,
  deleteLookup,
  openConnection,
  saveConnection,
  saveLookup,
  setConnectionEnabled,
} from "@wyrm/core";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  ConnectorError,
  connectionKey,
  sharePointLibraries,
  sqlTables,
  syncSharePoint,
  testConnection,
  tryLookup,
} from "@/lib/connectors";
import { requireTenant } from "@/lib/portal";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const KINDS: ConnectionKind[] = [
  "postgres",
  "mysql",
  "sqlserver",
  "hubspot",
  "sharepoint",
  "search_api",
];
const field = (form: FormData, name: string, max = 2000) =>
  String(form.get(name) ?? "")
    .trim()
    .slice(0, max);

function code(e: unknown) {
  if (e instanceof DomainError) return e.code;
  if (e instanceof ForbiddenError) return "forbidden";
  if (e instanceof ConnectorError) return "connector";
  console.error("connections action failed", e instanceof Error ? e.name : "unknown");
  return "unknown";
}

/** Runs a connections change, then goes back to the Connections tab with a notice or error. */
async function connections(
  form: FormData,
  run: (p: Awaited<ReturnType<typeof requireTenant>>, agentId: string) => Promise<string>,
) {
  const agentId = field(form, "agentId", 64);
  const page = await requireTenant();
  let result = "error=not_found";
  if (UUID.test(agentId)) {
    if (page.readOnly) result = "error=read_only";
    else {
      try {
        result = await run(page, agentId);
      } catch (e) {
        result = `error=${code(e)}${e instanceof ConnectorError ? `&detail=${encodeURIComponent(e.message.slice(0, 200))}` : ""}`;
      }
    }
  }
  revalidatePath(`/dashboard/agents/${agentId}/connections`);
  redirect(`/dashboard/agents/${agentId}/connections?${result}`);
}

const checked = (r: { ok: boolean; error?: string }) =>
  r.ok
    ? "notice=connection_ok"
    : `error=connection_failed&detail=${encodeURIComponent((r.error ?? "").slice(0, 200))}`;

export async function saveConnectionAction(form: FormData) {
  await connections(form, async (p, agentId) => {
    const kind = field(form, "kind", 20) as ConnectionKind;
    if (!KINDS.includes(kind)) throw new DomainError("bad_type", "Choose a type.");
    const secret = field(form, "secret", 4000);
    const id = field(form, "id", 64);
    const saved = await saveConnection(p.ctx, {
      tenantId: p.tenantId,
      agentId,
      ...(UUID.test(id) ? { id } : {}),
      kind,
      name: field(form, "name", 80),
      config: {
        host: field(form, "host", 200),
        port: field(form, "port", 10),
        database: field(form, "database", 128),
        user: field(form, "user", 128),
        url: field(form, "url", 500),
      },
      ...(secret ? { secret } : {}),
      encryptionKey: connectionKey(),
    });
    if (kind === "sharepoint") return "notice=connection_saved";
    if (!saved.hasSecret) return "notice=connection_saved";
    // Test straight away so the manager sees the read-only check.
    return checked(await testConnection(p.ctx, { tenantId: p.tenantId, agentId, id: saved.id }));
  });
}

export async function testConnectionAction(form: FormData) {
  await connections(form, async (p, agentId) =>
    checked(
      await testConnection(p.ctx, { tenantId: p.tenantId, agentId, id: field(form, "id", 64) }),
    ),
  );
}

export async function toggleConnectionAction(form: FormData) {
  await connections(form, async (p, agentId) => {
    await setConnectionEnabled(p.ctx, {
      tenantId: p.tenantId,
      agentId,
      id: field(form, "id", 64),
      enabled: form.get("enabled") === "1",
    });
    return form.get("enabled") === "1" ? "notice=connection_on" : "notice=connection_off";
  });
}

export async function deleteConnectionAction(form: FormData) {
  await connections(form, async (p, agentId) => {
    await deleteConnection(p.ctx, { tenantId: p.tenantId, agentId, id: field(form, "id", 64) });
    return "notice=connection_removed";
  });
}

/** "order_no:text, from:date" → parameter list (labels default to the name). */
function parseParams(raw: string) {
  return raw
    .split(/[,\n]/)
    .map((s) => s.trim())
    .filter(Boolean)
    .slice(0, 5)
    .map((s) => {
      const [name = "", type = "text"] = s.split(":").map((x) => x.trim());
      return { name, label: name.replace(/_/g, " "), type };
    });
}

export async function saveLookupAction(form: FormData) {
  await connections(form, async (p, agentId) => {
    const id = field(form, "id", 64);
    await saveLookup(p.ctx, {
      tenantId: p.tenantId,
      agentId,
      ...(UUID.test(id) ? { id } : {}),
      connectionId: field(form, "connectionId", 64),
      name: field(form, "name", 80),
      description: field(form, "description", 300),
      query: field(form, "query", 4000),
      params: parseParams(field(form, "params", 300)),
    });
    return "notice=lookup_saved";
  });
}

export async function deleteLookupAction(form: FormData) {
  await connections(form, async (p, agentId) => {
    await deleteLookup(p.ctx, { tenantId: p.tenantId, agentId, id: field(form, "id", 64) });
    return "notice=lookup_removed";
  });
}

export async function chooseLibraryAction(form: FormData) {
  await connections(form, async (p, agentId) => {
    const id = field(form, "id", 64);
    const [siteId = "", driveId = "", siteName = "", driveName = ""] = field(
      form,
      "library",
      900,
    ).split("|");
    if (!driveId) throw new DomainError("bad_config", "Choose a library.");
    const { connection } = await openConnection(
      p.ctx,
      { tenantId: p.tenantId, agentId, id, encryptionKey: connectionKey() },
      "manage",
    );
    await saveConnection(p.ctx, {
      tenantId: p.tenantId,
      agentId,
      id,
      kind: "sharepoint",
      name: connection.name,
      config: {
        ...connection.config,
        siteId,
        driveId,
        siteName,
        driveName,
        folderPath: field(form, "folderPath", 300),
      },
      encryptionKey: connectionKey(),
    });
    return checked(await testConnection(p.ctx, { tenantId: p.tenantId, agentId, id }));
  });
}

export async function syncAction(form: FormData) {
  await connections(form, async (p, agentId) => {
    const r = await syncSharePoint(p.ctx, {
      tenantId: p.tenantId,
      agentId,
      id: field(form, "id", 64),
    });
    return `notice=synced&added=${r.added}&removed=${r.removed}&remaining=${r.remaining}&failed=${r.failed}`;
  });
}

// --- Called from the browser (results shown in place) ------------------------------------

type Result<T> = { ok: true; data: T } | { ok: false; error: string };

async function guard<T>(
  agentId: string,
  run: (p: Awaited<ReturnType<typeof requireTenant>>) => Promise<T>,
): Promise<Result<T>> {
  if (!UUID.test(agentId)) return { ok: false, error: "Not found." };
  const page = await requireTenant();
  try {
    return { ok: true, data: await run(page) };
  } catch (e) {
    if (e instanceof ForbiddenError)
      return { ok: false, error: "Only owners and admins can do this." };
    if (e instanceof DomainError || e instanceof ConnectorError)
      return { ok: false, error: e.message };
    return { ok: false, error: "Something went wrong." };
  }
}

/** Runs a lookup with sample values so the manager sees what the agent would get. */
export async function tryLookupAction(
  agentId: string,
  lookupId: string,
  values: Record<string, string>,
) {
  return guard(agentId, (p) =>
    tryLookup(p.ctx, {
      tenantId: p.tenantId,
      agentId,
      lookupId: String(lookupId),
      values: values ?? {},
    }),
  );
}

export async function tablesAction(agentId: string, connectionId: string) {
  return guard(agentId, (p) =>
    sqlTables(p.ctx, { tenantId: p.tenantId, agentId, id: connectionId }),
  );
}

export async function librariesAction(agentId: string, connectionId: string) {
  return guard(agentId, (p) =>
    sharePointLibraries(p.ctx, { tenantId: p.tenantId, agentId, id: connectionId }),
  );
}
