"use client";

import { useOptimistic, useRef, useState, useTransition } from "react";
import { AnimatePresence, motion } from "motion/react";
import { CheckIcon, CornerDownLeftIcon, HistoryIcon, Loader2Icon, PartyPopperIcon, PlusIcon, TimerIcon, Trash2Icon } from "lucide-react";
import { toast } from "sonner";
import type { DailyTask, WeeklyItem } from "@/lib/db/schema";
import { pullWeeklyItemToDay } from "@/lib/plans/actions";
import { addTask, carryOverTasks, deleteTask, renameTask, setTaskStatus } from "@/lib/tasks/actions";
import type { TaskStatus } from "@/lib/tasks/types";
import { EASE, ProgressBar } from "@/components/motion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

type Props = {
  date: string;
  tasks: DailyTask[];
  /** Previous working day with unfinished items, if any. */
  carryFrom?: { date: string; label: string; count: number } | null;
  /** This week's items (quick-add chips and linked labels). */
  weeklyItems?: WeeklyItem[];
  /** Morning = focus on writing goals (input autofocus when empty). */
  morning?: boolean;
};

type Op = { type: "status"; id: number; status: TaskStatus } | { type: "rename"; id: number; title: string } | { type: "delete"; id: number } | { type: "add"; title: string; tempId: number };

function reduce(tasks: DailyTask[], op: Op): DailyTask[] {
  switch (op.type) {
    case "status":
      return tasks.map((t) => (t.id === op.id ? { ...t, status: op.status } : t));
    case "rename":
      return tasks.map((t) => (t.id === op.id ? { ...t, title: op.title } : t));
    case "delete":
      return tasks.filter((t) => t.id !== op.id);
    case "add":
      // Temporary negative id; replaced by the real row when the server revalidates.
      return [...tasks, { id: op.tempId, memberId: 0, date: "", title: op.title, status: "todo", note: "", weeklyItemId: null, position: 1e9, createdAt: new Date(), reviewedAt: null }];
  }
}

type Result = { ok: boolean; error?: string };

