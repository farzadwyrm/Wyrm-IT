import { redirect } from "next/navigation";

/** Old address: to-dos now live in the Inbox ("Needs you"). */
export default async function TodoPage({ searchParams }: PageProps<"/dashboard/todo">) {
  const params = await searchParams;
  const q = new URLSearchParams();
  for (const key of ["notice", "error"]) {
    const v = params[key];
    if (typeof v === "string") q.set(key, v.slice(0, 40));
  }
  redirect(`/dashboard/inbox${q.size ? `?${q.toString()}` : ""}`);
}
