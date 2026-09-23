import { redirect } from "next/navigation";

export default async function Redirect({ searchParams }: PageProps<"/logs">) {
  const { week } = await searchParams;
  redirect(`/team?view=week${typeof week === "string" ? `&week=${week}` : ""}`);
}