export function TodayGoals({ date, tasks, carryFrom, weeklyItems = [], morning }: Props) {
  const [list, apply] = useOptimistic(tasks, reduce);
  const [pending, start] = useTransition();
  const [draft, setDraft] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  const run = (op: Op | null, fn: () => Promise<Result>, after?: () => void) =>
    start(async () => {
      if (op) apply(op);
      try {
        const r = await fn();
        if (!r.ok) toast.error(r.error ?? "실패했습니다.");
        else after?.();
      } catch {
        toast.error("요청에 실패했습니다.");
      }
    });

  const submitAdd = () => {
    const title = draft.replace(/\s+/g, " ").trim();
    if (!title) return;
    setDraft("");
    run({ type: "add", title, tempId: -Date.now() }, () => addTask(date, title));
    inputRef.current?.focus();
  };

  const weeklyTitle = new Map(weeklyItems.map((w) => [w.id, w.title]));
  const pulled = new Set(list.map((t) => t.weeklyItemId).filter((v): v is number => v != null));
  const pullable = weeklyItems.filter((w) => w.status !== "done" && !pulled.has(w.id));
  const done = list.filter((t) => t.status === "done").length;
  const doing = list.filter((t) => t.status === "in_progress").length;
  const allDone = list.length > 0 && done === list.length;

  return (
    <div className="grid gap-4">
      <form
        className="group/add relative"
        onSubmit={(e) => {
          e.preventDefault();
          submitAdd();
        }}
      >
        <PlusIcon className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-muted-foreground transition-colors group-focus-within/add:text-brand" />
        <Input
          ref={inputRef}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder={list.length === 0 ? "오늘 이룰 목표를 입력하고 Enter" : "목표 추가…"}
          maxLength={200}
          autoFocus={morning && tasks.length === 0}
          aria-label="새 목표"
          className="h-11 rounded-xl bg-muted/40 pr-12 pl-10 text-[15px] shadow-none focus-visible:bg-card"
        />
        <Button type="submit" size="icon-sm" variant="ghost" className="absolute top-1/2 right-2 -translate-y-1/2 text-muted-foreground" disabled={!draft.trim()} aria-label="추가">
          <CornerDownLeftIcon />
        </Button>
      </form>

      {(pullable.length > 0 || (carryFrom && carryFrom.count > 0)) && (
        <div className="flex flex-wrap items-center gap-1.5 text-xs">
          {carryFrom && carryFrom.count > 0 && (
            <button
              type="button"
              disabled={pending}
              onClick={() =>
                run(null, async () => {
                  const r = await carryOverTasks(carryFrom.date, date);
                  if (r.ok) toast.success(r.count ? `${r.count}개 목표를 가져왔습니다.` : "가져올 목표가 없습니다.");
                  return r;
                })
              }
              className="inline-flex items-center gap-1 rounded-full border border-dashed border-amber-300 bg-amber-50 px-2.5 py-1 font-medium text-amber-900 transition-colors hover:bg-amber-100 disabled:opacity-50"
            >
              <HistoryIcon className="size-3.5" />
              {carryFrom.label} 미완료 {carryFrom.count}개 가져오기
            </button>
          )}
          {pullable.slice(0, 6).map((w) => (
            <button
              key={w.id}
              type="button"
              disabled={pending}
              onClick={() => run(null, () => pullWeeklyItemToDay(w.id, date), () => toast.success("이번 주 항목을 오늘 목표에 추가했습니다."))}
              className="inline-flex max-w-60 items-center gap-1 rounded-full border bg-card px-2.5 py-1 text-muted-foreground transition-colors hover:border-brand/40 hover:bg-accent hover:text-accent-foreground disabled:opacity-50"
              title={`이번 주 항목 ‘${w.title}’을 오늘 목표로`}
            >
              <PlusIcon className="size-3" />
              <span className="truncate">{w.title}</span>
              {w.assignedByName && <span className="shrink-0 rounded-full bg-violet-100 px-1.5 text-[10px] text-violet-900">지정</span>}
            </button>
          ))}
          {pullable.length > 6 && <span className="text-muted-foreground">외 {pullable.length - 6}개</span>}
        </div>
      )}

      {list.length === 0 ? (
        <div className="grid place-items-center gap-1 rounded-xl border border-dashed py-8 text-center">
          <p className="text-sm font-medium">아직 오늘 목표가 없어요</p>
          <p className="text-xs text-muted-foreground">오늘 꼭 끝낼 일 3~5개를 적어 보세요. 퇴근 전에 체크만 하면 됩니다.</p>
        </div>
      ) : (
        <ul className="grid gap-1.5">
          <AnimatePresence initial={false}>
            {list.map((t) => (
              <GoalRow
                key={t.id}
                task={t}
                disabled={pending && t.id < 0}
                linked={t.weeklyItemId != null ? weeklyTitle.get(t.weeklyItemId) : undefined}
                onStatus={(status) => run({ type: "status", id: t.id, status }, () => setTaskStatus(t.id, status))}
                onRename={(title) => run({ type: "rename", id: t.id, title }, () => renameTask(t.id, title))}
                onDelete={() => run({ type: "delete", id: t.id }, () => deleteTask(t.id))}
              />
            ))}
          </AnimatePresence>
        </ul>
      )}

      {list.length > 0 && (
        <div className="grid gap-2">
          <ProgressBar value={list.length ? done / list.length : 0} />
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span className="tabular-nums">
              완료 <b className="font-semibold text-foreground">{done}</b>/{list.length}
              {doing > 0 && <> · 진행 중 {doing}</>}
            </span>
            <span className="flex items-center gap-1">
              {pending && <Loader2Icon className="size-3 animate-spin" />}
              {pending ? "저장 중" : "체크하면 자동 저장"}
            </span>
          </div>
          <AnimatePresence>
            {allDone && (
              <motion.p
                initial={{ opacity: 0, y: 6, scale: 0.98 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -4 }}
                transition={{ duration: 0.35, ease: EASE }}
                className="flex items-center gap-2 rounded-lg bg-emerald-50 px-3 py-2 text-sm font-medium text-emerald-800"
              >
                <PartyPopperIcon className="size-4" />
                오늘 목표를 모두 달성했어요. 수고하셨습니다!
              </motion.p>
            )}
          </AnimatePresence>
        </div>
      )}
    </div>
  );
}

