"use client";

import Link from "next/link";
import { useActionState } from "react";
import { type PasswordState, setPassword } from "./actions";

const input =
  "w-full rounded-xl border border-line bg-paper px-4 py-3 outline-none focus-visible:border-ember";

export function PasswordForm() {
  const [state, action, pending] = useActionState<PasswordState, FormData>(setPassword, {});

  if (state.saved) {
    return (
      <p role="status" className="mt-6 rounded-xl border border-moss/50 bg-moss/10 p-4">
        Password saved. Next time, sign in with your email and this password.{" "}
        <Link href="/dashboard" className="font-semibold text-ember">
          Open dashboard →
        </Link>
      </p>
    );
  }

  return (
    <form action={action} className="mt-6 space-y-3">
      {state.error && (
        <p role="alert" className="rounded-xl border border-node-output/50 bg-node-output/10 p-3">
          {state.error}
        </p>
      )}
      <label htmlFor="password" className="block text-sm font-semibold">
        New password (at least 10 characters)
      </label>
      <input
        id="password"
        name="password"
        type="password"
        required
        minLength={10}
        maxLength={72}
        autoComplete="new-password"
        className={input}
      />
      <label htmlFor="confirm" className="block text-sm font-semibold">
        Repeat it
      </label>
      <input
        id="confirm"
        name="confirm"
        type="password"
        required
        autoComplete="new-password"
        className={input}
      />
      <button
        type="submit"
        disabled={pending}
        className="w-full rounded-lg bg-ember px-5 py-3 font-semibold text-paper hover:bg-ember-strong disabled:opacity-60"
      >
        {pending ? "Saving…" : "Save password"}
      </button>
    </form>
  );
}
