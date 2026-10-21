import { calendarStatus, getChannel, latestSuggestion, listAgents, setupStatus } from "@wyrm/core";
import type { Metadata } from "next";
import { headers } from "next/headers";
import Link from "next/link";
import { notFound } from "next/navigation";
import { calendarConfig } from "@/lib/calendar";
import { requireTenant, when } from "@/lib/portal";
import { Badge, Card, input, Notice, primary, secondary } from "../../../ui";
import {
  applySuggestionAction,
  disconnectCalendarAction,
  dismissSuggestionAction,
  goLiveAction,
  importSiteAction,
  saveWidgetAction,
} from "./actions";

export const metadata: Metadata = { title: "Launch" };

export default async function LaunchPage({
  params,
  searchParams,
}: PageProps<"/dashboard/agents/[id]/launch">) {
  const page = await requireTenant();
  const { id } = await params;
  const query = await searchParams;
  const agent = (await listAgents(page.ctx, page.tenantId)).find((a) => a.agent.id === id)?.agent;
  if (!agent) notFound();
  const [setup, channel, calendar, suggestion] = await Promise.all([
    setupStatus(page.ctx, page.tenantId, agent.id),
    page.ctx.db ? getChannel(page.ctx.db, agent.id) : null,
    calendarStatus(page.ctx, page.tenantId, agent.id),
    latestSuggestion(page.ctx, page.tenantId),
  ]);
  const canEdit = page.can("agents.configure", agent.id) && !page.readOnly;
  const host = (await headers()).get("host") ?? "wyrm-portal.vercel.app";
  const snippet = `<script src="https://${host}/widget.js" data-agent="${agent.id}" async></script>`;
  const hidden = <input type="hidden" name="agentId" value={agent.id} />;
  const studio = (tab: string) => `/dashboard/agents/${agent.id}/studio?tab=${tab}`;
  const linkFor = (where: string) =>
    where === "try"
      ? studio("tests")
      : where === "launch"
        ? "#channels"
        : where === "settings"
          ? "/dashboard/settings"
          : studio(where);
  const draft = suggestion?.draft as
    | {
        summary?: string;
        hours?: Record<string, { open: string; close: string } | null>;
        services?: { name: string; price?: string }[];
        faqs?: { question: string }[];
        locations?: { address: string }[];
      }
    | undefined;

  return (
    <section className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h2 className="font-display text-2xl font-semibold">Go live</h2>
          <p className="mt-1 text-ink-muted">
            {setup.done} of {setup.total} setup steps done
            {setup.status === "live" ? ". Your agent is answering customers." : "."}
          </p>
        </div>
        {canEdit && (
          <form action={goLiveAction}>
            {hidden}
            <input
              type="hidden"
              name="status"
              value={setup.status === "live" ? "paused" : "live"}
            />
            <button
              type="submit"
              className={setup.status === "live" ? secondary : primary}
              disabled={
                setup.status !== "live" && !setup.readyToLaunch && setup.status !== "paused"
              }
            >
              {setup.status === "live"
                ? "Pause"
                : setup.status === "paused"
                  ? "Switch back on"
                  : "Go live"}
            </button>
          </form>
        )}
      </div>
      <Notice params={query} />
      {setup.status !== "live" && !setup.readyToLaunch && (
        <p className="rounded-xl border border-line bg-paper-raised p-3 text-sm">
          Going live needs every required step below, then Wyrm's sign-off.{" "}
          {setup.signedOff
            ? "Wyrm has signed off."
            : "Your Wyrm contact signs off once the required steps are done."}
        </p>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        {(["required", "recommended"] as const).map((group) => (
          <Card key={group}>
            <h2 className="font-display text-xl font-semibold">
              {group === "required" ? "Required" : "Recommended"}
            </h2>
            <ul className="mt-3 space-y-2">
              {setup[group].map((item) => (
                <li key={item.key} className="flex items-start gap-3">
                  <span aria-hidden="true" className={item.done ? "text-moss" : "text-ink-muted"}>
                    {item.done ? "✓" : "○"}
                  </span>
                  <span className="flex-1">
                    <span className={item.done ? "" : "font-semibold"}>{item.label}</span>
                    <span className="sr-only">{item.done ? " (done)" : " (to do)"}</span>
                    {!item.done && (
                      <span className="block text-sm text-ink-muted">
                        {item.hint}{" "}
                        <Link href={linkFor(item.where)} className="text-ember">
                          Open
                        </Link>
                      </span>
                    )}
                  </span>
                </li>
              ))}
            </ul>
          </Card>
        ))}
      </div>

      <Card className="space-y-3">
        <h2 className="font-display text-xl font-semibold">Import facts from your website</h2>
        <p className="text-sm text-ink-muted">
          We read up to 10 public pages and draft your hours, services, prices and common questions.
          You choose what to keep; nothing is used until you publish.
        </p>
        {canEdit && (
          <form action={importSiteAction} className="flex flex-wrap items-end gap-2">
            {hidden}
            <label className="min-w-64 flex-1">
              <span className="text-sm font-semibold">Website address</span>
              <input
                name="url"
                required
                maxLength={300}
                className={input}
                placeholder="e.g. brightsmile.com"
              />
            </label>
            <button type="submit" className={secondary}>
              Read my website
            </button>
          </form>
        )}
        {suggestion && draft && (
          <form
            action={applySuggestionAction}
            className="space-y-2 rounded-xl border border-ember/40 p-3"
          >
            {hidden}
            <input type="hidden" name="suggestionId" value={suggestion.id} />
            <p className="text-sm">
              From {suggestion.sourceUrl} ({suggestion.pagesRead} page
              {suggestion.pagesRead === 1 ? "" : "s"}, {when(suggestion.createdAt)}). Tick what to
              add:
            </p>
            {[
              ["summary", draft.summary ? `About: ${draft.summary}` : null],
              [
                "hours",
                draft.hours && Object.values(draft.hours).some(Boolean)
                  ? `Opening hours: ${Object.entries(draft.hours)
                      .map(([d, h]) => `${d} ${h ? `${h.open}-${h.close}` : "closed"}`)
                      .join(", ")}`
                  : null,
              ],
              [
                "services",
                draft.services?.length
                  ? `${draft.services.length} services: ${draft.services.map((s) => `${s.name}${s.price ? ` (${s.price})` : ""}`).join(", ")}`
                  : null,
              ],
              [
                "faqs",
                draft.faqs?.length
                  ? `${draft.faqs.length} questions: ${draft.faqs.map((f) => f.question).join("; ")}`
                  : null,
              ],
              [
                "locations",
                draft.locations?.length
                  ? `Address: ${draft.locations.map((l) => l.address).join("; ")}`
                  : null,
              ],
            ]
              .filter((x): x is [string, string] => Boolean(x[1]))
              .map(([key, label]) => (
                <label key={key} className="flex items-start gap-2 text-sm">
                  <input
                    type="checkbox"
                    name="parts"
                    value={key}
                    defaultChecked={key !== "hours"}
                    className="mt-1"
                  />{" "}
                  <span>{label}</span>
                </label>
              ))}
            {canEdit && (
              <div className="flex gap-2">
                <button type="submit" className={primary}>
                  Add to my facts (draft)
                </button>
                <button type="submit" formAction={dismissSuggestionAction} className={secondary}>
                  Discard
                </button>
              </div>
            )}
          </form>
        )}
      </Card>

      <Card className="space-y-3">
        <h2 id="channels" className="font-display text-xl font-semibold">
          Website chat
        </h2>
        <form action={saveWidgetAction} className="space-y-3">
          {hidden}
          <fieldset disabled={!canEdit} className="space-y-3">
            <label className="inline-flex items-center gap-2">
              <input
                type="checkbox"
                name="enabled"
                defaultChecked={channel?.widgetEnabled ?? false}
              />{" "}
              Show a chat button on my website
            </label>
            <label className="block">
              <span className="text-sm font-semibold">
                Websites allowed to show it (one per line; empty = any)
              </span>
              <textarea
                name="origins"
                rows={2}
                defaultValue={(channel?.widgetOrigins ?? []).join("\n")}
                className={input}
                placeholder="brightsmile.com"
              />
            </label>
            <div className="grid gap-3 sm:grid-cols-2">
              <label>
                <span className="text-sm font-semibold">Button text</span>
                <input
                  name="label"
                  maxLength={40}
                  defaultValue={channel?.widgetLabel ?? "Chat with us"}
                  className={input}
                />
              </label>
              <label>
                <span className="text-sm font-semibold">Button colour</span>
                <input
                  name="color"
                  type="color"
                  defaultValue={channel?.widgetColor ?? "#e8590c"}
                  className={`${input} h-11`}
                />
              </label>
            </div>
            {canEdit && (
              <button type="submit" className={secondary}>
                Save website chat
              </button>
            )}
          </fieldset>
        </form>
        {channel?.widgetEnabled && (
          <div className="space-y-1">
            <p className="text-sm">Paste this just before &lt;/body&gt; on your website:</p>
            <input
              readOnly
              value={snippet}
              aria-label="Website chat code"
              className={`${input} font-mono text-xs`}
            />
            {agent.status !== "live" && (
              <p className="text-sm text-signal">The button appears once the agent is live.</p>
            )}
          </div>
        )}
      </Card>

      <Card className="space-y-3">
        <h2 className="font-display text-xl font-semibold">Calendar</h2>
        {!calendarConfig() ? (
          <p className="text-sm text-ink-muted">
            Calendar booking is being set up by Wyrm. Until then, bookings arrive in your To-do as
            requests to confirm.
          </p>
        ) : calendar ? (
          <div className="space-y-2">
            <p>
              Connected to {calendar.accountEmail ?? "Google Calendar"}{" "}
              <Badge tone={calendar.status === "ok" ? "good" : "bad"}>
                {calendar.status === "ok" ? "working" : "needs attention"}
              </Badge>
            </p>
            {calendar.lastError && (
              <p className="text-sm text-node-output">
                Last problem: {calendar.lastError}. Reconnect to fix it.
              </p>
            )}
            <p className="text-sm text-ink-muted">
              Confirmed bookings go straight into this calendar when the time is free.
            </p>
            {canEdit && (
              <div className="flex gap-2">
                <a href={`/api/calendar/connect?agent=${agent.id}`} className={secondary}>
                  Reconnect
                </a>
                <form action={disconnectCalendarAction}>
                  {hidden}
                  <button
                    type="submit"
                    className="min-h-11 px-3 text-sm text-ink-muted hover:text-ink"
                  >
                    Disconnect
                  </button>
                </form>
              </div>
            )}
          </div>
        ) : (
          <div className="space-y-2">
            <p className="text-sm text-ink-muted">
              Connect Google Calendar so the agent books real free times. Without it, bookings come
              to your To-do as requests.
            </p>
            {canEdit && (
              <a href={`/api/calendar/connect?agent=${agent.id}`} className={primary}>
                Connect Google Calendar
              </a>
            )}
          </div>
        )}
      </Card>

      <Card className="space-y-2">
        <h2 className="font-display text-xl font-semibold">Phone</h2>
        <p className="text-sm text-ink-muted">
          Coming soon: forward your calls in stages (after hours first, then when you're busy, then
          every call) so you can try the agent safely.
        </p>
      </Card>
    </section>
  );
}
