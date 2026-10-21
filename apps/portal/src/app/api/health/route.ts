import { NextResponse } from "next/server";
import { publicConfig } from "@/lib/config";
import { databaseStatus } from "@/lib/db";

/** Uptime check: is the portal configured and can it reach its database? No secrets returned. */
export async function GET() {
  const database = await databaseStatus();
  const ai = {
    claude: Boolean(process.env.ANTHROPIC_API_KEY),
    groq: Boolean(process.env.GROQ_API_KEY),
  };
  return NextResponse.json(
    { ok: database === "ok", database, auth: Boolean(publicConfig()), ai },
    { status: database === "ok" ? 200 : 503, headers: { "Cache-Control": "no-store" } },
  );
}
