import "server-only";
import type { SafeUser } from "@/lib/auth/session";
import type { MilestoneApproval } from "@/lib/milestones/types";
import { memberById } from "@/lib/members/queries";

type Target = { teamId: number; ownerId: number | null; createdBy: number | null; approval: MilestoneApproval };

export type MilestoneAccess = {
  /** Create (propose) milestones for a given team. */
  canCreateFor: (teamId: number) => boolean;
  /** New milestones by this user start approved (leader of that team / admin). */
  autoApproves: (teamId: number) => boolean;
  /** Approve or reject proposals of this team. */
  canApprove: (m: { teamId: number }) => boolean;
  /** Edit or delete a milestone. */
  canManage: (m: Target) => boolean;
  /** Post a status update (approved milestones only). */
  canUpdate: (m: { teamId: number; approval: MilestoneApproval }) => boolean;
  /** Team ids this user may create milestones for; "all" for admin. */
  teamIds: number[] | "all";
  /** Team ids whose proposals this user approves; "all" for admin. */
  approveTeamIds: number[] | "all";
};

/**
 * Admin: everything. Team leader: own team (create approved, approve, edit, delete).
 * Member: propose for own team; edit/delete own proposal until approved (editing a rejected one resubmits it).
 * Owner of an approved milestone keeps edit rights, as before.
 */
export function milestoneAccess(user: SafeUser): MilestoneAccess {
  if (user.role === "admin") {
    return { canCreateFor: () => true, autoApproves: () => true, canApprove: () => true, canManage: () => true, canUpdate: (m) => m.approval === "approved", teamIds: "all", approveTeamIds: "all" };
  }
  const me = user.memberId != null ? memberById(user.memberId) : undefined;
  const teamId = me?.teamId ?? null;
  const leader = !!me?.isLeader;
  const leads = (t: number) => leader && t === teamId;
  return {
    canCreateFor: (t) => me != null && t === teamId,
    autoApproves: leads,
    canApprove: (m) => leads(m.teamId),
    canManage: (m) => leads(m.teamId) || (m.approval !== "approved" && m.createdBy === user.id) || (m.approval === "approved" && me != null && m.ownerId === me.id),
    canUpdate: (m) => m.approval === "approved" && me != null && m.teamId === teamId,
    teamIds: teamId != null ? [teamId] : [],
    approveTeamIds: leader && teamId != null ? [teamId] : [],
  };
}
