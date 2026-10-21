"use client";

import { useActionState } from "react";
import { type InviteState, inviteAction } from "../actions";

const input =
  "w-full rounded-xl border border-line bg-paper px-3 py-2.5 outline-none focus-visible:border-ember";

export function InviteForm({ roles }: { roles: { id: string; name: string }[] }) {
  const [state, action, pending] = useActionState<InviteState, FormData>(inviteAction, {});
  return (
    <form action={action} className="space-y-3">
      {state.error && (
        <p role="alert" className="rounded-xl border border-node-output/50 bg-node-output/10 p-3">
          {state.error}
        </p>
      )}
      {state.link && (
        <div role="status" className="space-y-2 rounded-xl border border-moss/50 bg-moss/10 p-3">
          <p>Invitation created. Send this link (valid 7 days, shown once):</p>
          <input
            readOnly
            value={state.link}
            className={`${input} font-mono text-xs`}
            aria-label="Invitation link"
          />
        </div>
      )}
      <div className="grid gap-3 sm:grid-cols-[2fr_1fr_auto] sm:items-end">
        <label>
          <span className="text-sm font-semibold">Email</span>
          <input name="email" type="email" required className={input} />
        </label>
        <label>
          <span className="text-sm font-semibold">Role</span>
          <select name="roleId" className={input}>
            {roles.map((r) => (
              <option key={r.id} value={r.id}>
                {r.name}
              </option>
            ))}
          </select>
        </label>
        <button
          type="submit"
          disabled={pending}
          className="inline-flex min-h-11 items-center rounded-lg bg-ember px-4 font-semibold text-paper hover:bg-ember-strong disabled:opacity-60"
        >
          {pending ? "Inviting…" : "Invite"}
        </button>
      </div>
    </form>
  );
}
