"use server";

import { clientsFromEnv, draftProfileFromPages } from "@wyrm/ai";
import { ForbiddenError } from "@wyrm/auth";
import {
  applySuggestion,
  createSuggestion,
  DomainError,
  disconnectCalendar,
  dismissSuggestion,
  grantAgentAccess,
  revokeAgentAccess,
  saveChannel,
  setAgentStatus,
} from "@wyrm/core";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireTenant } from "@/lib/portal";
import { readSite } from "@/lib/site-import";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const field = (form: FormData, name: string, max = 2000) =>
  String(form.get(name) ?? "")
    .trim()
    .slice(0, max);

async function launch(
  form: FormData,
  notice: string,
  run: (p: Awaited<ReturnType<typeof requireTenant>>, agentId: string) => Promise<unknown>,
) {
  const agentId = field(form, "agentId", 64);
  const page = await requireTenant();
  let error: string | null = null;
  if (!UUID.test(agentId)) error = "not_found";
  else if (page.readOnly) error = "read_only";
  else {
    try {
      await run(page, agentId);
    } catch (e) {
      if (e instanceof DomainError) error = e.code;
      else if (e instanceof ForbiddenError) error = "forbidden";
      else if (
        e instanceof Error &&
        [
          "bad_url",
          "unreachable",
          "blocked_robots",
          "no_model",
          "nothing_found",
          "bad_level",
        ].includes(e.message)
      )
        error = e.message;
      else {
        console.error("launch action failed", e instanceof Error ? e.message : e);
        error = "unknown";
      }
    }
  }
  revalidatePath(`/dashboard/agents/${agentId}/launch`);
  redirect(`/dashboard/agents/${agentId}/launch?${error ? `error=${error}` : `notice=${notice}`}`);
}

export async function goLiveAction(form: FormData) {
  const live = form.get("status") === "live";
  await launch(form, live ? "went_live" : "paused", (p, agentId) =>
    setAgentStatus(p.ctx, { tenantId: p.tenantId, agentId, status: live ? "live" : "paused" }),
  );
}

/** Reads the business's website and drafts facts for the owner to confirm (free model). */
export async function importSiteAction(form: FormData) {
  await launch(form, "imported", async (p, agentId) => {
    if (!p.can("agents.configure", agentId))
      throw new ForbiddenError("agents.configure", "missing_permission");
    const site = await readSite(field(form, "url", 300)).catch((e: Error) => {
      throw new Error(e.message === "bad_url" ? "bad_url" : "unreachable");
    });
    if (site.blockedByRobots) throw new Error("blocked_robots");
    if (site.pages.every((x) => x.text.length < 50)) throw new Error("nothing_found");
    const draft = await draftProfileFromPages(clientsFromEnv(), site.pages);
    if (!draft) throw new Error("no_model");
    return createSuggestion(p.ctx, {
      tenantId: p.tenantId,
      agentId,
      sourceUrl: site.url,
      pagesRead: site.pages.length,
      draft,
    });
  });
}

export async function applySuggestionAction(form: FormData) {
  const parts = form
    .getAll("parts")
    .map(String)
    .filter((x): x is "summary" | "hours" | "services" | "faqs" | "locations" =>
      ["summary", "hours", "services", "faqs", "locations"].includes(x),
    );
  await launch(form, "applied", (p, agentId) =>
    applySuggestion(p.ctx, {
      tenantId: p.tenantId,
      agentId,
      suggestionId: field(form, "suggestionId", 64),
      parts,
    }),
  );
}

export async function dismissSuggestionAction(form: FormData) {
  await launch(form, "saved", (p, agentId) =>
    dismissSuggestion(p.ctx, {
      tenantId: p.tenantId,
      agentId,
      suggestionId: field(form, "suggestionId", 64),
    }),
  );
}

export async function saveWidgetAction(form: FormData) {
  await launch(form, "widget_saved", (p, agentId) =>
    saveChannel(p.ctx, {
      tenantId: p.tenantId,
      agentId,
      enabled: form.get("enabled") === "on",
      origins: field(form, "origins", 2000),
      color: field(form, "color", 7),
      label: field(form, "label", 40),
    }),
  );
}

export async function disconnectCalendarAction(form: FormData) {
  await launch(form, "calendar_disconnected", (p, agentId) =>
    disconnectCalendar(p.ctx, { tenantId: p.tenantId, agentId }),
  );
}

/** Who can use this agent: one person's access level (or none). */
export async function setAccessAction(form: FormData) {
  const level = field(form, "level", 20);
  const tenantUserId = field(form, "tenantUserId", 64);
  await launch(form, "access_saved", async (p, agentId) => {
    if (!UUID.test(tenantUserId)) throw new Error("bad_level");
    if (level === "none")
      return revokeAgentAccess(p.ctx, {
        tenantId: p.tenantId,
        agentId,
        subjectType: "user",
        subjectId: tenantUserId,
      });
    if (level !== "use" && level !== "configure" && level !== "view_logs")
      throw new Error("bad_level");
    return grantAgentAccess(p.ctx, {
      tenantId: p.tenantId,
      agentId,
      subjectType: "user",
      subjectId: tenantUserId,
      level,
    });
  });
}
