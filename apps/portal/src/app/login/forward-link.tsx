"use client";

import { useEffect } from "react";

/**
 * Invitations sent from the Supabase dashboard open the site address with the session in the
 * #fragment; the proxy sends signed-out visitors here, keeping the fragment. Hand it on to
 * /auth/callback, which finishes the sign-in.
 */
export function ForwardLink() {
  useEffect(() => {
    if (window.location.hash.includes("access_token=")) {
      window.location.replace(`/auth/callback${window.location.hash}`);
    }
  }, []);
  return null;
}
