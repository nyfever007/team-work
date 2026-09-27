"use client";

import { useTransition } from "react";
import Link from "next/link";
import { CalendarPlusIcon, FlagIcon, Loader2Icon, SendIcon, TargetIcon } from "lucide-react";
import { toast } from "sonner";
import { pullMilestoneTaskToDay, reviewMilestoneTask, setMilestoneTaskStatus } from "@/lib/milestones/task-actions";
import { MS_TASK_CLASS, MS_TASK_LABEL, type MilestoneTaskStatus } from "@/lib/milestones/task-types";
import { ApprovalActions } from "@/components/approval-actions";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

type Row = { id: number; title: string; status: MilestoneTaskStatus; dueDate: string | null; milestoneId: number; milestoneTitle: string; reviewNote: string; onToday: boolean };
type ReviewRow = { id: number; title: string; milestoneId: number; milestoneTitle: string; assigneeName: string | null };

function due(d: string, today: string) {
  const n = Math.round((Date.parse(`${d}T00:00:00Z`) - Date.parse(`${today}T00:00:00Z`)) / 86_400_000);
  return { text: n === 0 ? "오늘까지" : n > 0 ? `D-${n}` : `${-n}일 지남`, late: n < 0, soon: n >= 0 && n <= 2 };
}

/** 오늘: my open milestone 작업 (+ 오늘로 / 완료 보고) and, for owners/leaders, tasks waiting for 검수. */
export function MyMilestoneTasks({ tasks, reviews, today }: { tasks: Row[]; reviews: ReviewRow[]; today: string }) {
  const [pending, start] = useTransition();
  if (tasks.length + reviews.length === 0) return null;
  const run = (fn: () => Promise<{ ok: true; message: string } | { ok: false; error: string }>) =>
    start(async () => {
      try {
        const r = await fn();
        if (r.ok) toast.success(r.message);
        else toast.error(r.error);
      } catch {
        toast.error("요청에 실패했습니다.");
      }
    });

  return (
    <Card size="sm">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <TargetIcon className="size-4 text-brand" />
          내 마일스톤 작업
          {pending && <Loader2Icon className="ml-auto size-3.5 animate-spin text-muted-foreground" />}
        </CardTitle>
      </CardHeader>
      <CardContent className="grid gap-3">
        {tasks.length > 0 && (
          <ul className="grid gap-2">
            {tasks.map((t) => {
              const d = t.dueDate ? due(t.dueDate, today) : null;
              return (
                <li key={t.id} className="grid gap-1.5 rounded-lg border px-2.5 py-2 text-sm">
                  <div className="flex items-start gap-2">
                    <span className={cn("mt-0.5 shrink-0 rounded-full px-1.5 py-0.5 text-[10px] font-semibold", MS_TASK_CLASS[t.status])}>{MS_TASK_LABEL[t.status]}</span>
                    <span className="min-w-0 flex-1">
                      <span className="block font-medium leading-snug">{t.title}</span>
                      <Link href={`/team/milestones?m=${t.milestoneId}`} className="flex items-center gap-1 truncate text-[11px] text-muted-foreground hover:underline">
                        <FlagIcon className="size-3 shrink-0" />
                        {t.milestoneTitle}
                      </Link>
                    </span>
                    {d && <span className={cn("shrink-0 text-[11px] tabular-nums", d.late ? "font-semibold text-red-700" : d.soon ? "font-semibold text-amber-700" : "text-muted-foreground")}>{d.text}</span>}
                  </div>
                  {t.reviewNote && <p className="rounded bg-amber-50 px-2 py-1 text-[11px] text-amber-900">보완 요청: {t.reviewNote}</p>}
                  {t.status !== "review" && (
                    <div className="flex gap-1.5">
                      <Button size="xs" variant={t.onToday ? "ghost" : "outline"} disabled={pending || t.onToday} onClick={() => run(() => pullMilestoneTaskToDay(t.id, today))}>
                        <CalendarPlusIcon />
                        {t.onToday ? "오늘 목표에 있음" : "오늘로"}
                      </Button>
                      <Button size="xs" disabled={pending} onClick={() => run(() => setMilestoneTaskStatus(t.id, "review"))}>
                        <SendIcon />
                        완료 보고
                      </Button>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
        {reviews.length > 0 && (
          <div className={cn("grid gap-2", tasks.length > 0 && "border-t pt-3")}>
            <div className="text-xs font-semibold text-accent-foreground">검수할 작업 {reviews.length}</div>
            {reviews.map((r) => (
              <div key={r.id} className="grid gap-1.5 rounded-lg bg-brand-soft/50 px-2.5 py-2 text-sm">
                <span>
                  <span className="font-medium">{r.title}</span>
                  <span className="block text-[11px] text-muted-foreground">
                    {r.assigneeName ?? "담당자 없음"} 완료 보고 ·{" "}
                    <Link href={`/team/milestones?m=${r.milestoneId}`} className="hover:underline">
                      {r.milestoneTitle}
                    </Link>
                  </span>
                </span>
                <ApprovalActions decide={(d, n) => reviewMilestoneTask(r.id, d, n)} title={r.title} size="xs" approveLabel="검수 완료" rejectLabel="보완 요청" reasonPlaceholder="보완할 내용 (담당자에게 보입니다)" />
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
