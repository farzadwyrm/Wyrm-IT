/**
 * Portal settings from the environment. Public values (URL, publishable key) are safe in the
 * browser; the secret key is read only in `supabase/admin.ts`, which is server-only.
 */
/** Keys and URLs never contain whitespace: drop any pasted line breaks or spaces. */
export const compact = (v: string | undefined) => {
  const cleaned = v?.replace(/\s+/g, "").replace(/\/+$/, "") ?? "";
  return cleaned === "" ? null : cleaned;
};

export interface PublicConfig {
  url: string;
  publishableKey: string;
}

/** Null until the Supabase project is connected (`.env.local` or Vercel settings). */
export function publicConfig(): PublicConfig | null {
  const url = compact(process.env.NEXT_PUBLIC_SUPABASE_URL);
  const publishableKey = compact(process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY);
  return url && publishableKey ? { url, publishableKey } : null;
}

/** The client area: the only paths that need signing in. Everything else is public. */
export const PROTECTED_PATHS = ["/dashboard", "/admin"] as const;

export const isProtectedPath = (pathname: string) =>
  PROTECTED_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`));

/** The public website, where the tools live. */
export const MAIN_SITE =
  compact(process.env.NEXT_PUBLIC_MAIN_SITE_URL) ?? "https://wyrm-it.vercel.app";

/**
 * Where to go after signing in. Only same-site paths are allowed, so a crafted link can never
 * send someone to another website.
 */
export function safeNext(next: string | null | undefined): string {
  if (!next?.startsWith("/") || next.startsWith("//") || next.startsWith("/\\")) return "/";
  if (/[\r\n]/.test(next) || next.includes("://")) return "/";
  return next;
}

/** URL-safe organisation slug from a name: "Bright Cuts Salon" -> "bright-cuts-salon". */
export function slugify(name: string): string {
  return name
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

export const isValidSlug = (slug: string) => /^[a-z0-9-]{2,60}$/.test(slug);

/** Loose but safe email check for forms (Supabase validates again). */
export const isEmail = (email: string) => /^[^\s@]{1,64}@[^\s@]{1,190}\.[^\s@]{2,}$/.test(email);
