"use server";

import { ForbiddenError } from "@wyrm/auth";
import {
  addProcedure,
  DomainError,
  deleteRule,
  getStudio,
  policyFromConfig,
  publishPolicy,
  runTests,
  saveLimits,
  saveProfile,
  saveRule,
  saveTest,
  setRuleEnabled,
  setTestActive,
  updateProcedure,
} from "@wyrm/core";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { modelDeps } from "@/lib/models";
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

/** A list posted as JSON by the row editors; anything malformed counts as an empty list. */
function jsonList(form: FormData, name: string): unknown[] {
  try {
    const value: unknown = JSON.parse(field(form, name, 60_000) || "[]");
    return Array.isArray(value) ? value : [];
  } catch {
    return [];
  }
}

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
    return saveProfile(
      p.ctx,
      p.tenantId,
      {
        summary: field(form, "summary", 600),
        timezone: field(form, "timezone", 60),
        hours,
        // Row editors post JSON lists; saveProfile cleans and caps every value.
        services: jsonList(form, "services_json"),
        locations: jsonList(form, "locations_json"),
        faqs: jsonList(form, "faqs_json"),
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

/** Publishing runs the agent's tests on the draft first; a failing required test blocks it. */
export async function publishAction(form: FormData) {
  form.set("tab", "tests");
  await studio(form, "published", (p, agentId) =>
    publishPolicy(p.ctx, {
      tenantId: p.tenantId,
      agentId,
      note: field(form, "note", 500),
      gate: modelDeps(),
    }),
  );
}

/** Runs the tests on the current draft (nothing is published, saved as a conversation or sent). */
export async function runTestsAction(form: FormData) {
  form.set("tab", "tests");
  await studio(form, "tests_ran", async (p, agentId) => {
    const { policy } = await getStudio(p.ctx, p.tenantId, agentId);
    const draft = policyFromConfig({
      version: 2,
      profile: policy.profile,
      rules: policy.rules.filter((r) => r.enabled),
      procedures: policy.procedures.filter((x) => x.enabled),
      limits: policy.limits,
    });
    const { deps, judge } = modelDeps();
    return runTests(p.ctx, {
      tenantId: p.tenantId,
      agentId,
      target: "draft",
      policy: draft,
      deps,
      judge,
    });
  });
}

export async function saveTestAction(form: FormData) {
  form.set("tab", "tests");
  const handoff = field(form, "expectedHandoff", 5);
  await studio(form, "saved", (p, agentId) =>
    saveTest(p.ctx, {
      tenantId: p.tenantId,
      agentId,
      ...(UUID.test(field(form, "testId", 64)) ? { testId: field(form, "testId", 64) } : {}),
      name: field(form, "name", 120),
      turns: lines(field(form, "turns", 6000)),
      expectation: field(form, "expectation", 1000),
      expectedAction: field(form, "expectedAction", 40) || null,
      expectedHandoff: handoff === "yes" ? true : handoff === "no" ? false : null,
      required: form.get("required") === "on",
    }),
  );
}

export async function testActiveAction(form: FormData) {
  form.set("tab", "tests");
  await studio(form, "saved", (p, agentId) =>
    setTestActive(p.ctx, {
      tenantId: p.tenantId,
      agentId,
      testId: field(form, "testId", 64),
      active: form.get("active") === "1",
    }),
  );
}
