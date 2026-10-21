import type { Metadata } from "next";
import { Inter, JetBrains_Mono, Space_Grotesk } from "next/font/google";
import Link from "next/link";
import type { ReactNode } from "react";
import { getAccess } from "@/lib/auth";
import "./globals.css";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter", display: "swap" });
const grotesk = Space_Grotesk({ subsets: ["latin"], variable: "--font-grotesk", display: "swap" });
const mono = JetBrains_Mono({ subsets: ["latin"], variable: "--font-mono-jb", display: "swap" });

export const metadata: Metadata = {
  title: { default: "Wyrm AI portal", template: "%s | Wyrm AI portal" },
  robots: { index: false, follow: false },
};

export default async function RootLayout({ children }: { children: ReactNode }) {
  const access = await getAccess();
  return (
    <html lang="en" className={`${inter.variable} ${grotesk.variable} ${mono.variable}`}>
      <body className="flex min-h-dvh flex-col font-sans antialiased">
        <header className="border-b border-line bg-paper/90 backdrop-blur">
          <nav
            aria-label="Portal"
            className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-4 py-3 sm:px-6"
          >
            <Link href="/" className="font-display text-lg font-semibold tracking-tight">
              Wyrm AI <span className="font-mono text-xs text-signal">portal</span>
            </Link>
            {!access && (
              <Link
                href="/login"
                className="rounded-lg border border-line px-3 py-1.5 text-sm font-semibold hover:border-ember/60"
              >
                Sign in
              </Link>
            )}
            {access && (
              <div className="flex items-center gap-4 text-sm">
                <Link href="/dashboard" className="text-ink-muted hover:text-ink">
                  Dashboard
                </Link>
                {access.isAdmin && (
                  <Link href="/admin" className="text-ink-muted hover:text-ink">
                    Admin
                  </Link>
                )}
                <span className="hidden text-ink-muted sm:inline">{access.email}</span>
                <form action="/auth/sign-out" method="post">
                  <button type="submit" className="text-ink-muted hover:text-ink">
                    Sign out
                  </button>
                </form>
              </div>
            )}
          </nav>
        </header>
        <main id="main" className="mx-auto w-full max-w-5xl flex-1 px-4 py-10 sm:px-6">
          {children}
        </main>
      </body>
    </html>
  );
}
