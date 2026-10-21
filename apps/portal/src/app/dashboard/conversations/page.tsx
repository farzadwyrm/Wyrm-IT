import { redirect } from "next/navigation";

/** Old address: conversations now live in the Inbox ("All conversations"). */
export default async function ConversationsPage({
  searchParams,
}: PageProps<"/dashboard/conversations">) {
  const params = await searchParams;
  const q = new URLSearchParams({ view: "all" });
  for (const key of ["outcome", "channel", "agent", "q", "page"]) {
    const v = params[key];
    if (typeof v === "string") q.set(key, v.slice(0, 80));
  }
  redirect(`/dashboard/inbox?${q.toString()}`);
}
