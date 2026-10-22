import {
  assertCan,
  type check,
  checkRoleChange,
  checkStaffLifecycle,
  ForbiddenError,
  type TenantRoleInfo,
} from "@wyrm/auth";
import { invitations, roles, tenants, tenantUsers } from "@wyrm/db";
import { and, asc, eq, ilike, inArray, isNull, lte, or, type SQL } from "drizzle-orm";
import { audit } from "./audit";
import { type Ctx, DomainError, guarded } from "./context";
import { hashToken, newToken } from "./tenants";

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const roleInfo = (r: typeof roles.$inferSelect): TenantRoleInfo => ({
  id: r.id,
  key: r.key,
  rank: r.rank,
  permissions: r.permissions,
});

function assertDecision(
  decision: { allowed: boolean; reason?: string },
  permission: Parameters<typeof check>[1],
) {
  if (!decision.allowed) throw new ForbiddenError(permission, decision.reason ?? "denied");
}

/** Staff can read their own org; Wyrm staff need tenant_users.view. */
function assertCanViewStaff(ctx: Ctx, tenantId: string) {
  if (ctx.actor?.kind === "platform") assertCan(ctx.actor, "tenant_users.view");
  else assertCan(ctx.actor, "staff.view", { tenantId });
}

async function getRole(ctx: Ctx, tenantId: string, roleId: string) {
  const [role] = await ctx.db
    .select()
    .from(roles)
    .where(and(eq(roles.id, roleId), or(isNull(roles.tenantId), eq(roles.tenantId, tenantId))));
  if (!role) throw new DomainError("not_found", "Role not found.");
  return role;
}

async function getMember(ctx: Ctx, tenantId: string, tenantUserId: string) {
  const [row] = await ctx.db
    .select({ tu: tenantUsers, role: roles })
    .from(tenantUsers)
    .innerJoin(roles, eq(roles.id, tenantUsers.roleId))
    .where(and(eq(tenantUsers.id, tenantUserId), eq(tenantUsers.tenantId, tenantId)));
  if (!row) throw new DomainError("not_found", "Member not found in this organisation.");
  return row;
}

export async function listStaff(
  ctx: Ctx,
  tenantId: string,
  filter: {
    search?: string;
    status?: "active" | "deactivated";
    roleId?: string;
    limit?: number;
    offset?: number;
  } = {},
) {
  assertCanViewStaff(ctx, tenantId);
  const where: SQL[] = [eq(tenantUsers.tenantId, tenantId)];
  if (filter.status) where.push(eq(tenantUsers.status, filter.status));
  if (filter.roleId) where.push(eq(tenantUsers.roleId, filter.roleId));
  if (filter.search) {
    const q = `%${filter.search.replace(/[%_]/g, "")}%`;
    const cond = or(ilike(tenantUsers.email, q), ilike(tenantUsers.name, q));
    if (cond) where.push(cond);
  }
  return ctx.db
    .select({
      id: tenantUsers.id,
      userId: tenantUsers.userId,
      email: tenantUsers.email,
      name: tenantUsers.name,
      status: tenantUsers.status,
      isOwner: tenantUsers.isOwner,
      lastLoginAt: tenantUsers.lastLoginAt,
      roleId: roles.id,
      roleName: roles.name,
      roleRank: roles.rank,
      rolePermissions: roles.permissions,
    })
    .from(tenantUsers)
    .innerJoin(roles, eq(roles.id, tenantUsers.roleId))
    .where(and(...where))
    .orderBy(asc(tenantUsers.email))
    .limit(Math.min(filter.limit ?? 50, 200))
    .offset(filter.offset ?? 0);
}

/**
 * Invites someone by email with a role. Enforces no-escalation, allowed email domains and the
 * seat limit (in the database). Returns the token once, for the invitation email.
 */
export async function inviteStaff(
  ctx: Ctx,
  input: { tenantId: string; email: string; roleId: string },
) {
  const email = input.email.trim().toLowerCase();
  if (!EMAIL.test(email)) throw new DomainError("bad_email", "That email doesn't look right.");
  const role = await getRole(ctx, input.tenantId, input.roleId);
  assertDecision(
    checkRoleChange(ctx.actor, { tenantId: input.tenantId, newRole: roleInfo(role), target: null }),
    "staff.invite",
  );

  const [tenant] = await ctx.db.select().from(tenants).where(eq(tenants.id, input.tenantId));
  if (tenant?.status !== "active")
    throw new DomainError("tenant_suspended", "This organisation is suspended.");
  const domains = ((tenant.security as { allowed_domains?: string[] }).allowed_domains ?? []).map(
    (d) => d.toLowerCase(),
  );
  if (domains.length && !domains.includes(email.split("@")[1] ?? "")) {
    throw new DomainError(
      "domain_not_allowed",
      `Only ${domains.join(", ")} addresses can be invited.`,
    );
  }

  const token = newToken();
  const invitation = await guarded(() =>
    ctx.db.transaction(async (tx) => {
      // Expired invitations no longer hold a seat or block a new one.
      await tx
        .update(invitations)
        .set({ status: "expired" })
        .where(
          and(
            eq(invitations.tenantId, input.tenantId),
            eq(invitations.email, email),
            eq(invitations.status, "pending"),
            lte(invitations.expiresAt, new Date()),
          ),
        );
      const [row] = await tx
        .insert(invitations)
        .values({
          tenantId: input.tenantId,
          email,
          roleId: role.id,
          tokenHash: hashToken(token),
          invitedBy:
            ctx.actor?.kind === "platform"
              ? ctx.actor.userId
              : ctx.actor?.kind === "tenant"
                ? ctx.actor.userId
                : null,
          expiresAt: new Date(Date.now() + 7 * 86_400_000),
        })
        .returning();
      await audit(
        ctx,
        {
          action: "invitation.created",
          tenantId: input.tenantId,
          targetType: "invitation",
          targetId: row?.id,
          after: { email, role: role.key },
        },
        tx,
      );
      return row;
    }),
  );
  return { invitation, token };
}

