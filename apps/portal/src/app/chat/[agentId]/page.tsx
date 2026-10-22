import { getChannel, INTERNAL_AGENT_TYPES, publicAgent, widgetAllowed } from "@wyrm/core";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ChatBox } from "@/components/chat-box";
import { serverDb } from "@/lib/db";

export const metadata: Metadata = { title: "Chat" };

/**
 * Public chat with a live agent: a shareable link, and (with ?embed=1) what the website widget
 * shows inside the business's own site, full-frame and only on the sites the business allowed.
 */
export default async function PublicChatPage({
  params,
  searchParams,
}: PageProps<"/chat/[agentId]">) {
  const { agentId } = await params;
  const query = await searchParams;
  const db = serverDb();
  if (!db || !/^[0-9a-f-]{36}$/.test(agentId)) notFound();
  const row = await publicAgent(db, agentId);
  if (
    row?.status !== "live" ||
    row.tenantStatus !== "active" ||
    INTERNAL_AGENT_TYPES.includes(row.type)
  )
    notFound();
  const embed = query.embed === "1";
  if (embed) {
    const site = typeof query.site === "string" ? query.site : null;
    if (!widgetAllowed(await getChannel(db, agentId), site)) notFound();
  }
  const chat = (
    <>
      <p className="text-sm text-ink-muted">
        You're chatting with {row.business}'s AI assistant. Ask for a person at any time. Please
        don't share passwords or card numbers.
      </p>
      <ChatBox agentId={agentId} title={`Chat with ${row.name}`} />
    </>
  );
  if (embed) {
    // Covers the portal's own header inside the widget frame.
    return <div className="fixed inset-0 z-50 space-y-3 overflow-y-auto bg-paper p-3">{chat}</div>;
  }
  return (
    <section className="mx-auto max-w-lg space-y-4">
      <h1 className="font-display text-2xl font-semibold">{row.business}</h1>
      {chat}
    </section>
  );
}
