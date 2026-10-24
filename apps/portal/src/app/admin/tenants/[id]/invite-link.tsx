"use client";

import { useActionState } from "react";
import { type InviteLinkState, newInviteLinkAction } from "../../actions";

/** One pending invitation, with a button that makes a fresh link (the old one stops working). */
export function InviteLink({
  tenantId,
  invitationId,
  email,
  status,
}: {
  tenantId: string;
  invitationId: string;
  email: string;
  status: string;
}) {
  const [state, action, pending] = useActionState<InviteLinkState, FormData>(
    newInviteLinkAction,
    {},
  );
  return (
    <li className="space-y-2 p-3">
      <form action={action} className="flex flex-wrap items-center justify-between gap-2">
        <input type="hidden" name="tenantId" value={tenantId} />
        <input type="hidden" name="invitationId" value={invitationId} />
        <span>
          {email} <span className="text-sm text-ink-muted">· invitation {status}</span>
        </span>
        <button
          type="submit"
          disabled={pending}
          className="inline-flex min-h-11 items-center rounded-lg border border-line px-4 font-semibold hover:border-ink-muted disabled:opacity-60"
        >
          {pending ? "Making a link…" : "New invite link"}
        </button>
      </form>
      {state.error && (
        <p role="alert" className="text-sm text-node-output">
          {state.error}
        </p>
      )}
      {state.url && (
        <div role="status" className="space-y-1 text-sm">
          <p>
            Open this link in a private window and sign up with {email}. Valid 7 days; earlier links
            no longer work.
          </p>
          <input
            readOnly
            value={state.url}
            aria-label={`Invite link for ${email}`}
            onFocus={(e) => e.currentTarget.select()}
            className="w-full rounded-xl border border-line bg-paper px-3 py-2 font-mono text-xs"
          />
        </div>
      )}
    </li>
  );
}
