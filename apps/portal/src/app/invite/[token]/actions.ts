"use server";

import { acceptInvitation, DomainError, findInvitation } from "@wyrm/core";
import { redirect } from "next/navigation";
import { getAccess } from "@/lib/auth";
import { passwordProblem } from "@/lib/config";
import { serverDb } from "@/lib/db";
import { adminClient } from "@/lib/supabase/admin";
import { userClient } from "@/lib/supabase/server";

const back = (token: string, query: string) =>
  redirect(`/invite/${encodeURIComponent(token)}?${query}`);

/** Joins the organisation; returns a DomainError code to show, or null on success. */
async function join(token: string, userId: string, email: string): Promise<string | null> {
  const db = serverDb();
  if (!db) return "setup";
  try {
    await acceptInvitation({ db, actor: null }, { token, userId, email });
    return null;
  } catch (error) {
    if (error instanceof DomainError) return error.code;
    console.error("accept failed", error instanceof Error ? error.message : error);
    return "unknown";
  }
}

/**
 * New invitees choose a password here: the invitation (sent to this exact email by Wyrm or the
 * organisation) proves the address, so the login is created confirmed, then signed in and
 * joined in one step. Existing accounts sign in instead; their password is never overwritten.
 */
export async function createAccountAndJoin(formData: FormData) {
  const token = String(formData.get("token") ?? "");
  const password = String(formData.get("password") ?? "");
  const problem = passwordProblem(password, String(formData.get("confirm") ?? ""));
  if (problem) back(token, "error=password");

  const db = serverDb();
  const supabase = await userClient();
  const admin = adminClient();
  if (!db || !supabase || !admin) back(token, "error=setup");
  if (!db || !supabase || !admin) return;

  const invite = await findInvitation({ db, actor: null }, token);
  if (invite?.status !== "pending") back(token, "error=invalid");
  if (!invite) return;

  const created = await admin.auth.admin.createUser({
    email: invite.email,
    password,
    email_confirm: true,
  });
  if (created.error) {
    if (created.error.code === "email_exists") back(token, "error=has_account");
    if (created.error.code === "weak_password") back(token, "error=weak");
    console.warn(`invite account failed: code=${created.error.code ?? ""}`);
    back(token, "error=account");
  }
  const { data, error } = await supabase.auth.signInWithPassword({
    email: invite.email,
    password,
  });
  if (error || !data.user) back(token, "error=account");
  if (!data.user) return;

  const failure = await join(token, data.user.id, invite.email);
  if (failure) back(token, `error=${encodeURIComponent(failure)}`);
  redirect("/dashboard");
}

/** Someone already signed in with the invited email accepts. */
export async function acceptInvite(formData: FormData) {
  const token = String(formData.get("token") ?? "");
  const access = await getAccess();
  if (!access?.email) back(token, "error=signin");
  if (!access?.email) return;
  const failure = await join(token, access.userId, access.email);
  if (failure) back(token, `error=${encodeURIComponent(failure)}`);
  redirect("/dashboard");
}
