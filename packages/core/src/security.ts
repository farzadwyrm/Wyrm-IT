import { assertCan, check, ForbiddenError } from "@wyrm/auth";
import { tenants } from "@wyrm/db";
import { eq } from "drizzle-orm";
import { audit } from "./audit";
import { type Ctx, DomainError } from "./context";

export interface TenantSecurity {
  require_mfa?: boolean;
  allowed_domains?: string[];
  session_timeout_minutes?: number;
  /** SSO is plan-gated (Enterprise) and needs Supabase Pro: stored now, enforced later. */
  sso_enabled?: boolean;
}

const DOMAIN = /^(?=.{3,253}$)[a-z0-9-]+(\.[a-z0-9-]+)+$/;

export async function getSecurity(ctx: Ctx, tenantId: string): Promise<TenantSecurity> {
  if (ctx.actor?.kind === "platform") assertCan(ctx.actor, "tenants.view");
  else assertCan(ctx.actor, "security.view", { tenantId });
  const [tenant] = await ctx.db.select().from(tenants).where(eq(tenants.id, tenantId));
  if (!tenant) throw new DomainError("not_found", "Organisation not found.");
  return tenant.security as TenantSecurity;
}

export async function updateSecurity(ctx: Ctx, tenantId: string, patch: TenantSecurity) {
  const decision =
    ctx.actor?.kind === "platform"
      ? check(ctx.actor, "tenants.manage")
      : check(ctx.actor, "security.manage", { tenantId });
  if (!decision.allowed) throw new ForbiddenError("security.manage", decision.reason);
  const [tenant] = await ctx.db.select().from(tenants).where(eq(tenants.id, tenantId));
  if (!tenant) throw new DomainError("not_found", "Organisation not found.");
  const next: TenantSecurity = { ...(tenant.security as TenantSecurity) };
  if (patch.require_mfa !== undefined) next.require_mfa = patch.require_mfa;
  if (patch.allowed_domains !== undefined) {
    const domains = patch.allowed_domains
      .map((d) => d.trim().toLowerCase().replace(/^@/, ""))
      .filter(Boolean);
    const bad = domains.find((d) => !DOMAIN.test(d));
    if (bad) throw new DomainError("bad_domain", `"${bad}" isn't a valid domain.`);
    next.allowed_domains = [...new Set(domains)];
  }
  if (patch.session_timeout_minutes !== undefined) {
    const m = Math.round(patch.session_timeout_minutes);
    if (m < 15 || m > 7 * 24 * 60)
      throw new DomainError(
        "bad_timeout",
        "Session timeout must be between 15 minutes and 7 days.",
      );
    next.session_timeout_minutes = m;
  }
  if (patch.sso_enabled !== undefined) {
    if (patch.sso_enabled && tenant.plan !== "enterprise")
      throw new DomainError("plan", "SSO is part of the Enterprise plan.");
    next.sso_enabled = patch.sso_enabled;
  }
  await ctx.db.update(tenants).set({ security: next }).where(eq(tenants.id, tenantId));
  await audit(ctx, {
    action: "security.updated",
    tenantId,
    targetType: "tenant",
    targetId: tenantId,
    before: tenant.security,
    after: next,
  });
  return next;
}