export async function listInvitations(ctx: Ctx, tenantId: string) {
  if (ctx.actor?.kind === "platform") assertCan(ctx.actor, "tenant_users.view");
  else assertCan(ctx.actor, "staff.invite", { tenantId });
  return ctx.db
    .select({
      id: invitations.id,
      email: invitations.email,
      status: invitations.status,
      expiresAt: invitations.expiresAt,
      roleName: roles.name,
    })
    .from(invitations)
    .innerJoin(roles, eq(roles.id, invitations.roleId))
    .where(eq(invitations.tenantId, tenantId))
    .orderBy(asc(invitations.email));
}

async function assertCanManageInvites(ctx: Ctx, tenantId: string) {
  if (ctx.actor?.kind === "platform") assertCan(ctx.actor, "tenant_users.manage");
  else assertCan(ctx.actor, "staff.invite", { tenantId });
}

export async function revokeInvitation(ctx: Ctx, tenantId: string, invitationId: string) {
  await assertCanManageInvites(ctx, tenantId);
  const [row] = await ctx.db
    .update(invitations)
    .set({ status: "revoked" })
    .where(
      and(
        eq(invitations.id, invitationId),
        eq(invitations.tenantId, tenantId),
        eq(invitations.status, "pending"),
      ),
    )
    .returning();
  if (!row) throw new DomainError("not_found", "No pending invitation to revoke.");
  await audit(ctx, {
    action: "invitation.revoked",
    tenantId,
    targetType: "invitation",
    targetId: invitationId,
    before: { email: row.email },
  });
}

/** New link and a fresh 7 days; the old link stops working. */
export async function resendInvitation(ctx: Ctx, tenantId: string, invitationId: string) {
  await assertCanManageInvites(ctx, tenantId);
  const token = newToken();
  const [row] = await ctx.db
    .update(invitations)
    .set({
      tokenHash: hashToken(token),
      expiresAt: new Date(Date.now() + 7 * 86_400_000),
      status: "pending",
    })
    .where(
      and(
        eq(invitations.id, invitationId),
        eq(invitations.tenantId, tenantId),
        inArray(invitations.status, ["pending", "expired"]),
      ),
    )
    .returning();
  if (!row) throw new DomainError("not_found", "No invitation to resend.");
  await audit(ctx, {
    action: "invitation.resent",
    tenantId,
    targetType: "invitation",
    targetId: invitationId,
    after: { email: row.email },
  });
  return { invitation: row, token };
}

/** Looks up an invitation by its token, for the acceptance page. */
export async function findInvitation(ctx: Ctx, token: string) {
  const [row] = await ctx.db
    .select({ inv: invitations, tenant: tenants, role: roles })
    .from(invitations)
    .innerJoin(tenants, eq(tenants.id, invitations.tenantId))
    .innerJoin(roles, eq(roles.id, invitations.roleId))
    .where(eq(invitations.tokenHash, hashToken(token)));
  if (!row) return null;
  const expired = row.inv.status === "pending" && row.inv.expiresAt <= new Date();
  return {
    id: row.inv.id,
    email: row.inv.email,
    status: expired ? ("expired" as const) : row.inv.status,
    tenantId: row.tenant.id,
    tenantName: row.tenant.name,
    tenantActive: row.tenant.status === "active",
    roleName: row.role.name,
  };
}

