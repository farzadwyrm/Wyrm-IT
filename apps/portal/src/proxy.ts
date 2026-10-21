import { createServerClient } from "@supabase/ssr";
import { type NextRequest, NextResponse } from "next/server";
import { isProtectedPath, publicConfig } from "./lib/config";

/**
 * Runs before every page: keeps the Supabase session cookie fresh and sends signed-out
 * visitors to /login, but only for the client area (/dashboard, /admin). Everything else is
 * public. This is only the first gate; client pages and actions check access again on the
 * server (lib/auth.ts), and the database enforces row-level security.
 */
export async function proxy(request: NextRequest) {
  const config = publicConfig();
  const { pathname } = request.nextUrl;
  let response = NextResponse.next({ request });

  if (!config) {
    // Not connected yet: the client area is closed; public pages still work.
    return isProtectedPath(pathname)
      ? NextResponse.redirect(new URL("/login", request.url))
      : response;
  }

  const supabase = createServerClient(config.url, config.publishableKey, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: (toSet, headers) => {
        for (const { name, value } of toSet) request.cookies.set(name, value);
        response = NextResponse.next({ request });
        for (const { name, value, options } of toSet) response.cookies.set(name, value, options);
        for (const [key, value] of Object.entries(headers)) response.headers.set(key, value);
      },
    },
  });

  const { data } = await supabase.auth.getClaims();
  if (!data?.claims && isProtectedPath(pathname)) {
    const login = new URL("/login", request.url);
    login.searchParams.set("next", pathname);
    return NextResponse.redirect(login);
  }
  return response;
}

export const config = {
  // Everything except static files and images.
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"],
};
