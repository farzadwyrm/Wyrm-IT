import { knowledgeStats, listKnowledgeQuestions, liveSources } from "@wyrm/core";
import type { Metadata } from "next";
import Link from "next/link";
import { requireTenant } from "@/lib/portal";
import { Empty } from "../../../ui";
import { AskChat } from "./ask-chat";

export const metadata: Metadata = { title: "Ask" };

/** Ask: staff questions answered from the agent's documents, with sources. */
export default async function AskPage({ params }: PageProps<"/dashboard/agents/[id]/ask">) {
  const page = await requireTenant();
  const { id } = await params;
  const stats = await knowledgeStats(page.ctx, page.tenantId, id);
  const recent = page.can("agents.logs", id)
    ? await listKnowledgeQuestions(page.ctx, page.tenantId, id, { limit: 30 })
    : [];
  const examples = [
    ...new Set(recent.filter((q) => q.answered && q.feedback !== "down").map((q) => q.question)),
  ].slice(0, 3);

  const live = await liveSources(page.ctx.db, page.tenantId, id);
  const connected = live.lookups.length + live.searchApis.length;
  if (stats.sources === 0 && connected === 0)
    return (
      <Empty>
        This agent has no documents yet.{" "}
        {page.can("agents.configure", id) ? (
          <Link href={`/dashboard/agents/${id}/documents`} className="font-semibold text-ember">
            Add documents →
          </Link>
        ) : (
          "Ask whoever manages it to add some."
        )}
      </Empty>
    );

  return (
    <div className="space-y-3">
      <p className="text-sm text-ink-muted">
        Answers come only from {stats.sources} document{stats.sources === 1 ? "" : "s"}
        {connected ? ` and ${connected} live connection lookup${connected === 1 ? "" : "s"}` : ""}.
        Open “Sources” under an answer to check it, and use 👍 / 👎 so the answers get better.
      </p>
      <AskChat agentId={id} examples={examples} />
    </div>
  );
}
