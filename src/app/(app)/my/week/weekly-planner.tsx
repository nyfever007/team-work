"use client";

import { useRef, useState, useTransition } from "react";
import Link from "next/link";
import { CheckIcon, FlagIcon, Loader2Icon, PlusIcon, SunIcon, TargetIcon, Trash2Icon } from "lucide-react";
import { toast } from "sonner";
import type { DailyTask, MonthlyGoal, WeeklyItem } from "@/lib/db/schema";
import { addWeeklyItem, deleteWeeklyItem, pullWeeklyItemToDay, renameWeeklyItem, setWeeklyItemLinks, setWeeklyItemStatus } from "@/lib/plans/actions";
import type { TaskStatus } from "@/lib/tasks/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { StatusToggle } from "@/components/plans/status-toggle";
import { cn } from "@/lib/utils";

export type MilestoneOption = { id: number; title: string; team: string };

type Props = {
  weekStart: string;
  today: string;
  isThisWeek: boolean;
  items: WeeklyItem[];
  linkedTasks: DailyTask[]; // daily tasks pointing at these items
  milestones: MilestoneOption[];
  goals: Pick<MonthlyGoal, "id" | "title">[];
};

export function WeeklyPlanner({ weekStart, today, isThisWeek, items, linkedTasks, milestones, goals }: Props) {
  const [pending, start] = useTransition();
  const [draft, setDraft] = useState("");
  const [draftMs, setDraftMs] = useState("");
  const [draftGoal, setDraftGoal] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const msTitle = new Map(milestones.map((m) => [m.id, m.title]));
  const goalTitle = new Map(goals.map((g) => [g.id, g.title]));
  const tasksByItem = new Map<number, DailyTask[]>();
  for (const t of linkedTasks) if (t.weeklyItemId != null) tasksByItem.set(t.weeklyItemId, [...(tasksByItem.get(t.weeklyItemId) ?? []), t]);

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

  const submit = () => {
    const title = draft.trim();
    if (!title) return;
    run(() => addWeeklyItem(weekStart, title, { milestoneId: draftMs ? Number(draftMs) : null, monthlyGoalId: draftGoal ? Number(draftGoal) : null }), () => {
      setDraft("");
      inputRef.current?.focus();
    });
  };

  const done = items.filter((i) => i.status === "done").length;

  return (
    <div className="grid gap-3">
      {items.length > 0 && (
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>
            완료 <span className="font-medium text-foreground tabular-nums">{done}</span>/{items.length}
          </span>
          <span>{pending ? "저장 중…" : "변경 시 자동 저장"}</span>
        </div>
      )}
      <ol className="grid gap-1.5">
        {items.length === 0 && <li className="py-2 text-sm text-muted-foreground">이번 주 할 일이 없습니다. 아래에 하나씩 추가하세요. 월간 목표나 팀 마일스톤에 연결할 수 있습니다.</li>}
        {items.map((it) => (
          <ItemRow
            key={it.id}
            item={it}
            tasks={tasksByItem.get(it.id) ?? []}
            msTitle={it.milestoneId != null ? msTitle.get(it.milestoneId) : undefined}
            goalTitle={it.monthlyGoalId != null ? goalTitle.get(it.monthlyGoalId) : undefined}
            milestones={milestones}
            goals={goals}
            disabled={pending}
            canPull={isThisWeek && !(tasksByItem.get(it.id) ?? []).some((t) => t.date === today)}
            onStatus={(s) => run(() => setWeeklyItemStatus(it.id, s))}
            onRename={(t) => run(() => renameWeeklyItem(it.id, t))}
            onDelete={() => run(() => deleteWeeklyItem(it.id))}
            onLinks={(l) => run(() => setWeeklyItemLinks(it.id, l))}
            onPull={() => run(() => pullWeeklyItemToDay(it.id, today), () => toast.success("오늘 할 일에 추가했습니다."))}
          />
        ))}
      </ol>

      <form
        className="grid gap-2 rounded-md border border-dashed p-2"
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
      >
        <div className="flex gap-2">
          <Input ref={inputRef} value={draft} onChange={(e) => setDraft(e.target.value)} placeholder="이번 주에 끝낼 일을 입력하고 Enter" maxLength={200} disabled={pending} aria-label="새 주간 항목" />
          <Button type="submit" size="sm" disabled={pending || !draft.trim()}>
            {pending ? <Loader2Icon className="size-4 animate-spin" /> : <PlusIcon className="size-4" />}
            추가
          </Button>
        </div>
        <div className="flex flex-wrap gap-2 text-xs">
          <NativeSelect size="sm" value={draftGoal} onChange={(e) => setDraftGoal(e.target.value)} aria-label="월간 목표 연결">
            <NativeSelectOption value="">월간 목표 연결 안 함</NativeSelectOption>
            {goals.map((g) => (
              <NativeSelectOption key={g.id} value={g.id}>
                목표: {g.title}
              </NativeSelectOption>
            ))}
          </NativeSelect>
          <NativeSelect size="sm" value={draftMs} onChange={(e) => setDraftMs(e.target.value)} aria-label="마일스톤 연결">
            <NativeSelectOption value="">마일스톤 연결 안 함</NativeSelectOption>
            {milestones.map((m) => (
              <NativeSelectOption key={m.id} value={m.id}>
                {m.team} · {m.title}
              </NativeSelectOption>
            ))}
          </NativeSelect>
        </div>
      </form>
    </div>
  );
}

