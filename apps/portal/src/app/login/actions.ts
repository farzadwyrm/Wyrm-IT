"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { isEmail, safeNext } from "@/lib/config";
import { userClient } from "@/lib/supabase/server";

const back = (query: Record<string, string>) =>
  redirect(`/login?${new URLSearchParams(query).toString()}`);

async function origin() {
  return (await headers()).get("origin") ?? "";
}

/** Email and password. One generic error, so nobody can test which emails have accounts. */
export async function signInWithPassword(formData: FormData) {
  const email = String(formData.get("email") ?? "")
    .trim()
    .toLowerCase();
  const password = String(formData.get("password") ?? "");
  const next = safeNext(String(formData.get("next") ?? "/dashboard"));
  if (!isEmail(email) || password.length === 0) back({ error: "credentials", next });

  const supabase = await userClient();
  if (!supabase) back({ next });
  const { error } = (await supabase?.auth.signInWithPassword({ email, password })) ?? {};
  if (error) {
    if (error.status !== 400)
      console.warn(
        `password sign-in failed: status=${error.status ?? ""} code=${error.code ?? ""}`,
      );
    back({ error: error.status === 429 ? "busy" : "credentials", next });
  }
  redirect(next);
}

/**
 * Google sign-in. Accounts are invite-only (sign-ups are off in Supabase), so Google works for
 * people who already have an account with the same email address.
 */
export async function signInWithGoogle(formData: FormData) {
  const next = safeNext(String(formData.get("next") ?? "/dashboard"));
  const supabase = await userClient();
  if (!supabase) back({ next });
  const { data, error } = (await supabase?.auth.signInWithOAuth({
    provider: "google",
    options: { redirectTo: `${await origin()}/auth/confirm?next=${encodeURIComponent(next)}` },
  })) ?? { data: null, error: null };
  if (error || !data?.url) {
    console.warn(`google sign-in failed: code=${error?.code ?? ""}`);
    back({ error: "google", next });
  }
  redirect(data?.url ?? "/login");
}

/** Emails a link to choose a new password. Same reply whether or not the email exists. */
export async function sendPasswordReset(formData: FormData) {
  const email = String(formData.get("email") ?? "")
    .trim()
    .toLowerCase();
  if (!isEmail(email)) back({ mode: "reset", error: "email" });
  const supabase = await userClient();
  if (!supabase) back({});
  const { error } =
    (await supabase?.auth.resetPasswordForEmail(email, {
      redirectTo: `${await origin()}/auth/confirm?next=${encodeURIComponent("/account/password")}`,
    })) ?? {};
  if (error && error.status !== 422) {
    console.warn(`password reset failed: status=${error.status ?? ""} code=${error.code ?? ""}`);
  }
  back({ mode: "reset", sent: "1" });
}
