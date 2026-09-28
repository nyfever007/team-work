import "server-only";
import type { SafeUser } from "@/lib/auth/session";
import { memberById } from "@/lib/members/queries";

export type ReviewerContext = {
  /** May write a review for this member. */
  canReview: (target: { id: number; teamId: number }) => boolean;
  /** May read reviews about this member. */
  canSee: (target: { id: number; teamId: number }) => boolean;
};

/** Admin: all. Team leader: own team (not self). Member: own reviews only. */
export function reviewerContext(user: SafeUser): ReviewerContext {
  if (user.role === "admin") return { canReview: () => true, canSee: () => true };
  const me = user.memberId != null ? memberById(user.memberId) : undefined;
  const leaderOf = me?.isLeader ? me.teamId : null;
  return {
    canReview: (t) => leaderOf !== null && t.teamId === leaderOf && t.id !== me?.id,
    canSee: (t) => t.id === me?.id || (leaderOf !== null && t.teamId === leaderOf),
  };
}
