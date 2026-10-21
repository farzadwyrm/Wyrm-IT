import type { Metadata } from "next";
import { publicConfig } from "@/lib/config";
import { FinishSignIn } from "./finish-sign-in";

export const metadata: Metadata = { title: "Signing in" };

/**
 * Where invitation links land. Supabase's standard invite email puts the session in the URL
 * fragment (#access_token=…), which only the browser can read, so a small client component
 * finishes the sign-in.
 */
export default function CallbackPage() {
  const config = publicConfig();
  return (
    <section className="mx-auto max-w-md">
      <h1 className="font-display text-3xl font-semibold tracking-tight">Signing you in…</h1>
      {config ? (
        <FinishSignIn url={config.url} publishableKey={config.publishableKey} />
      ) : (
        <p className="mt-4 text-ink-muted">The portal isn't connected yet.</p>
      )}
    </section>
  );
}
