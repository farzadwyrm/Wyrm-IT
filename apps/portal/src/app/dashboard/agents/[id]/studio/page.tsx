import { TEMPLATES, type Template } from "@wyrm/brain";
import { getStudio, listAgents, listTestsWithResults } from "@wyrm/core";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ChatBox } from "@/components/chat-box";
import { requireTenant, when } from "@/lib/portal";
import { Badge, Card, Empty, input, Notice, primary, secondary } from "../../../ui";
import {
  addProcedureAction,
  publishAction,
  ruleStateAction,
  saveFactsAction,
  saveLimitsAction,
  saveProcedureAction,
  saveRuleAction,
} from "./actions";
import { TestsPanel } from "./tests-panel";

export const metadata: Metadata = { title: "Agent Studio" };

const TABS = [
  { key: "facts", label: "Facts" },
  { key: "rules", label: "Rules" },
  { key: "procedures", label: "Procedures" },
  { key: "limits", label: "Limits & handoff" },
  { key: "tests", label: "Tests" },
  { key: "changes", label: "Changes" },
] as const;
const DAYS = [
  ["mon", "Monday"],
  ["tue", "Tuesday"],
  ["wed", "Wednesday"],
  ["thu", "Thursday"],
  ["fri", "Friday"],
  ["sat", "Saturday"],
  ["sun", "Sunday"],
] as const;
const CHANNELS = [
  ["web_chat", "Website chat"],
  ["voice", "Phone"],
  ["sms", "Text"],
  ["email", "Email"],
  ["whatsapp", "WhatsApp"],
] as const;
const TIER_TEXT: Record<number, string> = {
  0: "Runs on its own",
  1: "Needs the customer's yes",
  2: "Goes to your To-do for approval",
};

function Note({ placeholder = "What changed? (required)" }: { placeholder?: string }) {
  return (
    <label className="block">
      <span className="text-sm font-semibold">What changed?</span>
      <input
        name="note"
        required
        minLength={3}
        maxLength={500}
        className={input}
        placeholder={placeholder}
      />
    </label>
  );
}

