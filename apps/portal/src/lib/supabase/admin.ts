import "server-only";
import { createClient } from "@supabase/supabase-js";
import { compact, publicConfig } from "../config";

/**
 * Supabase client with the secret key: bypasses row-level security. Use only after
 * `requireAdmin()` has confirmed the caller is Wyrm staff, and only for actions RLS can't do
 * (inviting users, creating organisations). Never import this from a client component.
 */
export function adminClient() {
  const config = publicConfig();
  const secret = compact(process.env.SUPABASE_SECRET_KEY);
  if (!config || !secret) return null;
  return createClient(config.url, secret, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
