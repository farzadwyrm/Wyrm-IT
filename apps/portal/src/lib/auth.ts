import "server-only";
import { redirect } from "next/navigation";
import { cache } from "react";
import { userClient } from "./supabase/server";

export interface OrgAccess {
  orgId: string;
  name: string;
  slug: string;
  role: "owner" | "staff";
}

export interface Access {
  userId: string;
  email: string | null;
  isAdmin: boolean;
  orgs: OrgAccess[];
}

/**
 * The data access layer's single source of who is signed in and what they may see. Verified
 * with Supabase on every request (not just the cookie), cached for the rest of the render.
 */
export const getAccess = cache(async (): Promise<Access | null> => {
  const supabase = await userClient();
  if (!supabase) return null;
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) return null;
  const user = data.user;

  // Both queries run under row-level security: they return only this user's own rows.
  const [admin, memberships] = await Promise.all([
    supabase.from("wyrm_admins").select("user_id").eq("user_id", user.id).maybeSingle(),
    supabase
      .from("memberships")
      .select("role, organizations(id, name, slug)")
      .eq("user_id", user.id),
  ]);

  const orgs: OrgAccess[] = [];
  for (const m of (memberships.data ?? []) as unknown as {
    role: "owner" | "staff";
    organizations: { id: string; name: string; slug: string } | null;
  }[]) {
    if (m.organizations) {
      orgs.push({
        orgId: m.organizations.id,
        name: m.organizations.name,
        slug: m.organizations.slug,
        role: m.role,
      });
    }
  }
  return { userId: user.id, email: user.email ?? null, isAdmin: Boolean(admin.data), orgs };
});

export async function requireAccess(): Promise<Access> {
  const access = await getAccess();
  if (!access) redirect("/login");
  return access;
}

export async function requireAdmin(): Promise<Access> {
  const access = await requireAccess();
  if (!access.isAdmin) redirect("/");
  return access;
}
