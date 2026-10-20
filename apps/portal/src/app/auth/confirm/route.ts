import type { EmailOtpType } from "@supabase/supabase-js";
import { type NextRequest, NextResponse } from "next/server";
import { safeNext } from "@/lib/config";
import { userClient } from "@/lib/supabase/server";

const ALLOWED: EmailOtpType[] = ["email", "magiclink", "invite"];

/**
 * Landing page for emailed sign-in and invite links. The email templates send
 * `?token_hash=…&type=…`, which is verified here on the server (works in any browser).
 */
export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;
  const next = safeNext(searchParams.get("next"));

  const supabase = await userClient();
  if (supabase && tokenHash && type && ALLOWED.includes(type)) {
    const { error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash });
    if (!error) return NextResponse.redirect(new URL(next, request.url));
  }
  return NextResponse.redirect(new URL("/login?error=link", request.url));
}
