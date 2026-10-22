import { getChannel, INTERNAL_AGENT_TYPES, publicAgent, widgetAllowed } from "@wyrm/core";
import { type NextRequest, NextResponse } from "next/server";
import { serverDb } from "@/lib/db";

/**
 * Widget settings for widget.js on a business's website. Only answers for live agents with the
 * widget switched on, and only to the sites the business allowed (CORS).
 */
export async function GET(request: NextRequest, { params }: RouteContext<"/api/widget/[agentId]">) {
  const { agentId } = await params;
  const origin = request.headers.get("origin");
  const cors = origin ? { "Access-Control-Allow-Origin": origin, Vary: "Origin" } : {};
  const db = serverDb();
  if (!db || !/^[0-9a-f-]{36}$/.test(agentId))
    return NextResponse.json({ enabled: false }, { status: 404 });
  const [agent, channel] = await Promise.all([publicAgent(db, agentId), getChannel(db, agentId)]);
  const live =
    agent?.status === "live" &&
    agent.tenantStatus === "active" &&
    !INTERNAL_AGENT_TYPES.includes(agent.type);
  if (!live || !widgetAllowed(channel, origin)) {
    return NextResponse.json(
      { enabled: false },
      { status: 403, headers: { ...cors, "Cache-Control": "no-store" } },
    );
  }
  return NextResponse.json(
    { enabled: true, color: channel?.widgetColor, label: channel?.widgetLabel },
    { headers: { ...cors, "Cache-Control": "public, max-age=60" } },
  );
}
