import type { EmailOtpType } from "@supabase/supabase-js";
import { type NextRequest, NextResponse } from "next/server";
import { safeNext } from "@/lib/config";
import { userClient } from "@/lib/supabase/server";

const ALLOWED: EmailOtpType[] = ["email", "magiclink", "invite", "recovery"];

/**
 * Landing page for Google sign-in and emailed links (password reset). Supabase sends `?code=…`
 * (started in this browser); custom templates may send `?token_hash=…&type=…`. Both are
 * verified here on the server. A Google address without a portal account comes back with
 * `?error=…` because sign-ups are off.
 */
export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const next = safeNext(searchParams.get("next") ?? "/dashboard");
  const code = searchParams.get("code");
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;
  if (searchParams.get("error")) {
    const reason = searchParams.get("error_code") === "signup_disabled" ? "no_account" : "link";
    return NextResponse.redirect(new URL(`/login?error=${reason}`, request.url));
  }

  const supabase = await userClient();
  if (supabase) {
    if (code) {
      const { error } = await supabase.auth.exchangeCodeForSession(code);
      if (!error) return NextResponse.redirect(new URL(next, request.url));
    } else if (tokenHash && type && ALLOWED.includes(type)) {
      const { error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash });
      if (!error) return NextResponse.redirect(new URL(next, request.url));
    }
  }
  return NextResponse.redirect(new URL("/login?error=link", request.url));
}