function ItemRow(props: {
  item: WeeklyItem;
  tasks: DailyTask[];
  msTitle?: string;
  goalTitle?: string;
  milestones: MilestoneOption[];
  goals: Pick<MonthlyGoal, "id" | "title">[];
  disabled: boolean;
  canPull: boolean;
  onStatus: (s: TaskStatus) => void;
  onRename: (t: string) => void;
  onDelete: () => void;
  onLinks: (l: { milestoneId: number | null; monthlyGoalId: number | null }) => void;
  onPull: () => void;
}) {
  const { item, tasks, msTitle, goalTitle, milestones, goals, disabled, canPull, onStatus, onRename, onDelete, onLinks, onPull } = props;
  const [editing, setEditing] = useState(false);
  const [linking, setLinking] = useState(false);
  const [value, setValue] = useState(item.title);
  const doneTasks = tasks.filter((t) => t.status === "done").length;

  const commit = () => {
    const v = value.trim();
    setEditing(false);
    if (v && v !== item.title) onRename(v);
    else setValue(item.title);
  };

  return (
    <li className="group grid gap-1.5 rounded-md border px-2.5 py-2">
      <div className="flex flex-wrap items-center gap-2">
        {editing ? (
          <form className="flex flex-1 items-center gap-1" onSubmit={(e) => { e.preventDefault(); commit(); }}>
            <Input autoFocus value={value} onChange={(e) => setValue(e.target.value)} onBlur={commit} onKeyDown={(e) => { if (e.key === "Escape") { setValue(item.title); setEditing(false); } }} maxLength={200} className="h-8" aria-label={`${item.title} 수정`} />
            <Button type="submit" size="icon" variant="ghost" className="size-8" aria-label="저장"><CheckIcon className="size-4" /></Button>
          </form>
        ) : (
          <button type="button" onClick={() => !item.assignedBy && setEditing(true)} disabled={disabled} className={cn("flex-1 truncate text-left text-sm", item.status === "done" && "text-muted-foreground line-through", item.assignedBy && "cursor-default")} title={item.assignedBy ? "팀장이 지정한 항목은 상태만 바꿀 수 있습니다" : "클릭해서 수정"}>
            {item.title}
          </button>
        )}
        {item.assignedByName && <span className="rounded bg-violet-100 px-1.5 py-0.5 text-[11px] font-medium text-violet-900">{item.assignedByName} 지정</span>}
        <StatusToggle value={item.status} onChange={onStatus} disabled={disabled} label={item.title} />
        <div className="flex items-center gap-0.5 opacity-70 transition-opacity group-hover:opacity-100">
          {canPull && (
            <Button type="button" size="sm" variant="ghost" className="h-7 px-2 text-xs" disabled={disabled} onClick={onPull} title="오늘 할 일에 추가">
              <SunIcon className="size-3.5" />
              오늘로
            </Button>
          )}
          <Button type="button" size="icon" variant="ghost" className="size-7" aria-label={`${item.title} 연결`} disabled={disabled} onClick={() => setLinking((v) => !v)} title="연결 편집">
            <TargetIcon className="size-3.5" />
          </Button>
          {!item.assignedBy && (
            <Button type="button" size="icon" variant="ghost" className="size-7" aria-label={`${item.title} 삭제`} disabled={disabled} onClick={onDelete}>
              <Trash2Icon className="size-3.5" />
            </Button>
          )}
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-1.5 text-[11px] text-muted-foreground">
        {goalTitle && <span className="inline-flex items-center gap-1 rounded bg-sky-50 px-1.5 py-0.5 text-sky-900"><TargetIcon className="size-3" />목표 · {goalTitle}</span>}
        {msTitle && item.milestoneId != null && (
          <Link href={`/team/milestones?m=${item.milestoneId}`} className="inline-flex items-center gap-1 rounded bg-blue-50 px-1.5 py-0.5 text-blue-900 hover:underline"><FlagIcon className="size-3" />마일스톤 · {msTitle}</Link>
        )}
        {tasks.length > 0 && <span className="tabular-nums">일간 항목 {doneTasks}/{tasks.length} 완료</span>}
        {!goalTitle && !msTitle && tasks.length === 0 && <span>연결 없음</span>}
      </div>
      {linking && (
        <div className="flex flex-wrap gap-2 rounded-md bg-muted/40 p-2 text-xs">
          <NativeSelect size="sm" value={item.monthlyGoalId ?? ""} disabled={disabled} onChange={(e) => onLinks({ milestoneId: item.milestoneId, monthlyGoalId: e.target.value ? Number(e.target.value) : null })} aria-label={`${item.title} 월간 목표`}>
            <NativeSelectOption value="">월간 목표 없음</NativeSelectOption>
            {goals.map((g) => (<NativeSelectOption key={g.id} value={g.id}>{g.title}</NativeSelectOption>))}
          </NativeSelect>
          <NativeSelect size="sm" value={item.milestoneId ?? ""} disabled={disabled} onChange={(e) => onLinks({ monthlyGoalId: item.monthlyGoalId, milestoneId: e.target.value ? Number(e.target.value) : null })} aria-label={`${item.title} 마일스톤`}>
            <NativeSelectOption value="">마일스톤 없음</NativeSelectOption>
            {milestones.map((m) => (<NativeSelectOption key={m.id} value={m.id}>{m.team} · {m.title}</NativeSelectOption>))}
          </NativeSelect>
        </div>
      )}
    </li>
  );
}
