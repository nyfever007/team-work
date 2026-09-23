import type { DailyTask } from "@/lib/db/schema";
import { TASK_STATUS_CLASS, TASK_STATUS_LABEL, TASK_STATUS_MARK } from "@/lib/tasks/types";
import { cn } from "@/lib/utils";

type Props = {
  tasks: DailyTask[];
  /** Show status marks and per-item notes (end-of-day view). */
  review?: boolean;
  /** Free-text extra notes appended below. */
  extra?: string;
  emptyText?: string;
  className?: string;
};

export function TaskLines({ tasks, review = false, extra, emptyText = "—", className }: Props) {
  if (tasks.length === 0 && !extra?.trim()) return <span className="text-muted-foreground">{emptyText}</span>;
  const done = tasks.filter((t) => t.status === "done").length;
  return (
    <div className={cn("grid gap-0.5 text-sm", className)}>
      {review && tasks.length > 0 && (
        <div className="mb-0.5 text-xs text-muted-foreground tabular-nums">
          완료 {done}/{tasks.length}
        </div>
      )}
      {tasks.map((t) => (
        <div key={t.id} className="flex items-start gap-1.5">
          <span className={cn("shrink-0 select-none", review ? TASK_STATUS_CLASS[t.status] : "text-muted-foreground")} title={review ? TASK_STATUS_LABEL[t.status] : undefined} aria-label={review ? TASK_STATUS_LABEL[t.status] : undefined}>
            {review ? TASK_STATUS_MARK[t.status] : "·"}
          </span>
          <span className={cn(review && t.status === "done" && "text-muted-foreground line-through decoration-muted-foreground/50")}>{t.title}</span>
        </div>
      ))}
      {extra?.trim() && (
        <div className={cn("whitespace-pre-wrap", tasks.length > 0 && "mt-1 border-t pt-1 text-muted-foreground")}>
          {tasks.length > 0 && <span className="mr-1 text-xs">추가</span>}
          {extra.trim()}
        </div>
      )}
    </div>
  );
}
