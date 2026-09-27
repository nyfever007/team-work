"use client";

import { useState, useTransition } from "react";
import { AnimatePresence, motion } from "motion/react";
import { CalendarPlusIcon, CheckCircle2Icon, Loader2Icon, PencilIcon, PlayIcon, PlusIcon, SendIcon, Trash2Icon, Undo2Icon, UserIcon } from "lucide-react";
import { toast } from "sonner";
import type { MilestoneTask } from "@/lib/db/schema";
import { addMilestoneTask, deleteMilestoneTask, pullMilestoneTaskToDay, reviewMilestoneTask, setMilestoneTaskStatus, updateMilestoneTask } from "@/lib/milestones/task-actions";
import { MS_TASK_CLASS, MS_TASK_LABEL } from "@/lib/milestones/task-types";
import { ApprovalActions } from "@/components/approval-actions";
import { DatePicker } from "@/components/date-picker";
import { EASE } from "@/components/motion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { cn } from "@/lib/utils";

type Props = {
  milestoneId: number;
  tasks: MilestoneTask[];
  /** Members of the milestone's team (assignee options). */
  members: { id: number; name: string }[];
  canManage: boolean;
  canReview: boolean;
  myMemberId: number | null;
  today: string;
};

type Result = { ok: true; message: string } | { ok: false; error: string };

function dday(due: string, today: string) {
  const d = Math.round((Date.parse(`${due}T00:00:00Z`) - Date.parse(`${today}T00:00:00Z`)) / 86_400_000);
  return d === 0 ? "오늘까지" : d > 0 ? `D-${d}` : `${-d}일 지남`;
}

export function MilestoneTasks({ milestoneId, tasks, members, canManage, canReview, myMemberId, today }: Props) {
  const [pending, start] = useTransition();
  const [editing, setEditing] = useState<number | null>(null);
  const nameOf = new Map(members.map((m) => [m.id, m.name]));
  const total = tasks.length;
  const approved = tasks.filter((t) => t.status === "approved").length;
  const review = tasks.filter((t) => t.status === "review").length;

  const run = (fn: () => Promise<Result>, after?: () => void) =>
    start(async () => {
      try {
        const r = await fn();
        if (r.ok) {
          toast.success(r.message);
          after?.();
        } else toast.error(r.error);
      } catch {
        toast.error("요청에 실패했습니다.");
      }
    });

  return (
    <div className="grid gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <h3 className="text-sm font-semibold">해야 할 일</h3>
        <span className="text-xs text-muted-foreground tabular-nums">
          검수 완료 {approved} · 검수 대기 {review} · 전체 {total}
        </span>
        {total > 0 && <span className="ml-auto text-xs font-semibold tabular-nums">{Math.round((approved / total) * 100)}%</span>}
      </div>
      {total > 0 && (
        <div className="flex h-2 overflow-hidden rounded-full bg-muted" aria-hidden>
          <motion.div className="h-full bg-success" initial={false} animate={{ width: `${(approved / total) * 100}%` }} transition={{ duration: 0.5, ease: EASE }} />
          <motion.div className="h-full bg-brand/40" initial={false} animate={{ width: `${(review / total) * 100}%` }} transition={{ duration: 0.5, ease: EASE }} />
        </div>
      )}
      {total === 0 && <p className="text-xs text-muted-foreground">아직 작업이 없습니다.{canManage && " 마일스톤을 이루기 위해 필요한 일을 나눠 담당자를 정해 주세요. 작업이 생기면 진행률은 검수 완료 기준으로 자동 계산됩니다."}</p>}

      <ul className="grid gap-1.5">
        <AnimatePresence initial={false}>
          {tasks.map((t) => {
            const mine = myMemberId != null && t.assigneeId === myMemberId;
            const overdue = t.dueDate && t.status !== "approved" && t.dueDate < today;
            return (
              <motion.li key={t.id} layout initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }} className={cn("grid gap-2 rounded-lg border px-3 py-2", mine && t.status !== "approved" && "border-brand/30 bg-brand-soft/30")}>
                {editing === t.id ? (
                  <TaskEditor
                    members={members}
                    initial={{ title: t.title, assigneeId: t.assigneeId, dueDate: t.dueDate }}
                    pending={pending}
                    submitLabel="저장"
                    onCancel={() => setEditing(null)}
                    onSubmit={(v) => run(() => updateMilestoneTask(t.id, v), () => setEditing(null))}
                  />
                ) : (
                  <>
                    <div className="flex flex-wrap items-center gap-2 text-sm">
                      <span className={cn("shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold", MS_TASK_CLASS[t.status])}>{MS_TASK_LABEL[t.status]}</span>
                      <span className={cn("min-w-0 flex-1 font-medium", t.status === "approved" && "text-muted-foreground line-through decoration-muted-foreground/40")}>{t.title}</span>
                      <span className={cn("inline-flex items-center gap-1 text-xs", mine ? "font-semibold text-accent-foreground" : "text-muted-foreground")}>
                        <UserIcon className="size-3" />
                        {t.assigneeId != null ? nameOf.get(t.assigneeId) ?? "—" : "담당자 없음"}
                        {mine && " (나)"}
                      </span>
                      {t.dueDate && <span className={cn("text-xs tabular-nums", overdue ? "font-semibold text-red-700" : "text-muted-foreground")}>{t.dueDate.slice(5).replace("-", "/")} · {t.status === "approved" ? "완료" : dday(t.dueDate, today)}</span>}
                    </div>
                    {t.reviewNote && t.status !== "approved" && <p className="rounded-md bg-amber-50 px-2 py-1 text-xs text-amber-900">보완 요청: {t.reviewNote}</p>}
                    {t.status === "approved" && t.approvedByName && <p className="text-[11px] text-emerald-700">{t.approvedByName} 검수 완료</p>}
                    <div className="flex flex-wrap items-center gap-1.5">
                      {mine && t.status === "todo" && (
                        <Button size="xs" variant="outline" disabled={pending} onClick={() => run(() => setMilestoneTaskStatus(t.id, "in_progress"))}>
                          <PlayIcon />
                          시작
                        </Button>
                      )}
                      {mine && (t.status === "todo" || t.status === "in_progress") && (
                        <>
                          <Button size="xs" disabled={pending} onClick={() => run(() => setMilestoneTaskStatus(t.id, "review"))}>
                            <SendIcon />
                            완료 보고
                          </Button>
                          <Button size="xs" variant="ghost" disabled={pending} onClick={() => run(() => pullMilestoneTaskToDay(t.id, today))}>
                            <CalendarPlusIcon />
                            오늘로
                          </Button>
                        </>
                      )}
                      {mine && t.status === "review" && !canReview && (
                        <Button size="xs" variant="ghost" disabled={pending} onClick={() => run(() => setMilestoneTaskStatus(t.id, "in_progress"))}>
                          <Undo2Icon />
                          보고 취소
                        </Button>
                      )}
                      {canReview && t.status === "review" && (
                        <ApprovalActions decide={(d, n) => reviewMilestoneTask(t.id, d, n)} title={t.title} size="xs" approveLabel="검수 완료" rejectLabel="보완 요청" reasonPlaceholder="보완할 내용 (담당자에게 보입니다)" />
                      )}
                      {canManage && (
                        <span className="ml-auto flex gap-0.5">
                          <Button size="icon-xs" variant="ghost" aria-label={`${t.title} 수정`} disabled={pending} onClick={() => setEditing(t.id)}>
                            <PencilIcon />
                          </Button>
                          <Button size="icon-xs" variant="ghost" aria-label={`${t.title} 삭제`} disabled={pending} onClick={() => run(() => deleteMilestoneTask(t.id))}>
                            <Trash2Icon />
                          </Button>
                        </span>
                      )}
                    </div>
                  </>
                )}
              </motion.li>
            );
          })}
        </AnimatePresence>
      </ul>

      {canManage && <AddTask milestoneId={milestoneId} members={members} pending={pending} run={run} />}
      {total > 0 && (
        <p className="flex items-center gap-1 text-[11px] text-muted-foreground">
          <CheckCircle2Icon className="size-3" />
          담당자가 ‘완료 보고’하면 마일스톤 담당자(없으면 팀장)가 검수합니다. 진행률은 검수 완료 기준입니다.
        </p>
      )}
    </div>
  );
}

