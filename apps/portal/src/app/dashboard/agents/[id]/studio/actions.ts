"use server";

import { ForbiddenError } from "@wyrm/auth";
import {
  addProcedure,
  DomainError,
  deleteRule,
  publishPolicy,
  saveLimits,
  saveProfile,
  saveRule,
  setRuleEnabled,
  updateProcedure,
} from "@wyrm/core";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireTenant } from "@/lib/portal";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const field = (form: FormData, name: string, max = 2000) =>
  String(form.get(name) ?? "")
    .trim()
    .slice(0, max);
const lines = (text: string) =>
  text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);

/** Runs a Studio change and goes back to the same tab with a notice or error code. */
async function studio(
  form: FormData,
  notice: string,
  run: (p: Awaited<ReturnType<typeof requireTenant>>, agentId: string) => Promise<unknown>,
) {
  const agentId = field(form, "agentId", 64);
  const tab = field(form, "tab", 20) || "facts";
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
      else {
        console.error("studio action failed", e instanceof Error ? e.message : e);
        error = "unknown";
      }
    }
  }
  revalidatePath(`/dashboard/agents/${agentId}/studio`);
  redirect(
    `/dashboard/agents/${agentId}/studio?tab=${tab}&${error ? `error=${error}` : `notice=${notice}`}`,
  );
}

export async function saveFactsAction(form: FormData) {
  await studio(form, "saved", (p, agentId) => {
    const hours: Record<string, { open: string; close: string } | null> = {};
    for (const day of ["mon", "tue", "wed", "thu", "fri", "sat", "sun"]) {
      hours[day] = form.get(`${day}_closed`)
        ? null
        : { open: field(form, `${day}_open`, 5), close: field(form, `${day}_close`, 5) };
    }
    const split = (l: string) => l.split("|").map((x) => x.trim());
    return saveProfile(
      p.ctx,
      p.tenantId,
      {
        summary: field(form, "summary", 600),
        timezone: field(form, "timezone", 60),
        hours,
        services: lines(field(form, "services", 6000)).map((l) => {
          const [name = "", price = "", duration = ""] = split(l);
          return { name, price, duration };
        }),
        locations: lines(field(form, "locations", 2000)).map((address) => ({ address })),
        faqs: lines(field(form, "faqs", 12000)).map((l) => {
          const [question = "", ...rest] = split(l);
          return { question, answer: rest.join(" | ") };
        }),
        other: field(form, "other", 2000),
      },
      field(form, "note", 500),
      agentId,
    );
  });
}

export async function saveRuleAction(form: FormData) {
  await studio(form, "saved", (p, agentId) =>
    saveRule(p.ctx, {
      tenantId: p.tenantId,
      agentId,
      ...(UUID.test(field(form, "ruleId", 64)) ? { ruleId: field(form, "ruleId", 64) } : {}),
      text: field(form, "text", 300),
      scope: {
        channels: form.getAll("channels").map(String),
        when: field(form, "when", 10),
        callers: field(form, "callers", 10),
      },
      priority: Number(field(form, "priority", 3)) || 0,
      note: field(form, "note", 500),
    }),
  );
}

export async function ruleStateAction(form: FormData) {
  const op = field(form, "op", 10);
  await studio(form, "saved", (p, agentId) => {
    const base = {
      tenantId: p.tenantId,
      agentId,
      ruleId: field(form, "ruleId", 64),
      note: field(form, "note", 500),
    };
    if (op === "delete") return deleteRule(p.ctx, base);
    return setRuleEnabled(p.ctx, { ...base, enabled: op === "enable" });
  });
}

export async function addProcedureAction(form: FormData) {
  await studio(form, "saved", (p, agentId) =>
    addProcedure(p.ctx, {
      tenantId: p.tenantId,
      agentId,
      template: field(form, "template", 20) as "book",
      note: field(form, "note", 500) || `Added ${field(form, "template", 20)} procedure`,
    }),
  );
}

export async function saveProcedureAction(form: FormData) {
  await studio(form, "saved", (p, agentId) =>
    updateProcedure(p.ctx, {
      tenantId: p.tenantId,
      agentId,
      procedureId: field(form, "procedureId", 64),
      name: field(form, "name", 80),
      whenToUse: field(form, "whenToUse", 512),
      whenNotToUse: field(form, "whenNotToUse", 512),
      steps: lines(field(form, "steps", 4000)),
      confirmBeforeActing: form.get("confirm") === "on",
      enabled: form.get("enabled") === "on",
      note: field(form, "note", 500),
    }),
  );
}

export async function saveLimitsAction(form: FormData) {
  await studio(form, "saved", (p, agentId) =>
    saveLimits(p.ctx, {
      tenantId: p.tenantId,
      agentId,
      limits: {
        maxDiscountPercent: field(form, "maxDiscountPercent", 4),
        bookingWindowDays: field(form, "bookingWindowDays", 4),
        minNoticeHours: field(form, "minNoticeHours", 4),
        cancellationNoticeHours: field(form, "cancellationNoticeHours", 4),
        afterHours: field(form, "afterHours", 20),
        blockedTopics: field(form, "blockedTopics", 1200),
        handoffContact: field(form, "handoffContact", 200),
        handoffWhen: form.getAll("handoffWhen").map(String),
        tone: field(form, "tone", 10),
        replyLength: field(form, "replyLength", 10),
      },
      note: field(form, "note", 500),
    }),
  );
}

export async function publishAction(form: FormData) {
  await studio(form, "published", (p, agentId) =>
    publishPolicy(p.ctx, { tenantId: p.tenantId, agentId, note: field(form, "note", 500) }),
  );
}
