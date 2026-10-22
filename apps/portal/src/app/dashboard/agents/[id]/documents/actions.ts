"use server";

import { ForbiddenError } from "@wyrm/auth";
import {
  addKnowledgeSource,
  askKnowledge,
  DomainError,
  deleteKnowledgeSource,
  type KnowledgeAnswer,
  rateKnowledgeAnswer,
} from "@wyrm/core";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  DocumentError,
  documentType,
  extractText,
  isSupported,
  MAX_FILE_BYTES,
  readDriveFile,
} from "@/lib/documents";
import { knowledgeDeps } from "@/lib/models";
import { requireTenant } from "@/lib/portal";
import { readSite } from "@/lib/site-import";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const field = (form: FormData, name: string, max = 2000) =>
  String(form.get(name) ?? "")
    .trim()
    .slice(0, max);

function code(e: unknown) {
  if (e instanceof DomainError) return e.code;
  if (e instanceof ForbiddenError) return "forbidden";
  if (e instanceof DocumentError) return e.message;
  if (e instanceof Error && ["bad_url", "unreachable"].includes(e.message)) return e.message;
  console.error("documents action failed", e instanceof Error ? e.message : "unknown");
  return "unknown";
}

/** Runs a documents change, then goes back to the Documents tab with a notice or an error. */
async function documents(
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
        result = `error=${code(e)}`;
      }
    }
  }
  revalidatePath(`/dashboard/agents/${agentId}/documents`);
  redirect(`/dashboard/agents/${agentId}/documents?${result}`);
}

export async function uploadDocumentsAction(form: FormData) {
  await documents(form, async (p, agentId) => {
    const files = form.getAll("files").filter((f): f is File => f instanceof File && f.size > 0);
    if (!files.length) return "error=no_file";
    let added = 0;
    const failed: string[] = [];
    for (const file of files.slice(0, 10)) {
      try {
        if (file.size > MAX_FILE_BYTES) throw new DocumentError("too_big");
        const type = documentType(file.name, file.type);
        if (!isSupported(type)) throw new DocumentError("unsupported");
        const text = await extractText(new Uint8Array(await file.arrayBuffer()), type);
        await addKnowledgeSource(p.ctx, {
          tenantId: p.tenantId,
          agentId,
          kind: "upload",
          name: file.name,
          mime: type,
          text,
        });
        added += 1;
      } catch (e) {
        if (e instanceof ForbiddenError) throw e;
        failed.push(`${file.name.slice(0, 60)} (${code(e)})`);
      }
    }
    if (!added) return `error=${failed[0]?.match(/\((\w+)\)$/)?.[1] ?? "unknown"}`;
    return `notice=docs_added&n=${added}${failed.length ? `&failed=${encodeURIComponent(failed.join(", ").slice(0, 300))}` : ""}`;
  });
}

export async function addWebsiteAction(form: FormData) {
  await documents(form, async (p, agentId) => {
    const site = await readSite(field(form, "url", 300));
    if (site.blockedByRobots) return "error=blocked_robots";
    const pages = form.get("scope") === "site" ? site.pages : site.pages.slice(0, 1);
    let added = 0;
    for (const pg of pages) {
      if (pg.text.replace(/\s/g, "").length < 50) continue;
      const title = new URL(pg.url).pathname.replace(/\/$/, "") || "/";
      await addKnowledgeSource(p.ctx, {
        tenantId: p.tenantId,
        agentId,
        kind: "website",
        name: `${new URL(pg.url).hostname}${title === "/" ? "" : title}`,
        location: pg.url,
        mime: "text/html",
        text: pg.text,
      }).then(
        () => {
          added += 1;
        },
        (e) => {
          if (e instanceof ForbiddenError) throw e;
        },
      );
    }
    return added ? `notice=docs_added&n=${added}` : "error=nothing_found";
  });
}

export async function addTextAction(form: FormData) {
  await documents(form, async (p, agentId) => {
    await addKnowledgeSource(p.ctx, {
      tenantId: p.tenantId,
      agentId,
      kind: "text",
      name: field(form, "name", 200),
      mime: "text/plain",
      text: field(form, "text", 200_000),
    });
    return "notice=docs_added&n=1";
  });
}

export async function deleteDocumentAction(form: FormData) {
  await documents(form, async (p, agentId) => {
    await deleteKnowledgeSource(p.ctx, {
      tenantId: p.tenantId,
      agentId,
      sourceId: field(form, "sourceId", 64),
    });
    return "notice=doc_removed";
  });
}

/**
 * Imports files the user picked in Google Drive. The access token comes from their browser
 * (Google sign-in popup, scope drive.file), is used for these downloads only and is not stored.
 */
export async function importDriveAction(
  agentId: string,
  accessToken: string,
  fileIds: string[],
): Promise<{ added: number; failed: string[]; error?: string }> {
  if (!UUID.test(agentId) || typeof accessToken !== "string" || accessToken.length > 4000)
    return { added: 0, failed: [], error: "not_found" };
  const page = await requireTenant();
  if (page.readOnly) return { added: 0, failed: [], error: "read_only" };
  if (!page.can("agents.configure", agentId)) return { added: 0, failed: [], error: "forbidden" };
  let added = 0;
  const failed: string[] = [];
  for (const id of (Array.isArray(fileIds) ? fileIds : []).slice(0, 20)) {
    try {
      const doc = await readDriveFile(accessToken, String(id));
      await addKnowledgeSource(page.ctx, {
        tenantId: page.tenantId,
        agentId,
        kind: "google_drive",
        name: doc.name,
        location: doc.id,
        mime: doc.mime,
        text: doc.text,
      });
      added += 1;
    } catch (e) {
      failed.push(code(e));
    }
  }
  revalidatePath(`/dashboard/agents/${agentId}/documents`);
  return { added, failed };
}

/** One question to the documents agent (from the Ask tab). */
export async function askAction(
  agentId: string,
  question: string,
  history: { role: "user" | "agent"; text: string }[],
): Promise<{ ok: true; answer: KnowledgeAnswer } | { ok: false; error: string }> {
  if (!UUID.test(agentId) || typeof question !== "string") return { ok: false, error: "not_found" };
  const page = await requireTenant();
  const clean = (Array.isArray(history) ? history : [])
    .filter((m) => m && (m.role === "user" || m.role === "agent") && typeof m.text === "string")
    .slice(-6)
    .map((m) => ({ role: m.role, text: m.text.slice(0, 1000) }));
  try {
    const answer = await askKnowledge(
      page.ctx,
      { tenantId: page.tenantId, agentId, question: question.slice(0, 1000), history: clean },
      knowledgeDeps(page.access.email),
    );
    return { ok: true, answer };
  } catch (e) {
    return { ok: false, error: code(e) };
  }
}

export async function rateAnswerAction(questionId: string, feedback: "up" | "down") {
  if (!UUID.test(questionId) || (feedback !== "up" && feedback !== "down")) return false;
  const page = await requireTenant();
  if (page.readOnly) return false;
  try {
    await rateKnowledgeAnswer(page.ctx, { tenantId: page.tenantId, questionId, feedback });
    return true;
  } catch {
    return false;
  }
}