function AddTask({ milestoneId, members, pending, run }: { milestoneId: number; members: { id: number; name: string }[]; pending: boolean; run: (fn: () => Promise<Result>, after?: () => void) => void }) {
  const [open, setOpen] = useState(false);
  const [key, setKey] = useState(0);
  if (!open)
    return (
      <Button size="sm" variant="outline" className="w-fit" onClick={() => setOpen(true)}>
        <PlusIcon />
        작업 추가
      </Button>
    );
  return (
    <div className="rounded-lg border border-dashed p-3">
      <TaskEditor
        key={key}
        members={members}
        initial={{ title: "", assigneeId: null, dueDate: null }}
        pending={pending}
        submitLabel="추가"
        onCancel={() => setOpen(false)}
        onSubmit={(v) => run(() => addMilestoneTask(milestoneId, v), () => setKey((k) => k + 1))}
      />
    </div>
  );
}

type TaskValue = { title: string; assigneeId: number | null; dueDate: string | null };

function TaskEditor({ members, initial, pending, submitLabel, onSubmit, onCancel }: { members: { id: number; name: string }[]; initial: TaskValue; pending: boolean; submitLabel: string; onSubmit: (v: TaskValue) => void; onCancel: () => void }) {
  const [title, setTitle] = useState(initial.title);
  const [assigneeId, setAssigneeId] = useState(initial.assigneeId ? String(initial.assigneeId) : "");
  const [dueDate, setDueDate] = useState(initial.dueDate ?? "");
  return (
    <form
      className="grid gap-2"
      onSubmit={(e) => {
        e.preventDefault();
        if (title.trim()) onSubmit({ title, assigneeId: assigneeId ? Number(assigneeId) : null, dueDate: dueDate || null });
      }}
    >
      <Input autoFocus value={title} onChange={(e) => setTitle(e.target.value)} maxLength={200} placeholder="해야 할 일 (예: 결제 API 부하 테스트)" aria-label="작업 내용" className="h-8" />
      <div className="flex flex-wrap items-center gap-2">
        <NativeSelect size="sm" value={assigneeId} onChange={(e) => setAssigneeId(e.target.value)} aria-label="담당자">
          <NativeSelectOption value="">담당자 선택</NativeSelectOption>
          {members.map((m) => (
            <NativeSelectOption key={m.id} value={m.id}>{m.name}</NativeSelectOption>
          ))}
        </NativeSelect>
        <DatePicker value={dueDate} onChange={setDueDate} placeholder="기한 (선택)" className="h-7 w-auto text-xs" />
        {dueDate && (
          <button type="button" className="text-xs text-muted-foreground underline" onClick={() => setDueDate("")}>
            기한 지우기
          </button>
        )}
        <span className="ml-auto flex gap-1">
          <Button type="button" size="xs" variant="ghost" onClick={onCancel} disabled={pending}>취소</Button>
          <Button type="submit" size="xs" disabled={pending || !title.trim()}>
            {pending && <Loader2Icon className="animate-spin" />}
            {submitLabel}
          </Button>
        </span>
      </div>
    </form>
  );
}