function GoalRow({ task, disabled, linked, onStatus, onRename, onDelete }: { task: DailyTask; disabled: boolean; linked?: string; onStatus: (s: TaskStatus) => void; onRename: (t: string) => void; onDelete: () => void }) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(task.title);
  const done = task.status === "done";
  const doing = task.status === "in_progress";

  const commit = () => {
    const v = value.replace(/\s+/g, " ").trim();
    setEditing(false);
    if (v && v !== task.title) onRename(v);
    else setValue(task.title);
  };

  return (
    <motion.li
      layout
      initial={{ opacity: 0, y: -6 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, x: 24, transition: { duration: 0.2 } }}
      transition={{ duration: 0.3, ease: EASE }}
      className={cn(
        "group flex items-center gap-3 rounded-xl border bg-card px-3 py-2.5 transition-colors",
        done ? "border-transparent bg-muted/50" : doing ? "border-amber-200 bg-amber-50/40" : "hover:border-brand/30",
      )}
    >
      <motion.button
        type="button"
        whileTap={{ scale: 0.85 }}
        disabled={disabled}
        onClick={() => onStatus(done ? "todo" : "done")}
        role="checkbox"
        aria-checked={done}
        aria-label={`${task.title} ${done ? "완료 취소" : "완료"}`}
        className={cn(
          "grid size-6 shrink-0 place-items-center rounded-full border-2 transition-colors",
          done ? "border-success bg-success text-white" : doing ? "border-amber-400 text-amber-500 hover:border-success" : "border-muted-foreground/35 text-transparent hover:border-success hover:text-success/60",
        )}
      >
        <AnimatePresence initial={false} mode="wait">
          {done ? (
            <motion.span key="done" initial={{ scale: 0, rotate: -30 }} animate={{ scale: 1, rotate: 0 }} exit={{ scale: 0 }} transition={{ type: "spring", stiffness: 500, damping: 22 }}>
              <CheckIcon className="size-3.5" strokeWidth={3} />
            </motion.span>
          ) : (
            <motion.span key="todo" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              {doing ? <span className="block size-2 rounded-full bg-amber-400" /> : <CheckIcon className="size-3.5" strokeWidth={3} />}
            </motion.span>
          )}
        </AnimatePresence>
      </motion.button>

      {editing ? (
        <Input
          autoFocus
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              commit();
            } else if (e.key === "Escape") {
              setValue(task.title);
              setEditing(false);
            }
          }}
          onBlur={commit}
          maxLength={200}
          className="h-8 flex-1"
          aria-label={`${task.title} 수정`}
        />
      ) : (
        <button
          type="button"
          onClick={() => setEditing(true)}
          disabled={disabled}
          className={cn("min-w-0 flex-1 text-left text-[15px] leading-snug transition-colors", done && "text-muted-foreground line-through decoration-muted-foreground/40")}
          title="클릭해서 수정"
        >
          <span className="line-clamp-2">{task.title}</span>
          {linked && <span className="mt-0.5 block truncate text-[11px] text-sky-700">주간 · {linked}</span>}
        </button>
      )}

      {!editing && (
        <div className="flex shrink-0 items-center gap-0.5">
          {!done && (
            <button
              type="button"
              disabled={disabled}
              onClick={() => onStatus(doing ? "todo" : "in_progress")}
              aria-pressed={doing}
              className={cn(
                "inline-flex items-center gap-1 rounded-full px-2 py-1 text-xs transition-all",
                doing ? "bg-amber-100 font-medium text-amber-900" : "text-muted-foreground opacity-0 group-hover:opacity-100 hover:bg-muted focus-visible:opacity-100 max-sm:opacity-100",
              )}
              title={doing ? "진행 중 해제" : "진행 중으로 표시"}
            >
              <TimerIcon className="size-3.5" />
              <span className={cn(!doing && "max-sm:hidden")}>진행 중</span>
            </button>
          )}
          <Button type="button" size="icon-sm" variant="ghost" className="text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100 focus-visible:opacity-100 max-sm:opacity-100" aria-label={`${task.title} 삭제`} disabled={disabled} onClick={onDelete}>
            <Trash2Icon className="size-3.5" />
          </Button>
        </div>
      )}
    </motion.li>
  );
}