/** The signed-in invitee joins. Their login email must match the invitation. */
export async function acceptInvitation(
  ctx: Ctx,
  input: { token: string; userId: string; email: string },
) {
  const found = await findInvitation(ctx, input.token);
  if (found?.status !== "pending")
    throw new DomainError(
      "invalid_invitation",
      "This invitation is no longer valid. Ask for a new one.",
    );
  if (!found.tenantActive)
    throw new DomainError("tenant_suspended", "This organisation is suspended.");
  if (found.email !== input.email.trim().toLowerCase()) {
    throw new DomainError(
      "wrong_account",
      `This invitation is for ${found.email}. Sign in with that address.`,
    );
  }
  return guarded(() =>
    ctx.db.transaction(async (tx) => {
      const [inv] = await tx.select().from(invitations).where(eq(invitations.id, found.id));
      if (!inv) throw new DomainError("invalid_invitation", "This invitation is no longer valid.");
      const [member] = await tx
        .insert(tenantUsers)
        .values({
          tenantId: inv.tenantId,
          userId: input.userId,
          email: inv.email,
          roleId: inv.roleId,
        })
        .returning();
      await tx
        .update(invitations)
        .set({ status: "accepted", acceptedAt: new Date() })
        .where(eq(invitations.id, inv.id));
      await audit(
        { ...ctx, actor: null },
        {
          action: "invitation.accepted",
          tenantId: inv.tenantId,
          targetType: "tenant_user",
          targetId: member?.id,
          after: { email: inv.email },
        },
        tx,
      );
      return member;
    }),
  );
}

export async function changeRole(
  ctx: Ctx,
  input: { tenantId: string; tenantUserId: string; roleId: string },
) {
  const member = await getMember(ctx, input.tenantId, input.tenantUserId);
  const role = await getRole(ctx, input.tenantId, input.roleId);
  assertDecision(
    checkRoleChange(ctx.actor, {
      tenantId: input.tenantId,
      newRole: roleInfo(role),
      target: { userId: member.tu.userId, currentRole: roleInfo(member.role) },
    }),
    "staff.edit",
  );
  if (member.tu.isOwner)
    throw new DomainError("owner_required", "Transfer ownership before changing the owner's role.");
  await guarded(() =>
    ctx.db.update(tenantUsers).set({ roleId: role.id }).where(eq(tenantUsers.id, member.tu.id)),
  );
  await audit(ctx, {
    action: "staff.role_changed",
    tenantId: input.tenantId,
    targetType: "tenant_user",
    targetId: member.tu.id,
    before: { role: member.role.key },
    after: { role: role.key },
  });
  return { email: member.tu.email, roleName: role.name };
}

export async function setStaffStatus(
  ctx: Ctx,
  input: { tenantId: string; tenantUserId: string; status: "active" | "deactivated" },
) {
  const member = await getMember(ctx, input.tenantId, input.tenantUserId);
  assertDecision(
    checkStaffLifecycle(ctx.actor, input.status === "active" ? "reactivate" : "deactivate", {
      tenantId: input.tenantId,
      target: { userId: member.tu.userId, role: roleInfo(member.role) },
    }),
    "staff.deactivate",
  );
  await guarded(() =>
    ctx.db
      .update(tenantUsers)
      .set({ status: input.status })
      .where(eq(tenantUsers.id, member.tu.id)),
  );
  await audit(ctx, {
    action: input.status === "active" ? "staff.reactivated" : "staff.deactivated",
    tenantId: input.tenantId,
    targetType: "tenant_user",
    targetId: member.tu.id,
    before: { status: member.tu.status },
    after: { status: input.status },
  });
  return { email: member.tu.email };
}

export async function removeStaff(ctx: Ctx, input: { tenantId: string; tenantUserId: string }) {
  const member = await getMember(ctx, input.tenantId, input.tenantUserId);
  assertDecision(
    checkStaffLifecycle(ctx.actor, "remove", {
      tenantId: input.tenantId,
      target: { userId: member.tu.userId, role: roleInfo(member.role) },
    }),
    "staff.remove",
  );
  await guarded(() => ctx.db.delete(tenantUsers).where(eq(tenantUsers.id, member.tu.id)));
  await audit(ctx, {
    action: "staff.removed",
    tenantId: input.tenantId,
    targetType: "tenant_user",
    targetId: member.tu.id,
    before: { email: member.tu.email, role: member.role.key },
  });
}

/** Bulk actions apply the same checks to each person and report per-person results. */
export async function bulkStaff(
  ctx: Ctx,
  input: {
    tenantId: string;
    tenantUserIds: string[];
    action: "deactivate" | "reactivate" | "change_role";
    roleId?: string;
  },
) {
  const results: { tenantUserId: string; ok: boolean; error?: string }[] = [];
  for (const tenantUserId of input.tenantUserIds.slice(0, 200)) {
    try {
      if (input.action === "change_role") {
        if (!input.roleId) throw new DomainError("bad_input", "Choose a role.");
        await changeRole(ctx, { tenantId: input.tenantId, tenantUserId, roleId: input.roleId });
      } else {
        await setStaffStatus(ctx, {
          tenantId: input.tenantId,
          tenantUserId,
          status: input.action === "reactivate" ? "active" : "deactivated",
        });
      }
      results.push({ tenantUserId, ok: true });
    } catch (error) {
      results.push({
        tenantUserId,
        ok: false,
        error: error instanceof Error ? error.message : "failed",
      });
    }
  }
  return results;
}
