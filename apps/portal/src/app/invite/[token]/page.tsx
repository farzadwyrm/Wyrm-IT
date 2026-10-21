import { findInvitation } from "@wyrm/core";
import type { Metadata } from "next";
import Link from "next/link";
import { getAccess } from "@/lib/auth";
import { serverDb } from "@/lib/db";
import { acceptInvite, sendInviteSignIn } from "./actions";

export const metadata: Metadata = { title: "Invitation" };

const ERRORS: Record<string, string> = {
  setup: "The portal isn't fully set up yet. Try again later.",
  invalid: "This invitation is no longer valid. Ask for a new one.",
  invalid_invitation: "This invitation is no longer valid. Ask for a new one.",
  account: "We couldn't prepare your login. Try again or ask for a new invitation.",
  email: "We couldn't send the sign-in email. Try again in a few minutes.",
  signin: "Sign in first.",
  wrong_account: "You're signed in with a different email than the one invited.",
  identity_separation: "Wyrm staff accounts can't join a customer organisation.",
  seat_limit: "This organisation has no free seats. Ask its owner to free one.",
  tenant_suspended: "This organisation is suspended.",
  already_member: "You're already a member. Open your dashboard.",
};

const button = "rounded-lg bg-ember px-5 py-2.5 font-semibold text-paper hover:bg-ember-strong";

export default async function InvitePage({ params, searchParams }: PageProps<"/invite/[token]">) {
  const { token } = await params;
  const query = await searchParams;
  const db = serverDb();
  const invite = db ? await findInvitation({ db, actor: null }, token) : null;
  const access = await getAccess();
  const error = typeof query.error === "string" ? (ERRORS[query.error] ?? ERRORS.invalid) : null;

  if (invite?.status !== "pending" || !invite.tenantActive) {
    return (
      <section className="mx-auto max-w-md">
        <h1 className="font-display text-3xl font-semibold">Invitation not valid</h1>
        <p className="mt-4 text-ink-muted">
          {invite?.status === "accepted"
            ? "This invitation was already used."
            : "It may have expired or been withdrawn. Ask whoever invited you for a new one."}
        </p>
        <Link href="/login" className="mt-6 inline-block font-semibold text-ember">
          Sign in →
        </Link>
      </section>
    );
  }

  const signedInAsInvitee = access?.email?.toLowerCase() === invite.email;
  return (
    <section className="mx-auto max-w-md space-y-5">
      <p className="font-mono text-xs uppercase tracking-[0.2em] text-signal">invitation</p>
      <h1 className="font-display text-3xl font-semibold">Join {invite.tenantName}</h1>
      <p className="text-ink-muted">
        You've been invited as <strong>{invite.roleName}</strong> using {invite.email}.
      </p>
      {error && (
        <p role="alert" className="rounded-xl border border-node-output/50 bg-node-output/10 p-3">
          {error}
        </p>
      )}
      {query.sent === "1" && (
        <p role="status" className="rounded-xl border border-moss/50 bg-moss/10 p-3">
          Check {invite.email} for a sign-in link. It brings you back here.
        </p>
      )}
      {signedInAsInvitee ? (
        <form action={acceptInvite}>
          <input type="hidden" name="token" value={token} />
          <button type="submit" className={button}>
            Accept and open dashboard
          </button>
        </form>
      ) : access ? (
        <p className="text-ink-muted">
          You're signed in as a different account. Sign out, then open this link again.
        </p>
      ) : (
        <form action={sendInviteSignIn}>
          <input type="hidden" name="token" value={token} />
          <button type="submit" className={button}>
            Email me a sign-in link
          </button>
        </form>
      )}
    </section>
  );
}
