import "server-only";
import { createClient } from "@supabase/supabase-js";
import { publicConfig } from "../config";

/**
 * Supabase client with the secret key: bypasses row-level security. Use only after
 * `requireAdmin()` has confirmed the caller is Wyrm staff, and only for actions RLS can't do
 * (inviting users, creating organisations). Never import this from a client component.
 */
export function adminClient() {
  const config = publicConfig();
  const secret = process.env.SUPABASE_SECRET_KEY?.trim();
  if (!config || !secret) return null;
  return createClient(config.url, secret, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
