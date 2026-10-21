import { publicAgent } from "@wyrm/core";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ChatBox } from "@/components/chat-box";
import { serverDb } from "@/lib/db";

export const metadata: Metadata = { title: "Chat" };

/** Public chat with a live agent: the link a business puts on its website. */
export default async function PublicChatPage({ params }: PageProps<"/chat/[agentId]">) {
  const { agentId } = await params;
  const db = serverDb();
  if (!db || !/^[0-9a-f-]{36}$/.test(agentId)) notFound();
  const row = await publicAgent(db, agentId);
  if (row?.status !== "live" || row.tenantStatus !== "active") notFound();
  return (
    <section className="mx-auto max-w-lg space-y-4">
      <h1 className="font-display text-2xl font-semibold">{row.business}</h1>
      <p className="text-sm text-ink-muted">
        You're chatting with an AI assistant. Ask for a person at any time. Please don't share
        passwords or card numbers.
      </p>
      <ChatBox agentId={agentId} title={`Chat with ${row.name}`} />
    </section>
  );
}
