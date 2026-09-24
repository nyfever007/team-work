import "server-only";
import type { SafeUser } from "@/lib/auth/session";
import { allMembers, memberById } from "./queries";
import type { Member } from "./types";

/**
 * Who may see and manage member records. Admin: everyone. Team leader: members of their own team
 * (add, edit basic info, create the login). Delete, moving teams and contract leave overrides stay admin-only.
 */
export function memberAccess(user: SafeUser) {
  const isAdmin = user.role === "admin";
  const me = user.memberId != null ? memberById(user.memberId) : undefined;
  const leaderOf = me?.isLeader ? me.teamId : null;
  const manages = (teamId: number) => isAdmin || (leaderOf !== null && teamId === leaderOf);
  return {
    isAdmin,
    me,
    /** Team ids this user manages; "all" for admin. */
    teamIds: (isAdmin ? "all" : leaderOf !== null ? [leaderOf] : []) as number[] | "all",
    canManageTeam: manages,
    canManage: (m: { teamId: number }) => manages(m.teamId),
    canSetAnnual: isAdmin,
    canDelete: isAdmin,
  };
}

/** Members shown on team-wide views (팀 현황): admin sees everyone, everyone else only their own team. */
export function teamScopedMembers(user: SafeUser): Member[] {
  const members = allMembers();
  if (user.role === "admin") return members;
  const me = user.memberId != null ? members.find((m) => m.id === user.memberId) : undefined;
  return me ? members.filter((m) => m.teamId === me.teamId) : [];
}
