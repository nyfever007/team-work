// Client-safe constants for milestone 작업 (tasks). Flow: todo → in_progress → review (담당자 완료 보고) → approved (검수 완료).
// A reviewer can send a task in review back to in_progress with a note.

export const MILESTONE_TASK_STATUSES = ["todo", "in_progress", "review", "approved"] as const;
export type MilestoneTaskStatus = (typeof MILESTONE_TASK_STATUSES)[number];

export const MS_TASK_LABEL: Record<MilestoneTaskStatus, string> = {
  todo: "할 일",
  in_progress: "진행 중",
  review: "검수 대기",
  approved: "검수 완료",
};

export const MS_TASK_CLASS: Record<MilestoneTaskStatus, string> = {
  todo: "bg-muted text-muted-foreground",
  in_progress: "bg-amber-100 text-amber-900",
  review: "bg-brand-soft text-accent-foreground ring-1 ring-brand/30",
  approved: "bg-emerald-100 text-emerald-800",
};

/** Progress from tasks: only 검수 완료 counts (0–100). */
export function taskProgress(tasks: { status: MilestoneTaskStatus }[]): number {
  if (tasks.length === 0) return 0;
  return Math.round((tasks.filter((t) => t.status === "approved").length / tasks.length) * 100);
}
