import { type NextRequest, NextResponse } from "next/server";
import { userClient } from "@/lib/supabase/server";

/** Signs out on this device (POST only, so a link or image can't sign someone out). */
export async function POST(request: NextRequest) {
  const supabase = await userClient();
  if (supabase) await supabase.auth.signOut({ scope: "local" });
  return NextResponse.redirect(new URL("/login", request.url), { status: 303 });
}
