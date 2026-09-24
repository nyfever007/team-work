import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth/dal";
import { canUseDinner } from "@/lib/dinner/access";

/** 회식비 품의 pages are for team leaders and admin only. */
export default async function DinnerLayout({ children }: LayoutProps<"/forms/dinner">) {
  const user = await requireUser();
  if (!canUseDinner(user)) redirect("/forms");
  return children;
}
