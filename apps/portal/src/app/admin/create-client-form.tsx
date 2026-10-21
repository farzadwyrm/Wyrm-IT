"use client";

import { useActionState } from "react";
import { type CreateClientState, createClient } from "./actions";

const input =
  "w-full rounded-xl border border-line bg-paper px-4 py-2.5 outline-none focus-visible:border-ember";

export function CreateClientForm() {
  const [state, action, pending] = useActionState<CreateClientState, FormData>(createClient, {});

  return (
    <form
      action={action}
      className="max-w-lg space-y-4 rounded-2xl border border-line bg-paper-raised/80 p-6"
    >
      <h2 className="font-display text-xl font-semibold">New client</h2>
      {state.error && (
        <p role="alert" className="rounded-xl border border-node-output/50 bg-node-output/10 p-3">
          {state.error}
        </p>
      )}
      {state.created && (
        <div role="status" className="space-y-2 rounded-xl border border-moss/50 bg-moss/10 p-3">
          <p>
            <strong>{state.created.name}</strong> created. Send the owner this invitation link
            (valid 7 days, shown only once):
          </p>
          <input
            readOnly
            value={state.created.inviteUrl}
            className={`${input} font-mono text-xs`}
          />
        </div>
      )}
      <div className="space-y-1">
        <label htmlFor="name" className="text-sm font-semibold">
          Business name
        </label>
        <input id="name" name="name" required maxLength={120} className={input} />
      </div>
      <div className="space-y-1">
        <label htmlFor="slug" className="text-sm font-semibold">
          Short name (optional)
        </label>
        <input
          id="slug"
          name="slug"
          maxLength={60}
          placeholder="made from the name"
          className={input}
        />
      </div>
      <div className="space-y-1">
        <label htmlFor="ownerEmail" className="text-sm font-semibold">
          Owner's email
        </label>
        <input id="ownerEmail" name="ownerEmail" type="email" required className={input} />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1">
          <label htmlFor="plan" className="text-sm font-semibold">
            Plan
          </label>
          <select id="plan" name="plan" defaultValue="pilot" className={input}>
            <option value="pilot">Pilot</option>
            <option value="starter">Starter</option>
            <option value="growth">Growth</option>
            <option value="enterprise">Enterprise</option>
          </select>
        </div>
        <div className="space-y-1">
          <label htmlFor="seatLimit" className="text-sm font-semibold">
            Seats
          </label>
          <input
            id="seatLimit"
            name="seatLimit"
            type="number"
            min={1}
            max={500}
            defaultValue={5}
            className={input}
          />
        </div>
      </div>
      <button
        type="submit"
        disabled={pending}
        className="rounded-lg bg-ember px-5 py-2.5 font-semibold text-paper hover:bg-ember-strong disabled:opacity-60"
      >
        {pending ? "Creating…" : "Create client"}
      </button>
    </form>
  );
}
