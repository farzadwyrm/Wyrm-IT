import "server-only";
import type { Actor } from "@wyrm/auth";
import { type Ctx, listMyTenants, loadActor } from "@wyrm/core";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";
import { serverDb } from "./db";
import { userClient } from "./supabase/server";

/**
 * Two-step verification for Wyrm staff is switched on together with its set-up screen (stage 7).
 * Until then staff sign in with the magic link alone.
 */
const STAFF_MFA_ENFORCED = false;

/** Cookie holding a Wyrm staff member's open "view as" session id (checked in the database). */
export const VIEW_AS_COOKIE = "wyrm_view_as";

const viewAsId = (value: string | undefined) =>
  value && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(value)
    ? value
    : null;

export interface TenantAccess {
  tenantUserId: string;
  tenantId: string;
  name: string;
  slug: string;
  roleName: string;
}

export interface Access {
  userId: string;
  email: string | null;
  /** Null when the login has no active access (e.g. its organisation is suspended). */
  actor: Actor | null;
  /** Wyrm staff (platform users). */
  isAdmin: boolean;
  tenants: TenantAccess[];
  /** False when the server can't reach the database; pages say so instead of failing. */
  dbReady: boolean;
}

/**
 * The data access layer's single source of who is signed in and what they may do. The session
 * is verified with Supabase on every request, then the actor is loaded from the database and
 * cached for the rest of the render.
 */
export const getAccess = cache(async (): Promise<Access | null> => {
  const supabase = await userClient();
  if (!supabase) return null;
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) return null;
  const user = data.user;
  const base = { userId: user.id, email: user.email ?? null };

  const db = serverDb();
  if (!db) return { ...base, actor: null, isAdmin: false, tenants: [], dbReady: false };
  try {
    const { data: aal } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
    const mfa = !STAFF_MFA_ENFORCED || aal?.currentLevel === "aal2";
    const [actor, tenants] = await Promise.all([
      loadActor(db, {
        userId: user.id,
        mfa,
        viewAsSessionId: viewAsId((await cookies()).get(VIEW_AS_COOKIE)?.value),
      }),
      listMyTenants(db, user.id),
    ]);
    const isAdmin = actor?.kind === "platform" || actor?.kind === "impersonating";
    return { ...base, actor, isAdmin, tenants, dbReady: true };
  } catch (cause) {
    console.error("portal: loading access failed", cause instanceof Error ? cause.message : cause);
    return { ...base, actor: null, isAdmin: false, tenants: [], dbReady: false };
  }
});

export async function requireAccess(): Promise<Access> {
  const access = await getAccess();
  if (!access) redirect("/login");
  return access;
}

export async function requireAdmin(): Promise<Access> {
  const access = await requireAccess();
  if (!access.isAdmin) redirect("/dashboard");
  return access;
}

/** The context every `@wyrm/core` call needs: database, verified actor and caller IP. */
export async function coreContext(access: Access): Promise<Ctx> {
  const db = serverDb();
  if (!db) throw new Error("DATABASE_URL is not set");
  const ip = (await headers()).get("x-forwarded-for")?.split(",")[0]?.trim() || null;
  return { db, actor: access.actor, ip };
}
