import "server-only";
import type { SafeUser } from "@/lib/auth/session";
import { memberById } from "@/lib/members/queries";

/** 회식비 전산/청구품의 are for team leaders (and admin) only. */
export function canUseDinner(user: SafeUser): boolean {
  if (user.role === "admin") return true;
  return user.memberId != null && !!memberById(user.memberId)?.isLeader;
}
