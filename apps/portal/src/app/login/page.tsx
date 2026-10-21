import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getAccess } from "@/lib/auth";
import { publicConfig, safeNext } from "@/lib/config";
import { sendSignInLink } from "./actions";
import { ForwardLink } from "./forward-link";

export const metadata: Metadata = { title: "Sign in" };

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const params = await searchParams;
  const next = safeNext(typeof params.next === "string" ? params.next : "/dashboard");
  if (await getAccess()) redirect(next);

  if (!publicConfig()) {
    return (
      <section className="mx-auto max-w-md">
        <h1 className="font-display text-3xl font-semibold">Portal not connected yet</h1>
        <p className="mt-4 text-ink-muted">
          The Supabase project isn't configured. Add the values from apps/portal/.env.example to
          apps/portal/.env.local (or to the Vercel project settings) and restart.
        </p>
      </section>
    );
  }

  const sent = params.sent === "1";
  const badEmail = params.error === "email";
  const linkFailed = params.error === "link";

  return (
    <section className="mx-auto max-w-md">
      <ForwardLink />
      <p className="font-mono text-xs uppercase tracking-[0.2em] text-signal">client portal</p>
      <h1 className="mt-3 font-display text-3xl font-semibold tracking-tight">Sign in</h1>
      {sent ? (
        <p role="status" className="mt-6 rounded-xl border border-line bg-paper-raised p-4">
          If this email has access to the portal, a sign-in link is on its way. It works once and
          expires after an hour.
        </p>
      ) : (
        <>
          <p className="mt-3 text-ink-muted">
            We'll email you a one-time sign-in link. No password needed.
          </p>
          <form action={sendSignInLink} className="mt-6 space-y-3">
            <input type="hidden" name="next" value={next} />
            <label htmlFor="email" className="block text-sm font-semibold">
              Work email
            </label>
            <input
              id="email"
              name="email"
              type="email"
              required
              autoComplete="email"
              className="w-full rounded-xl border border-line bg-paper px-4 py-3 outline-none focus-visible:border-ember"
            />
            {(badEmail || linkFailed) && (
              <p role="alert" className="text-sm text-node-output">
                {badEmail
                  ? "Please enter a valid email address."
                  : "That link has expired or was already used. Request a new one."}
              </p>
            )}
            <button
              type="submit"
              className="w-full rounded-lg bg-ember px-5 py-3 font-semibold text-paper hover:bg-ember-strong"
            >
              Email me a sign-in link
            </button>
          </form>
          <p className="mt-6 text-sm text-ink-muted">
            Access is by invitation from Wyrm AI. No account yet? Ask your Wyrm contact.
          </p>
        </>
      )}
    </section>
  );
}
