import { createServerClient } from "@supabase/ssr";
import { type NextRequest, NextResponse } from "next/server";
import { isPublicPath, publicConfig } from "./lib/config";

/**
 * Runs before every page: refreshes the Supabase session cookie and sends signed-out visitors
 * to /login. This is only the first gate; every page and action checks access again on the
 * server (lib/auth.ts), and the database enforces row-level security.
 */
export async function proxy(request: NextRequest) {
  const config = publicConfig();
  const { pathname } = request.nextUrl;
  let response = NextResponse.next({ request });

  if (!config) {
    // Not connected yet: only the sign-in page (which explains the setup) is reachable.
    return pathname === "/login" ? response : NextResponse.redirect(new URL("/login", request.url));
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
  if (!data?.claims && !isPublicPath(pathname)) {
    const login = new URL("/login", request.url);
    if (pathname !== "/") login.searchParams.set("next", pathname);
    return NextResponse.redirect(login);
  }
  return response;
}

export const config = {
  // Everything except static files and images.
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"],
};
