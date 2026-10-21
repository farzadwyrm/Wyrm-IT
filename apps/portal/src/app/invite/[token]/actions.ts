"use server";

import { acceptInvitation, DomainError, findInvitation } from "@wyrm/core";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { getAccess } from "@/lib/auth";
import { serverDb } from "@/lib/db";
import { adminClient } from "@/lib/supabase/admin";
import { userClient } from "@/lib/supabase/server";

const back = (token: string, query: string) =>
  redirect(`/invite/${encodeURIComponent(token)}?${query}`);

/**
 * Emails a sign-in link to the invited address. The invitation proves Wyrm or the
 * organisation invited this email, so its login is created here if it doesn't exist yet.
 */
export async function sendInviteSignIn(formData: FormData) {
  const token = String(formData.get("token") ?? "");
  const db = serverDb();
  const supabase = await userClient();
  const admin = adminClient();
  if (!db || !supabase || !admin) back(token, "error=setup");
  if (!db || !supabase || !admin) return;

  const invite = await findInvitation({ db, actor: null }, token);
  if (invite?.status !== "pending") back(token, "error=invalid");
  if (!invite) return;

  const created = await admin.auth.admin.createUser({ email: invite.email, email_confirm: true });
  if (created.error && created.error.code !== "email_exists") {
    console.warn(`invite account failed: code=${created.error.code ?? ""}`);
    back(token, "error=account");
  }
  const origin = (await headers()).get("origin") ?? "";
  const next = `/invite/${token}`;
  const { error } = await supabase.auth.signInWithOtp({
    email: invite.email,
    options: {
      shouldCreateUser: false,
      emailRedirectTo: `${origin}/auth/confirm?next=${encodeURIComponent(next)}`,
    },
  });
  if (error)
    console.warn(
      `invite sign-in link failed: status=${error.status ?? ""} code=${error.code ?? ""}`,
    );
  back(token, error ? "error=email" : "sent=1");
}

export async function acceptInvite(formData: FormData) {
  const token = String(formData.get("token") ?? "");
  const access = await getAccess();
  const db = serverDb();
  if (!access?.email || !db) back(token, "error=signin");
  if (!access?.email || !db) return;

  let failure: string | null = null;
  try {
    await acceptInvitation(
      { db, actor: null },
      { token, userId: access.userId, email: access.email },
    );
  } catch (error) {
    failure = error instanceof DomainError ? error.code : "unknown";
    if (!(error instanceof DomainError))
      console.error("accept failed", error instanceof Error ? error.message : error);
  }
  if (failure) back(token, `error=${encodeURIComponent(failure)}`);
  redirect("/dashboard");
}
