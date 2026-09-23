import { redirect } from "next/navigation";

export default async function Redirect({ searchParams }: PageProps<"/history">) {
  const sp = await searchParams;
  const q = new URLSearchParams();
  for (const [k, v] of Object.entries(sp)) if (typeof v === "string") q.set(k, v);
  const qs = q.toString();
  redirect(`/my/history${qs ? `?${qs}` : ""}`);
}
