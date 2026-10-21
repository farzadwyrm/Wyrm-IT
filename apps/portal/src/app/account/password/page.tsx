import type { Metadata } from "next";
import { requireAccess } from "@/lib/auth";
import { PasswordForm } from "./password-form";

export const metadata: Metadata = { title: "Password" };

export default async function PasswordPage() {
  const access = await requireAccess();
  return (
    <section className="mx-auto max-w-md">
      <p className="font-mono text-xs uppercase tracking-[0.2em] text-signal">account</p>
      <h1 className="mt-3 font-display text-3xl font-semibold tracking-tight">Set your password</h1>
      <p className="mt-3 text-ink-muted">For {access.email}.</p>
      <PasswordForm />
    </section>
  );
}
