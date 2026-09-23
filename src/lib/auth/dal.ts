import "server-only";
import { redirect } from "next/navigation";
import { getCurrentUser } from "./session";

/** Use in protected layouts, pages and server actions. Redirects to /login when unauthenticated. */
export async function requireUser() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  return user;
}

/** Like requireUser, but also requires the admin role. Throws for non-admins (use in server actions). */
export async function requireAdmin() {
  const user = await requireUser();
  if (user.role !== "admin") throw new Error("관리자 권한이 필요합니다.");
  return user;
}

/** Requires the account to be linked to a team member. Throws otherwise (use in server actions). */
export async function requireMember() {
  const user = await requireUser();
  if (user.memberId == null) throw new Error("구성원 정보와 연결된 계정만 사용할 수 있습니다.");
  return { ...user, memberId: user.memberId };
}
