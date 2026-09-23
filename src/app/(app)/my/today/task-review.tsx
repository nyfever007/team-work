"use client";

import { useTransition } from "react";
import { toast } from "sonner";
import type { DailyTask } from "@/lib/db/schema";
import { setTaskStatus } from "@/lib/tasks/actions";
import { TASK_STATUSES, TASK_STATUS_LABEL, TASK_STATUS_MARK, type TaskStatus } from "@/lib/tasks/types";
import { cn } from "@/lib/utils";

const ACTIVE: Record<TaskStatus, string> = {
  todo: "bg-muted text-foreground",
  in_progress: "bg-amber-100 text-amber-900",
  done: "bg-emerald-100 text-emerald-900",
};

export function TaskReview({ tasks }: { tasks: DailyTask[] }) {
  const [pending, start] = useTransition();
  const done = tasks.filter((t) => t.status === "done").length;

  const run = (fn: () => Promise<{ ok: boolean; error?: string }>) =>
    start(async () => {
      try {
        const r = await fn();
        if (!r.ok) toast.error(r.error ?? "실패했습니다.");
      } catch {
        toast.error("요청에 실패했습니다.");
      }
    });

  if (tasks.length === 0) return <p className="py-2 text-sm text-muted-foreground">오늘 할 일이 없습니다. 먼저 할 일을 추가하면 여기서 완료 여부를 표시할 수 있습니다.</p>;

  return (
    <div className="grid gap-2">
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span>
          완료 <span className="font-medium text-foreground tabular-nums">{done}</span>/{tasks.length}
        </span>
        <span>{pending ? "저장 중…" : "변경 시 자동 저장"}</span>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-muted">
        <div className="h-full rounded-full bg-emerald-500 transition-all" style={{ width: `${tasks.length ? (done / tasks.length) * 100 : 0}%` }} />
      </div>
      <ol className="grid gap-1.5">
        {tasks.map((t) => (
          <ReviewRow key={t.id} task={t} disabled={pending} onStatus={(s) => run(() => setTaskStatus(t.id, s))} />
        ))}
      </ol>
    </div>
  );
}

function ReviewRow({ task, disabled, onStatus }: { task: DailyTask; disabled: boolean; onStatus: (s: TaskStatus) => void }) {
  return (
    <li className="rounded-md border px-2.5 py-2">
      <div className="flex flex-wrap items-center gap-2">
        <span className={cn("flex-1 text-sm", task.status === "done" && "text-muted-foreground line-through")}>{task.title}</span>
        <div role="radiogroup" aria-label={`${task.title} 상태`} className="flex rounded-md border p-0.5 text-xs">
          {TASK_STATUSES.map((s) => (
            <button
              key={s}
              type="button"
              role="radio"
              aria-checked={task.status === s}
              disabled={disabled}
              onClick={() => task.status !== s && onStatus(s)}
              className={cn("rounded px-2 py-0.5 transition-colors hover:bg-muted", task.status === s && ACTIVE[s])}
            >
              <span className="mr-1">{TASK_STATUS_MARK[s]}</span>
              {TASK_STATUS_LABEL[s]}
            </button>
          ))}
        </div>
      </div>
    </li>
  );
}
