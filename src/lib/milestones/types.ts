import type { MilestoneRecord } from "@/lib/db/schema";

/** Milestone joined with its team name. */
export type MilestoneRow = MilestoneRecord & { team: string };

export const MILESTONE_STATUSES = ["planned", "in_progress", "done", "on_hold"] as const;
export type MilestoneStatus = (typeof MILESTONE_STATUSES)[number];

export const STATUS_LABEL: Record<MilestoneStatus, string> = {
  planned: "예정",
  in_progress: "진행 중",
  done: "완료",
  on_hold: "보류",
};

/** bar: Gantt bar track; fill: progress fill; badge: status chip; dot: legend dot */
export const STATUS_STYLE: Record<MilestoneStatus, { bar: string; fill: string; badge: string; dot: string }> = {
  planned: { bar: "bg-slate-200 text-slate-900", fill: "bg-slate-400/60", badge: "bg-slate-100 text-slate-800", dot: "bg-slate-400" },
  in_progress: { bar: "bg-blue-100 text-blue-950", fill: "bg-blue-500/70", badge: "bg-blue-100 text-blue-800", dot: "bg-blue-500" },
  done: { bar: "bg-emerald-100 text-emerald-950", fill: "bg-emerald-500/70", badge: "bg-emerald-100 text-emerald-800", dot: "bg-emerald-500" },
  on_hold: { bar: "bg-amber-100 text-amber-950", fill: "bg-amber-400/70", badge: "bg-amber-100 text-amber-800", dot: "bg-amber-400" },
};

/** Members propose milestones; the team leader (or admin) approves. Leader/admin-created ones start approved. */
export const MILESTONE_APPROVALS = ["pending", "approved", "rejected"] as const;
export type MilestoneApproval = (typeof MILESTONE_APPROVALS)[number];

export const APPROVAL_LABEL: Record<MilestoneApproval, string> = {
  pending: "승인 대기",
  approved: "승인됨",
  rejected: "반려",
};

export const APPROVAL_BADGE: Record<MilestoneApproval, string> = {
  pending: "bg-brand-soft text-accent-foreground ring-1 ring-brand/30",
  approved: "bg-emerald-100 text-emerald-800",
  rejected: "bg-red-100 text-red-800",
};

export const OVERDUE_BADGE = "bg-red-100 text-red-800";

export function isOverdue(m: { dueDate: string; status: MilestoneStatus }, today: string) {
  return m.status !== "done" && m.dueDate < today;
}
