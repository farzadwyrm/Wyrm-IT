import { mcpEnabled } from "@wyrm/core";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getAccess } from "@/lib/auth";
import { serverDb } from "@/lib/db";
import { input, primary, secondary } from "../../dashboard/classes";
import { authorizeAction } from "./actions";
import { parseAuthRequest } from "./request";

export const metadata: Metadata = { title: "Allow an AI app" };

/**
 * Consent for MCP clients (Claude, ChatGPT, Copilot...). The member signs in with their usual
 * Wyrm login, picks one organisation that has AI app access switched on, and allows the app.
 */
export default async function AuthorizePage({ searchParams }: PageProps<"/oauth/authorize">) {
  const params = await searchParams;
  if (typeof params.problem === "string") return <Problem text={params.problem.slice(0, 200)} />;
  const parsed = await parseAuthRequest(params);
  if (!parsed.ok) return <Problem text={parsed.problem} />;
  const { request } = parsed;

  const access = await getAccess();
  if (!access) {
    const query = new URLSearchParams(
      Object.entries(params).flatMap(([k, v]) => (typeof v === "string" ? [[k, v]] : [])),
    );
    redirect(`/login?next=${encodeURIComponent(`/oauth/authorize?${query.toString()}`)}`);
  }
  const db = serverDb();
  const choices = db
    ? (
        await Promise.all(
          access.tenants.map(async (t) => ((await mcpEnabled(db, t.tenantId)) ? t : null)),
        )
      ).filter((t) => t !== null)
    : [];

  return (
    <section className="mx-auto max-w-lg space-y-5 py-10">
      <h1 className="font-display text-3xl font-semibold">Allow {request.clientName}?</h1>
      <p className="text-ink-muted">
        {request.clientName} wants to use your Wyrm agents as <strong>{access.email}</strong>.
      </p>
      <ul className="list-disc space-y-1 pl-5 text-sm">
        <li>Talk to your sales agent and see the leads it records (owners only)</li>
        <li>Ask questions about your documents</li>
        <li>Request appointments. Nothing is booked until your team approves it.</li>
      </ul>
      <p className="text-sm text-ink-muted">
        It acts with your permissions. You can switch AI app access off in Wyrm at any time.
      </p>
      {choices.length === 0 ? (
        <p role="alert" className="rounded-xl border border-signal/60 bg-signal/10 p-3 text-sm">
          None of your organisations has AI app access switched on yet. Ask your Wyrm contact to
          switch it on.
        </p>
      ) : (
        <form action={authorizeAction} className="space-y-4">
          {(
            [
              "client_id",
              "redirect_uri",
              "state",
              "code_challenge",
              "code_challenge_method",
              "resource",
            ] as const
          ).map((k) => (
            <input
              key={k}
              type="hidden"
              name={k}
              value={
                k === "client_id"
                  ? request.clientId
                  : k === "redirect_uri"
                    ? request.redirectUri
                    : k === "state"
                      ? request.state
                      : k === "code_challenge"
                        ? request.codeChallenge
                        : k === "code_challenge_method"
                          ? "S256"
                          : request.resource
              }
            />
          ))}
          <label className="block">
            <span className="text-sm font-semibold">Organisation</span>
            <select name="tenantId" className={input} defaultValue={choices[0]?.tenantId}>
              {choices.map((t) => (
                <option key={t.tenantId} value={t.tenantId}>
                  {t.name}
                </option>
              ))}
            </select>
          </label>
          <div className="flex gap-3">
            <button type="submit" name="decision" value="allow" className={primary}>
              Allow
            </button>
            <button type="submit" name="decision" value="deny" className={secondary}>
              Cancel
            </button>
          </div>
        </form>
      )}
    </section>
  );
}

function Problem({ text }: { text: string }) {
  return (
    <section className="mx-auto max-w-lg space-y-3 py-10">
      <h1 className="font-display text-2xl font-semibold">This connection can't continue</h1>
      <p role="alert" className="text-ink-muted">
        {text}
      </p>
    </section>
  );
}
