export const TASK_STATUSES = ["todo", "in_progress", "done"] as const;
export type TaskStatus = (typeof TASK_STATUSES)[number];

export const TASK_STATUS_LABEL: Record<TaskStatus, string> = {
  todo: "미완료",
  in_progress: "진행 중",
  done: "완료",
};

export const TASK_STATUS_MARK: Record<TaskStatus, string> = {
  todo: "○",
  in_progress: "◐",
  done: "●",
};

export const TASK_STATUS_CLASS: Record<TaskStatus, string> = {
  todo: "text-muted-foreground",
  in_progress: "text-amber-600",
  done: "text-emerald-600",
};
