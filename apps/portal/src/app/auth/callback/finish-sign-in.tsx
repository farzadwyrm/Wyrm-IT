"use client";

import { createBrowserClient } from "@supabase/ssr";
import { useEffect, useState } from "react";
import { safeNext } from "@/lib/config";

/** Reads the session from the link's #fragment, stores it as cookies, then opens the portal. */
export function FinishSignIn({ url, publishableKey }: { url: string; publishableKey: string }) {
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    const hash = new URLSearchParams(window.location.hash.slice(1));
    const query = new URLSearchParams(window.location.search);
    // Remove tokens from the address bar and history straight away.
    window.history.replaceState(null, "", window.location.pathname);

    const next = safeNext(query.get("next"));
    const code = query.get("code");
    if (code) {
      window.location.replace(
        `/auth/confirm?code=${encodeURIComponent(code)}&next=${encodeURIComponent(next)}`,
      );
      return;
    }
    const accessToken = hash.get("access_token");
    const refreshToken = hash.get("refresh_token");
    if (!accessToken || !refreshToken) {
      setFailed(true);
      return;
    }
    const supabase = createBrowserClient(url, publishableKey);
    supabase.auth
      .setSession({ access_token: accessToken, refresh_token: refreshToken })
      .then(({ error }) => {
        if (error) setFailed(true);
        else window.location.replace(next);
      })
      .catch(() => setFailed(true));
  }, [url, publishableKey]);

  return failed ? (
    <p role="alert" className="mt-4 text-ink-muted">
      This link has expired or was already used.{" "}
      <a href="/login" className="font-semibold text-ember hover:text-ember-strong">
        Request a new sign-in link
      </a>
      .
    </p>
  ) : (
    <p className="mt-4 text-ink-muted">One moment.</p>
  );
}
