"use server";

import { redirect } from "next/navigation";
import { requireAccess } from "@/lib/auth";
import { passwordProblem } from "@/lib/config";
import { userClient } from "@/lib/supabase/server";

export interface PasswordState {
  error?: string;
  saved?: boolean;
}

/** Sets or changes the signed-in user's password (also the end of the reset-link flow). */
export async function setPassword(
  _prev: PasswordState,
  formData: FormData,
): Promise<PasswordState> {
  await requireAccess();
  const password = String(formData.get("password") ?? "");
  const problem = passwordProblem(password, String(formData.get("confirm") ?? ""));
  if (problem) return { error: problem };

  const supabase = await userClient();
  if (!supabase) redirect("/login");
  const { error } = await supabase.auth.updateUser({ password });
  if (error) {
    if (error.code === "same_password") return { error: "That's already your password." };
    if (error.code === "weak_password") return { error: "Choose a stronger password." };
    if (error.code === "reauthentication_needed")
      return { error: "For safety, sign in again (or use a reset link), then set the password." };
    console.warn(`set password failed: status=${error.status ?? ""} code=${error.code ?? ""}`);
    return { error: "Couldn't save the password. Try again." };
  }
  return { saved: true };
}
