"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { isEmail, safeNext } from "@/lib/config";
import { userClient } from "@/lib/supabase/server";

/**
 * Emails a sign-in link. Invite-only: `shouldCreateUser: false`, so unknown addresses get no
 * account. The reply is the same either way, so nobody can test which emails are clients.
 */
export async function sendSignInLink(formData: FormData) {
  const email = String(formData.get("email") ?? "")
    .trim()
    .toLowerCase();
  const next = safeNext(String(formData.get("next") ?? "/"));
  if (!isEmail(email)) redirect(`/login?error=email&next=${encodeURIComponent(next)}`);

  const supabase = await userClient();
  if (!supabase) redirect("/login");

  const origin = (await headers()).get("origin") ?? "";
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: {
      shouldCreateUser: false,
      emailRedirectTo: `${origin}/auth/confirm?next=${encodeURIComponent(next)}`,
    },
  });
  // Log failures for us, but never tell the visitor whether the address exists.
  if (error && error.status !== 422 && error.code !== "otp_disabled") {
    // Shape only, never the key itself: e.g. "sb_p… 46 chars" helps spot a bad paste.
    const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? "";
    console.warn(
      `sign-in link failed: status=${error.status ?? ""} code=${error.code ?? ""} name=${error.name} key=${key.slice(0, 4)}… ${key.length} chars`,
    );
  }
  redirect("/login?sent=1");
}
