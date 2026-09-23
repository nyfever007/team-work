import { redirect } from "next/navigation";

export default async function Redirect({ searchParams }: PageProps<"/team/milestones">) {
  const sp = await searchParams;
  const q = new URLSearchParams();
  for (const [k, v] of Object.entries(sp)) if (typeof v === "string") q.set(k, v);
  const qs = q.toString();
  redirect(`/team/milestones${qs ? `?${qs}` : ""}`);
}
