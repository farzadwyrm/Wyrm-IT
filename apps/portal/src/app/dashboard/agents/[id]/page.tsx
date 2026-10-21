import { listAgents, listTests, listVersions } from "@wyrm/core";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ChatBox } from "@/components/chat-box";
import { requireTenant, when } from "@/lib/portal";
import { agentStatusAction, publishAction, saveDraftAction } from "../../actions";
import { Badge, Card, Empty, input, Notice, primary, secondary } from "../../ui";

export const metadata: Metadata = { title: "Agent" };

interface Settings {
  greeting?: string;
  businessFacts?: string;
  handoffContact?: string;
  tone?: string;
}

export default async function AgentPage({
  params,
  searchParams,
}: PageProps<"/dashboard/agents/[id]">) {
  const page = await requireTenant();
  const { id } = await params;
  const query = await searchParams;
  const agent = (await listAgents(page.ctx, page.tenantId)).find((a) => a.agent.id === id)?.agent;
  if (!agent) notFound();
  const [versions, tests] = await Promise.all([
    listVersions(page.ctx, page.tenantId, agent.id),
    listTests(page.ctx, page.tenantId, agent.id),
  ]);
  const canConfigure = page.can("agents.configure", agent.id);
  const current = (agent.config ?? {}) as Settings;
  const latestDraft = versions.find((v) => v.publishedAt === null);
  const draft = (latestDraft?.settings ?? current) as Settings;
  const back = `/dashboard/agents/${agent.id}`;

  return (
    <section className="space-y-6">
      <Link href="/dashboard/agents" className="text-sm text-ink-muted hover:text-ink">
        ← All agents
      </Link>
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="font-display text-3xl font-semibold">{agent.name}</h1>
        <Badge tone={agent.status === "live" ? "good" : "plain"}>
          {agent.status === "live" ? "on" : agent.status}
        </Badge>
        {canConfigure && agent.status !== "draft" && (
          <form action={agentStatusAction}>
            <input type="hidden" name="back" value={back} />
            <input type="hidden" name="agentId" value={agent.id} />
            <input
              type="hidden"
              name="status"
              value={agent.status === "live" ? "paused" : "live"}
            />
            <button type="submit" className={secondary}>
              {agent.status === "live" ? "Pause" : "Switch on"}
            </button>
          </form>
        )}
      </div>
      <Notice params={query} />
      <Link
        href={`/dashboard/agents/${agent.id}/studio`}
        className="flex items-center justify-between rounded-2xl border border-ember/50 bg-ember/10 p-4 hover:border-ember"
      >
        <span>
          <strong>Agent Studio</strong>: facts, rules, procedures, limits and handoff. Decide
          exactly how {agent.name} works.
        </span>
        <span aria-hidden="true">→</span>
      </Link>

      <div className="grid gap-6 lg:grid-cols-[3fr_2fr]">
        <div className="space-y-4">
          {canConfigure ? (
            <form
              action={saveDraftAction}
              className="space-y-3 rounded-2xl border border-line bg-paper-raised/60 p-5"
            >
              <h2 className="font-display text-xl font-semibold">What the agent knows and says</h2>
              <p className="text-sm text-ink-muted">
                Changes are saved as a draft. Customers only see them after you publish.
              </p>
              <input type="hidden" name="back" value={back} />
              <input type="hidden" name="agentId" value={agent.id} />
              <label className="block">
                <span className="text-sm font-semibold">Greeting</span>
                <input
                  name="greeting"
                  maxLength={300}
                  defaultValue={draft.greeting ?? ""}
                  className={input}
                  placeholder="Hi, thanks for contacting us. How can I help?"
                />
              </label>
              <label className="block">
                <span className="text-sm font-semibold">
                  Business facts (hours, services, prices, policies)
                </span>
                <textarea
                  name="businessFacts"
                  rows={8}
                  maxLength={4000}
                  defaultValue={draft.businessFacts ?? ""}
                  className={input}
                />
              </label>
              <div className="grid gap-3 sm:grid-cols-2">
                <label>
                  <span className="text-sm font-semibold">Pass to a person (name or number)</span>
                  <input
                    name="handoffContact"
                    maxLength={200}
                    defaultValue={draft.handoffContact ?? ""}
                    className={input}
                  />
                </label>
                <label>
                  <span className="text-sm font-semibold">Tone</span>
                  <select name="tone" defaultValue={draft.tone ?? "friendly"} className={input}>
                    <option value="friendly">Friendly</option>
                    <option value="formal">Formal</option>
                    <option value="brief">Brief</option>
                  </select>
                </label>
              </div>
              <button type="submit" className={secondary}>
                Save draft
              </button>
            </form>
          ) : (
            <Card>
              <h2 className="font-display text-xl font-semibold">Settings</h2>
              <p className="mt-2 text-ink-muted">
                Only people who manage this agent can change it.
              </p>
              {current.greeting && <p className="mt-3">“{current.greeting}”</p>}
            </Card>
          )}

          <div className="space-y-2">
            <h2 className="font-display text-xl font-semibold">Tests</h2>
            {tests.length === 0 ? (
              <Empty>
                No tests yet. Fix an answer or turn a conversation into a test to add one.
              </Empty>
            ) : (
              <ul className="divide-y divide-line rounded-2xl border border-line">
                {tests.map((t) => (
                  <li key={t.id} className="p-3">
                    <p className="font-semibold">{t.name}</p>
                    <p className="text-sm text-ink-muted">
                      “{t.turns[0]}” → {t.expectation}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        <aside className="space-y-3">
          {page.can("agents.use", agent.id) && (
            <ChatBox agentId={agent.id} test title="Try it (test chat, uses the live version)" />
          )}
          {agent.status === "live" && (
            <p className="text-sm text-ink-muted">
              Public chat link for your website:{" "}
              <Link href={`/chat/${agent.id}`} className="break-all text-ember">
                /chat/{agent.id}
              </Link>
            </p>
          )}
          <h2 className="font-display text-xl font-semibold">Versions</h2>
          {versions.length === 0 ? (
            <Empty>No saved versions yet.</Empty>
          ) : (
            <ol className="space-y-2">
              {versions.map((v, i) => {
                const isLive =
                  v.publishedAt !== null && versions.findIndex((x) => x.publishedAt !== null) === i;
                return (
                  <li key={v.id} className="rounded-2xl border border-line p-3">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-sm">{when(v.createdAt)}</span>
                      {isLive ? (
                        <Badge tone="good">live</Badge>
                      ) : v.publishedAt ? (
                        <Badge>earlier</Badge>
                      ) : (
                        <Badge tone="warn">draft</Badge>
                      )}
                    </div>
                    {canConfigure && !isLive && (
                      <form action={publishAction} className="mt-2">
                        <input type="hidden" name="back" value={back} />
                        <input type="hidden" name="agentId" value={agent.id} />
                        <input type="hidden" name="versionId" value={v.id} />
                        <input type="hidden" name="restore" value={v.publishedAt ? "1" : "0"} />
                        <button type="submit" className={v.publishedAt ? secondary : primary}>
                          {v.publishedAt ? "Restore this version" : "Publish"}
                        </button>
                      </form>
                    )}
                  </li>
                );
              })}
            </ol>
          )}
        </aside>
      </div>
    </section>
  );
}