export default async function StudioPage({
  params,
  searchParams,
}: PageProps<"/dashboard/agents/[id]/studio">) {
  const page = await requireTenant();
  const { id } = await params;
  const query = await searchParams;
  const agent = (await listAgents(page.ctx, page.tenantId)).find((a) => a.agent.id === id)?.agent;
  if (!agent) notFound();
  const tab = TABS.find((t) => t.key === query.tab)?.key ?? "facts";
  const [{ policy, conflicts, changes }, testData] = await Promise.all([
    getStudio(page.ctx, page.tenantId, agent.id),
    listTestsWithResults(page.ctx, page.tenantId, agent.id),
  ]);
  const canEdit = page.can("agents.configure", agent.id) && !page.readOnly;
  const hidden = (
    <>
      <input type="hidden" name="agentId" value={agent.id} />
      <input type="hidden" name="tab" value={tab} />
    </>
  );
  const lastPublish = changes.find((c) => c.objectType === "publish");
  const draftChanges = lastPublish
    ? changes.filter((c) => c.id > lastPublish.id).length
    : changes.length;
  const p = policy.profile;
  const l = policy.limits;
  const used = new Set(policy.procedures.map((x) => x.template));

  return (
    <section className="space-y-6">
      {canEdit && (
        <form
          action={publishAction}
          className="flex flex-wrap items-end justify-between gap-3 rounded-2xl border border-ember/40 bg-ember/5 p-3"
        >
          {hidden}
          <p className="text-sm">
            {draftChanges > 0 ? (
              <strong>
                {draftChanges} unpublished change{draftChanges === 1 ? "" : "s"}.
              </strong>
            ) : (
              <strong>Everything is published.</strong>
            )}{" "}
            <span className="text-ink-muted">
              {lastPublish
                ? `Live version from ${when(lastPublish.createdAt)}: "${lastPublish.note}".`
                : "Not published yet."}{" "}
              Publishing runs your tests first.
            </span>
          </p>
          <div className="flex flex-wrap items-end gap-2">
            <label>
              <span className="sr-only">Version note</span>
              <input
                name="note"
                required
                minLength={3}
                maxLength={500}
                className={input}
                placeholder="What changed? e.g. new prices"
              />
            </label>
            <button type="submit" className={primary}>
              Test &amp; publish
            </button>
          </div>
        </form>
      )}
      <Notice params={query} />

      {!canEdit && (
        <p className="text-sm text-ink-muted">
          You can view these settings. Only people who manage this agent can change them.
        </p>
      )}

      {tab === "facts" && (
        <form action={saveFactsAction} className="space-y-5">
          {hidden}
          <fieldset disabled={!canEdit} className="space-y-5">
            <Card className="space-y-3">
              <h2 className="font-display text-xl font-semibold">About the business</h2>
              <p className="text-sm text-ink-muted">
                Facts only. Put instructions ("always…", "never…") in Rules.
              </p>
              <textarea
                name="summary"
                rows={3}
                maxLength={600}
                defaultValue={p.summary ?? ""}
                className={input}
                placeholder="e.g. Family dental practice in the city centre, 3 dentists."
              />
              <label className="block max-w-xs">
                <span className="text-sm font-semibold">Time zone</span>
                <input
                  name="timezone"
                  defaultValue={p.timezone ?? "Europe/Lisbon"}
                  className={input}
                />
              </label>
            </Card>
            <Card className="space-y-3">
              <h2 className="font-display text-xl font-semibold">Opening hours</h2>
              <div className="grid gap-2">
                {DAYS.map(([key, label]) => {
                  const slot = p.hours?.[key];
                  return (
                    <div
                      key={key}
                      className="grid grid-cols-[7rem_1fr_1fr_auto] items-center gap-2"
                    >
                      <span className="text-sm font-semibold">{label}</span>
                      <input
                        type="time"
                        name={`${key}_open`}
                        defaultValue={slot?.open ?? "09:00"}
                        aria-label={`${label} opens`}
                        className={input}
                      />
                      <input
                        type="time"
                        name={`${key}_close`}
                        defaultValue={slot?.close ?? "17:00"}
                        aria-label={`${label} closes`}
                        className={input}
                      />
                      <label className="flex items-center gap-2 text-sm">
                        <input type="checkbox" name={`${key}_closed`} defaultChecked={!slot} />{" "}
                        Closed
                      </label>
                    </div>
                  );
                })}
              </div>
            </Card>
            <Card className="space-y-3">
              <h2 className="font-display text-xl font-semibold">Services and prices</h2>
              <p className="text-sm text-ink-muted">One per line: name | price | duration</p>
              <textarea
                name="services"
                rows={6}
                defaultValue={(p.services ?? [])
                  .map((s) => [s.name, s.price, s.duration].filter(Boolean).join(" | "))
                  .join("\n")}
                className={`${input} font-mono text-sm`}
                placeholder="Check-up and clean | 65 EUR | 30 min"
              />
            </Card>
            <Card className="space-y-3">
              <h2 className="font-display text-xl font-semibold">Locations</h2>
              <textarea
                name="locations"
                rows={2}
                defaultValue={(p.locations ?? []).map((x) => x.address).join("\n")}
                className={input}
                placeholder="One address per line"
              />
            </Card>
            <Card className="space-y-3">
              <h2 className="font-display text-xl font-semibold">Frequent questions</h2>
              <p className="text-sm text-ink-muted">One per line: question | answer</p>
              <textarea
                name="faqs"
                rows={6}
                defaultValue={(p.faqs ?? []).map((f) => `${f.question} | ${f.answer}`).join("\n")}
                className={`${input} font-mono text-sm`}
                placeholder="Is there parking? | Yes, free parking behind the building."
              />
              <textarea
                name="other"
                rows={3}
                maxLength={2000}
                defaultValue={p.other ?? ""}
                className={input}
                placeholder="Anything else the agent should know"
              />
            </Card>
            {canEdit && (
              <div className="flex flex-wrap items-end gap-3">
                <div className="min-w-64 flex-1">
                  <Note placeholder="e.g. New Saturday hours" />
                </div>
                <button type="submit" className={secondary}>
                  Save facts
                </button>
              </div>
            )}
          </fieldset>
        </form>
      )}

      {tab === "rules" && (
        <div className="space-y-5">
          <p className="text-ink-muted">
            Short instructions in plain words, up to 15. Narrower rules win when two disagree, then
            higher priority. Limits (money, dates) belong in Limits, where they're enforced.
          </p>
          {conflicts.length > 0 && (
            <div
              role="alert"
              className="rounded-xl border border-signal/60 bg-signal/10 p-3 text-sm"
            >
              {conflicts.map((c) => (
                <p key={`${c.a}-${c.b}`}>
                  Possible conflict: "{policy.rules.find((r) => r.id === c.a)?.text}" and "
                  {policy.rules.find((r) => r.id === c.b)?.text}". {c.reason}
                </p>
              ))}
            </div>
          )}
          {policy.rules.length === 0 ? (
            <Empty>
              No rules yet. Example: "Never discuss insurance claims; offer to pass the question to
              the team."
            </Empty>
          ) : (
            <ul className="space-y-3">
              {policy.rules.map((r) => (
                <li key={r.id}>
                  <Card className="space-y-2">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className={r.enabled ? "" : "text-ink-muted line-through"}>{r.text}</p>
                      <span className="flex gap-2">
                        {r.scope.channels?.length ? (
                          <Badge>{r.scope.channels.join(", ")}</Badge>
                        ) : null}
                        {r.scope.when && r.scope.when !== "any" ? (
                          <Badge>{r.scope.when === "open" ? "open hours" : "after hours"}</Badge>
                        ) : null}
                        {r.scope.callers && r.scope.callers !== "any" ? (
                          <Badge>{r.scope.callers} customers</Badge>
                        ) : null}
                        {r.priority !== 0 && <Badge tone="warn">priority {r.priority}</Badge>}
                      </span>
                    </div>
                    {canEdit && (
                      <form action={ruleStateAction} className="flex flex-wrap items-end gap-2">
                        {hidden}
                        <input type="hidden" name="ruleId" value={r.id} />
                        <input
                          name="note"
                          required
                          minLength={3}
                          maxLength={500}
                          className={`${input} max-w-xs`}
                          placeholder="Why? (required)"
                          aria-label="Reason for the change"
                        />
                        <button
                          type="submit"
                          name="op"
                          value={r.enabled ? "disable" : "enable"}
                          className={secondary}
                        >
                          {r.enabled ? "Turn off" : "Turn on"}
                        </button>
                        <button
                          type="submit"
                          name="op"
                          value="delete"
                          className="min-h-11 px-3 text-sm text-ink-muted hover:text-ink"
                        >
                          Delete
                        </button>
                      </form>
                    )}
                  </Card>
                </li>
              ))}
            </ul>
          )}
          {canEdit && policy.rules.length < 15 && (
            <form
              action={saveRuleAction}
              className="space-y-3 rounded-2xl border border-line bg-paper-raised/60 p-5"
            >
              {hidden}
              <h2 className="font-display text-xl font-semibold">Add a rule</h2>
              <textarea
                name="text"
                required
                minLength={5}
                maxLength={300}
                rows={2}
                className={input}
                placeholder="e.g. Always offer the next free slot before asking for a preferred time."
              />
              <div className="grid gap-3 sm:grid-cols-3">
                <fieldset>
                  <legend className="text-sm font-semibold">Channels (none = all)</legend>
                  {CHANNELS.map(([value, label]) => (
                    <label key={value} className="mr-3 inline-flex items-center gap-1 text-sm">
                      <input type="checkbox" name="channels" value={value} /> {label}
                    </label>
                  ))}
                </fieldset>
                <label>
                  <span className="text-sm font-semibold">When</span>
                  <select name="when" className={input} defaultValue="any">
                    <option value="any">Any time</option>
                    <option value="open">During opening hours</option>
                    <option value="closed">After hours</option>
                  </select>
                </label>
                <label>
                  <span className="text-sm font-semibold">Customers</span>
                  <select name="callers" className={input} defaultValue="any">
                    <option value="any">Everyone</option>
                    <option value="new">New customers</option>
                    <option value="returning">Returning customers</option>
                  </select>
                </label>
              </div>
              <div className="grid gap-3 sm:grid-cols-[8rem_1fr]">
                <label>
                  <span className="text-sm font-semibold">Priority</span>
                  <input
                    name="priority"
                    type="number"
                    min={-10}
                    max={10}
                    defaultValue={0}
                    className={input}
                  />
                </label>
                <Note placeholder="e.g. Customers kept asking for the earliest slot" />
              </div>
              <button type="submit" className={primary}>
                Add rule
              </button>
            </form>
          )}
        </div>
      )}

      {tab === "procedures" && (
        <div className="space-y-5">
          <p className="text-ink-muted">
            Step-by-step playbooks for requests. The agent collects the required details, reads them
            back, then acts within your limits. Nothing is booked or cancelled without the checks
            below.
          </p>
          {policy.procedures.map((proc) => (
            <form
              key={proc.id}
              action={saveProcedureAction}
              className="space-y-3 rounded-2xl border border-line bg-paper-raised/60 p-5"
            >
              {hidden}
              <input type="hidden" name="procedureId" value={proc.id} />
              <fieldset disabled={!canEdit} className="space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <input
                    name="name"
                    defaultValue={proc.name}
                    maxLength={80}
                    className={`${input} max-w-sm font-semibold`}
                    aria-label="Procedure name"
                  />
                  <span className="flex gap-2">
                    <Badge tone={TEMPLATES[proc.template].tier >= 2 ? "warn" : "plain"}>
                      {TIER_TEXT[TEMPLATES[proc.template].tier]}
                    </Badge>
                    {!proc.enabled && <Badge>off</Badge>}
                  </span>
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <label>
                    <span className="text-sm font-semibold">Use when</span>
                    <textarea
                      name="whenToUse"
                      rows={2}
                      maxLength={512}
                      defaultValue={proc.whenToUse}
                      className={input}
                    />
                  </label>
                  <label>
                    <span className="text-sm font-semibold">Don't use when</span>
                    <textarea
                      name="whenNotToUse"
                      rows={2}
                      maxLength={512}
                      defaultValue={proc.whenNotToUse}
                      className={input}
                    />
                  </label>
                </div>
                <p className="text-sm">
                  <span className="font-semibold">Collects:</span>{" "}
                  {proc.requiredInfo.map((f) => f.label).join(", ") || "nothing"}
                </p>
                <label className="block">
                  <span className="text-sm font-semibold">Steps (one per line)</span>
                  <textarea
                    name="steps"
                    rows={4}
                    defaultValue={proc.steps.join("\n")}
                    className={input}
                  />
                </label>
                <div className="flex flex-wrap gap-4 text-sm">
                  <label className="inline-flex items-center gap-2">
                    <input
                      type="checkbox"
                      name="confirm"
                      defaultChecked={proc.confirmBeforeActing}
                      disabled={proc.template === "book" || proc.template === "reschedule"}
                    />
                    Read details back and ask the customer to confirm
                    {(proc.template === "book" || proc.template === "reschedule") && " (always on)"}
                  </label>
                  <label className="inline-flex items-center gap-2">
                    <input type="checkbox" name="enabled" defaultChecked={proc.enabled} /> On
                  </label>
                </div>
                {canEdit && (
                  <div className="flex flex-wrap items-end gap-3">
                    <div className="min-w-64 flex-1">
                      <Note />
                    </div>
                    <button type="submit" className={secondary}>
                      Save
                    </button>
                  </div>
                )}
              </fieldset>
            </form>
          ))}
          {canEdit && (
            <Card className="space-y-3">
              <h2 className="font-display text-xl font-semibold">Add a procedure</h2>
              <ul className="grid gap-3 sm:grid-cols-2">
                {(Object.keys(TEMPLATES) as Template[])
                  .filter((t) => !used.has(t))
                  .map((t) => (
                    <li key={t} className="rounded-xl border border-line p-3">
                      <p className="font-semibold">{TEMPLATES[t].name}</p>
                      <p className="text-sm text-ink-muted">{TEMPLATES[t].whenToUse}</p>
                      <form action={addProcedureAction} className="mt-2">
                        {hidden}
                        <input type="hidden" name="template" value={t} />
                        <button type="submit" className={secondary}>
                          Add
                        </button>
                      </form>
                    </li>
                  ))}
              </ul>
              {used.size === Object.keys(TEMPLATES).length && (
                <p className="text-ink-muted">All procedures are added.</p>
              )}
            </Card>
          )}
        </div>
      )}

      {tab === "limits" && (
        <form action={saveLimitsAction} className="space-y-5">
          {hidden}
          <fieldset disabled={!canEdit} className="space-y-5">
            <Card className="space-y-3">
              <h2 className="font-display text-xl font-semibold">Hard limits</h2>
              <p className="text-sm text-ink-muted">
                Checked by the system before any action. The AI can't override them.
              </p>
              <div className="grid gap-3 sm:grid-cols-2">
                <label>
                  <span className="text-sm font-semibold">Book at least (hours ahead)</span>
                  <input
                    name="minNoticeHours"
                    type="number"
                    min={0}
                    max={168}
                    defaultValue={l.minNoticeHours}
                    className={input}
                  />
                </label>
                <label>
                  <span className="text-sm font-semibold">Book at most (days ahead)</span>
                  <input
                    name="bookingWindowDays"
                    type="number"
                    min={0}
                    max={365}
                    defaultValue={l.bookingWindowDays}
                    className={input}
                  />
                </label>
                <label>
                  <span className="text-sm font-semibold">Cancellation notice (hours)</span>
                  <input
                    name="cancellationNoticeHours"
                    type="number"
                    min={0}
                    max={336}
                    defaultValue={l.cancellationNoticeHours}
                    className={input}
                  />
                </label>
                <label>
                  <span className="text-sm font-semibold">Maximum discount (%)</span>
                  <input
                    name="maxDiscountPercent"
                    type="number"
                    min={0}
                    max={100}
                    defaultValue={l.maxDiscountPercent}
                    className={input}
                  />
                </label>
              </div>
              <label className="block">
                <span className="text-sm font-semibold">
                  Topics it must not discuss (comma separated)
                </span>
                <input
                  name="blockedTopics"
                  defaultValue={l.blockedTopics.join(", ")}
                  className={input}
                  placeholder="e.g. insurance, legal advice, diagnoses"
                />
              </label>
            </Card>
            <Card className="space-y-3">
              <h2 className="font-display text-xl font-semibold">After hours and handoff</h2>
              <label className="block max-w-sm">
                <span className="text-sm font-semibold">Outside opening hours</span>
                <select name="afterHours" defaultValue={l.afterHours} className={input}>
                  <option value="take_message">Take a message</option>
                  <option value="answer">Answer questions as usual</option>
                  <option value="handoff">Pass straight to a person</option>
                </select>
              </label>
              <label className="block">
                <span className="text-sm font-semibold">Person or team to pass to</span>
                <input
                  name="handoffContact"
                  maxLength={200}
                  defaultValue={l.handoffContact}
                  className={input}
                  placeholder="e.g. Reception, 9am-5pm"
                />
              </label>
              <fieldset>
                <legend className="text-sm font-semibold">
                  Pass to a person when the customer…
                </legend>
                {[
                  ["asked", "asks for a person"],
                  ["frustrated", "sounds frustrated"],
                  ["loop", "is still unclear after two questions"],
                ].map(([value, label]) => (
                  <label key={value} className="mr-4 inline-flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      name="handoffWhen"
                      value={value}
                      defaultChecked={l.handoffWhen.includes(value as string)}
                    />{" "}
                    {label}
                  </label>
                ))}
              </fieldset>
            </Card>
            <Card className="space-y-3">
              <h2 className="font-display text-xl font-semibold">Voice</h2>
              <div className="grid gap-3 sm:grid-cols-2">
                <label>
                  <span className="text-sm font-semibold">Tone</span>
                  <select name="tone" defaultValue={l.tone} className={input}>
                    <option value="friendly">Friendly</option>
                    <option value="formal">Formal</option>
                    <option value="brief">Brief</option>
                  </select>
                </label>
                <label>
                  <span className="text-sm font-semibold">Reply length</span>
                  <select name="replyLength" defaultValue={l.replyLength} className={input}>
                    <option value="short">Short</option>
                    <option value="medium">Medium</option>
                  </select>
                </label>
              </div>
            </Card>
            {canEdit && (
              <div className="flex flex-wrap items-end gap-3">
                <div className="min-w-64 flex-1">
                  <Note placeholder="e.g. Stop same-day bookings" />
                </div>
                <button type="submit" className={secondary}>
                  Save limits
                </button>
              </div>
            )}
          </fieldset>
        </form>
      )}

      {tab === "tests" && (
        <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_22rem]">
          <TestsPanel agentId={agent.id} canEdit={canEdit} data={testData} />
          {page.can("agents.use", agent.id) && (
            <aside className="space-y-2">
              <ChatBox agentId={agent.id} test title="Try it (uses the live version)" />
              <p className="text-xs text-ink-muted">
                Test chats show why the agent answered. Customers never see that.
              </p>
            </aside>
          )}
        </div>
      )}

      {tab === "changes" &&
        (changes.length === 0 ? (
          <Empty>No changes yet.</Empty>
        ) : (
          <ol className="divide-y divide-line rounded-2xl border border-line">
            {changes.map((c) => (
              <li
                key={c.id}
                className="flex flex-wrap items-center justify-between gap-2 p-3 text-sm"
              >
                <span>
                  <Badge tone={c.action === "publish" ? "good" : "plain"}>
                    {c.action === "publish" ? "published" : `${c.objectType} ${c.action}`}
                  </Badge>{" "}
                  {c.note}
                </span>
                <span className="text-ink-muted">{when(c.createdAt)}</span>
              </li>
            ))}
          </ol>
        ))}
    </section>
  );
}
