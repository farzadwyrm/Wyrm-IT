import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getAccess } from "@/lib/auth";
import { publicConfig, safeNext } from "@/lib/config";
import { sendPasswordReset, signInWithGoogle, signInWithPassword } from "./actions";
import { ForwardLink } from "./forward-link";

export const metadata: Metadata = { title: "Sign in" };

const ERRORS: Record<string, string> = {
  credentials: "Email or password is wrong.",
  busy: "Too many attempts. Wait a minute and try again.",
  google: "Google sign-in isn't available right now. Use your email and password.",
  email: "Please enter a valid email address.",
  link: "That link has expired or was already used. Request a new one.",
  no_account:
    "There's no portal account for that Google address. Use the email you were invited with.",
};

const input =
  "w-full rounded-xl border border-line bg-paper px-4 py-3 outline-none focus-visible:border-ember";
const primary =
  "w-full rounded-lg bg-ember px-5 py-3 font-semibold text-paper hover:bg-ember-strong";

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

  const error = typeof params.error === "string" ? ERRORS[params.error] : undefined;
  const reset = params.mode === "reset";

  return (
    <section className="mx-auto max-w-md">
      <ForwardLink />
      <p className="font-mono text-xs uppercase tracking-[0.2em] text-signal">client portal</p>
      <h1 className="mt-3 font-display text-3xl font-semibold tracking-tight">
        {reset ? "Reset your password" : "Sign in"}
      </h1>
      {error && (
        <p
          role="alert"
          className="mt-6 rounded-xl border border-node-output/50 bg-node-output/10 p-3"
        >
          {error}
        </p>
      )}

      {reset ? (
        params.sent === "1" ? (
          <p role="status" className="mt-6 rounded-xl border border-line bg-paper-raised p-4">
            If this email has a portal account, a link to choose a new password is on its way.
          </p>
        ) : (
          <form action={sendPasswordReset} className="mt-6 space-y-3">
            <label htmlFor="email" className="block text-sm font-semibold">
              Work email
            </label>
            <input
              id="email"
              name="email"
              type="email"
              required
              autoComplete="email"
              className={input}
            />
            <button type="submit" className={primary}>
              Email me a reset link
            </button>
          </form>
        )
      ) : (
        <>
          <form action={signInWithGoogle} className="mt-6">
            <input type="hidden" name="next" value={next} />
            <button
              type="submit"
              className="w-full rounded-lg border border-line px-5 py-3 font-semibold hover:border-ink-muted"
            >
              Continue with Google
            </button>
          </form>
          <p className="my-5 text-center text-sm text-ink-muted">or</p>
          <form action={signInWithPassword} className="space-y-3">
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
              className={input}
            />
            <label htmlFor="password" className="block text-sm font-semibold">
              Password
            </label>
            <input
              id="password"
              name="password"
              type="password"
              required
              autoComplete="current-password"
              className={input}
            />
            <button type="submit" className={primary}>
              Sign in
            </button>
          </form>
        </>
      )}

      <p className="mt-6 text-sm text-ink-muted">
        {reset ? (
          <Link href="/login" className="font-semibold text-ember">
            Back to sign in
          </Link>
        ) : (
          <>
            <Link href="/login?mode=reset" className="font-semibold text-ember">
              Forgot or never set a password?
            </Link>{" "}
            Access is by invitation from Wyrm AI.
          </>
        )}
      </p>
    </section>
  );
}
