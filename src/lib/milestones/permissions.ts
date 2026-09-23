import "server-only";
import type { SafeUser } from "@/lib/auth/session";
import { memberById } from "@/lib/members/queries";

export type MilestoneAccess = {
  /** Create milestones for a given team. */
  canCreateFor: (teamId: number) => boolean;
  /** Edit or delete a milestone. */
  canManage: (m: { teamId: number; ownerId: number | null }) => boolean;
  /** Post a status update. */
  canUpdate: (m: { teamId: number }) => boolean;
  /** Team ids this user may create milestones for; "all" for admin. */
  teamIds: number[] | "all";
};

/** Admin: everything. Team leader: own team. Owner: own milestone. Team member: updates only. */
export function milestoneAccess(user: SafeUser): MilestoneAccess {
  if (user.role === "admin") {
    return { canCreateFor: () => true, canManage: () => true, canUpdate: () => true, teamIds: "all" };
  }
  const me = user.memberId != null ? memberById(user.memberId) : undefined;
  const teamId = me?.teamId ?? null;
  const leader = !!me?.isLeader;
  return {
    canCreateFor: (t) => leader && t === teamId,
    canManage: (m) => (leader && m.teamId === teamId) || (me != null && m.ownerId === me.id),
    canUpdate: (m) => me != null && m.teamId === teamId,
    teamIds: leader && teamId != null ? [teamId] : [],
  };
}
