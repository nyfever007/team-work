"use client";

import { TASK_STATUSES, TASK_STATUS_LABEL, TASK_STATUS_MARK, type TaskStatus } from "@/lib/tasks/types";
import { cn } from "@/lib/utils";

const ACTIVE: Record<TaskStatus, string> = {
  todo: "bg-muted text-foreground",
  in_progress: "bg-amber-100 text-amber-900",
  done: "bg-emerald-100 text-emerald-900",
};

export function StatusToggle({ value, onChange, disabled, label, compact }: { value: TaskStatus; onChange: (s: TaskStatus) => void; disabled?: boolean; label: string; compact?: boolean }) {
  return (
    <div role="radiogroup" aria-label={`${label} 상태`} className="flex shrink-0 rounded-md border p-0.5 text-xs">
      {TASK_STATUSES.map((s) => (
        <button key={s} type="button" role="radio" aria-checked={value === s} disabled={disabled} onClick={() => value !== s && onChange(s)} className={cn("rounded px-1.5 py-0.5 transition-colors hover:bg-muted", value === s && ACTIVE[s])} title={TASK_STATUS_LABEL[s]}>
          <span className={cn(!compact && "mr-1")}>{TASK_STATUS_MARK[s]}</span>
          {!compact && TASK_STATUS_LABEL[s]}
        </button>
      ))}
    </div>
  );
}
