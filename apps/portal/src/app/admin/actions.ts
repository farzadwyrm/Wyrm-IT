"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/auth";
import { isEmail, isValidSlug, slugify } from "@/lib/config";
import { adminClient } from "@/lib/supabase/admin";

const fail = (reason: string) => redirect(`/admin?error=${encodeURIComponent(reason)}`);

/**
 * Creates a client: organisation, a draft receptionist agent, and an invitation for the owner.
 * Wyrm admins only (checked here on the server, not just in the page).
 */
export async function createClientOrg(formData: FormData) {
  const admin = await requireAdmin();
  const name = String(formData.get("name") ?? "").trim();
  const slug = slugify(String(formData.get("slug") ?? "") || name);
  const ownerEmail = String(formData.get("ownerEmail") ?? "")
    .trim()
    .toLowerCase();

  if (name.length < 2 || name.length > 120) fail("Business name must be 2–120 characters.");
  if (!isValidSlug(slug)) fail("Short name must be 2–60 lower-case letters, digits or dashes.");
  if (!isEmail(ownerEmail)) fail("Owner email doesn't look right.");

  const db = adminClient();
  if (!db) fail("The server's Supabase secret key isn't set.");
  if (!db) return;

  const org = await db.from("organizations").insert({ name, slug }).select("id").single();
  if (org.error || !org.data) {
    fail(org.error?.code === "23505" ? "That short name is taken." : "Couldn't create the client.");
    return;
  }
  const orgId = org.data.id as string;

  await db.from("agents").insert({ org_id: orgId, type: "receptionist", status: "draft" });

  const origin = (await headers()).get("origin") ?? "";
  const invite = await db.auth.admin.inviteUserByEmail(ownerEmail, {
    redirectTo: `${origin}/auth/callback`,
  });
  let ownerId = invite.data.user?.id ?? null;
  if (!ownerId) {
    // Already has an account (e.g. owns another business): link it instead of inviting.
    const existing = await db.rpc("user_id_by_email", { email_address: ownerEmail });
    ownerId = (existing.data as string | null) ?? null;
  }
  if (!ownerId) {
    fail("Client created, but the owner invite failed. Try inviting again.");
    return;
  }
  await db.from("memberships").insert({ org_id: orgId, user_id: ownerId, role: "owner" });
  await db.from("audit_log").insert({
    org_id: orgId,
    user_id: admin.userId,
    action: "client.created",
    target: slug,
  });

  revalidatePath("/admin");
  redirect(`/admin?created=${encodeURIComponent(slug)}`);
}
