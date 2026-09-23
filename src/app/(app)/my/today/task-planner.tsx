"use client";

import { useRef, useState, useTransition } from "react";
import { CheckIcon, Loader2Icon, PlusIcon, Trash2Icon, XIcon } from "lucide-react";
import { toast } from "sonner";
import type { DailyTask, WeeklyItem } from "@/lib/db/schema";
import { pullWeeklyItemToDay } from "@/lib/plans/actions";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { addTask, carryOverTasks, deleteTask, renameTask } from "@/lib/tasks/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

type Props = {
  date: string;
  tasks: DailyTask[];
  /** Previous working day with unfinished items, if any. */
  carryFrom?: { date: string; label: string; count: number } | null;
  /** This week's items (for "이번 주 항목에서 가져오기" and linked chips). */
  weeklyItems?: WeeklyItem[];
};

export function TaskPlanner({ date, tasks, carryFrom, weeklyItems = [] }: Props) {
  const [pending, start] = useTransition();
  const [draft, setDraft] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  const run = (fn: () => Promise<{ ok: boolean; error?: string }>, after?: () => void) =>
    start(async () => {
      try {
        const r = await fn();
        if (!r.ok) toast.error(r.error ?? "실패했습니다.");
        else after?.();
      } catch {
        toast.error("요청에 실패했습니다.");
      }
    });

  const weeklyTitle = new Map(weeklyItems.map((w) => [w.id, w.title]));
  const pulled = new Set(tasks.map((t) => t.weeklyItemId).filter((v): v is number => v != null));
  const pullable = weeklyItems.filter((w) => w.status !== "done" && !pulled.has(w.id));

  const submitAdd = () => {
    const title = draft.trim();
    if (!title) return;
    run(() => addTask(date, title), () => {
      setDraft("");
      inputRef.current?.focus();
    });
  };

  return (
    <div className="grid gap-3">
      <ol className="grid gap-1">
        {tasks.length === 0 && <li className="py-2 text-sm text-muted-foreground">아직 할 일이 없습니다. 아래에 하나씩 추가하세요.</li>}
        {tasks.map((t, i) => (
          <TaskRow key={t.id} task={t} index={i + 1} disabled={pending} linked={t.weeklyItemId != null ? weeklyTitle.get(t.weeklyItemId) : undefined} onRename={(title) => run(() => renameTask(t.id, title))} onDelete={() => run(() => deleteTask(t.id))} />
        ))}
      </ol>

      <form
        className="flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          submitAdd();
        }}
      >
        <Input ref={inputRef} value={draft} onChange={(e) => setDraft(e.target.value)} placeholder="할 일을 입력하고 Enter" maxLength={200} disabled={pending} aria-label="새 할 일" />
        <Button type="submit" size="sm" disabled={pending || !draft.trim()}>
          {pending ? <Loader2Icon className="size-4 animate-spin" /> : <PlusIcon className="size-4" />}
          추가
        </Button>
      </form>

      {pullable.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <NativeSelect
            size="sm"
            value=""
            disabled={pending}
            aria-label="이번 주 항목에서 가져오기"
            onChange={(e) => {
              const id = Number(e.target.value);
              if (id) run(() => pullWeeklyItemToDay(id, date), () => toast.success("이번 주 항목을 오늘 할 일에 추가했습니다."));
            }}
          >
            <NativeSelectOption value="">이번 주 항목에서 가져오기 ({pullable.length})</NativeSelectOption>
            {pullable.map((w) => (
              <NativeSelectOption key={w.id} value={w.id}>
                {w.title}
              </NativeSelectOption>
            ))}
          </NativeSelect>
        </div>
      )}
      <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
        <span>{tasks.length}개 항목</span>
        {carryFrom && carryFrom.count > 0 && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-7 px-2 text-xs"
            disabled={pending}
            onClick={() =>
              run(
                async () => {
                  const r = await carryOverTasks(carryFrom.date, date);
                  if (r.ok) toast.success(r.count ? `${r.count}개 항목을 가져왔습니다.` : "가져올 항목이 없습니다.");
                  return r;
                },
              )
            }
          >
            {carryFrom.label} 미완료 {carryFrom.count}개 가져오기
          </Button>
        )}
      </div>
    </div>
  );
}

function TaskRow({ task, index, disabled, linked, onRename, onDelete }: { task: DailyTask; index: number; disabled: boolean; linked?: string; onRename: (t: string) => void; onDelete: () => void }) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(task.title);

  const commit = () => {
    const v = value.trim();
    setEditing(false);
    if (v && v !== task.title) onRename(v);
    else setValue(task.title);
  };

  return (
    <li className="group flex items-center gap-2 rounded-md px-1 py-1 hover:bg-muted/50">
      <span className="w-5 shrink-0 text-right text-xs tabular-nums text-muted-foreground">{index}.</span>
      {editing ? (
        <form
          className="flex flex-1 items-center gap-1"
          onSubmit={(e) => {
            e.preventDefault();
            commit();
          }}
        >
          <Input
            autoFocus
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Escape") {
                setValue(task.title);
                setEditing(false);
              }
            }}
            onBlur={commit}
            maxLength={200}
            className="h-8"
            aria-label={`${task.title} 수정`}
          />
          <Button type="submit" size="icon" variant="ghost" className="size-8" aria-label="저장">
            <CheckIcon className="size-4" />
          </Button>
        </form>
      ) : (
        <>
          <button type="button" onClick={() => setEditing(true)} disabled={disabled} className={cn("flex-1 truncate text-left text-sm", task.status === "done" && "text-muted-foreground line-through")} title="클릭해서 수정">
            {task.title}
          </button>
          {linked && <span className="hidden max-w-40 truncate rounded bg-sky-50 px-1.5 py-0.5 text-[11px] text-sky-900 sm:inline" title={`이번 주 항목: ${linked}`}>주간 · {linked}</span>}
          <Button type="button" size="icon" variant="ghost" className="size-7 opacity-0 transition-opacity group-hover:opacity-100 focus:opacity-100" aria-label={`${task.title} 삭제`} disabled={disabled} onClick={onDelete}>
            <Trash2Icon className="size-3.5" />
          </Button>
        </>
      )}
      {editing && (
        <Button type="button" size="icon" variant="ghost" className="size-8" aria-label="취소" onMouseDown={(e) => e.preventDefault()} onClick={() => { setValue(task.title); setEditing(false); }}>
          <XIcon className="size-4" />
        </Button>
      )}
    </li>
  );
}
