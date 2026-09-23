"use client";

import { useRef, useState, useTransition } from "react";
import Link from "next/link";
import { CheckIcon, FlagIcon, Loader2Icon, PlusIcon, Trash2Icon } from "lucide-react";
import { toast } from "sonner";
import type { MonthlyGoal, WeeklyItem } from "@/lib/db/schema";
import { addMonthlyGoal, deleteMonthlyGoal, renameMonthlyGoal, setMonthlyGoalMilestone, setMonthlyGoalStatus } from "@/lib/plans/actions";
import type { TaskStatus } from "@/lib/tasks/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { StatusToggle } from "@/components/plans/status-toggle";
import { cn } from "@/lib/utils";
import type { MilestoneOption } from "../week/weekly-planner";

type Props = { month: string; goals: MonthlyGoal[]; weeklyItems: WeeklyItem[]; milestones: MilestoneOption[] };

export function MonthlyGoals({ month, goals, weeklyItems, milestones }: Props) {
  const [pending, start] = useTransition();
  const [draft, setDraft] = useState("");
  const [draftMs, setDraftMs] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const msTitle = new Map(milestones.map((m) => [m.id, m.title]));
  const itemsByGoal = new Map<number, WeeklyItem[]>();
  for (const w of weeklyItems) if (w.monthlyGoalId != null) itemsByGoal.set(w.monthlyGoalId, [...(itemsByGoal.get(w.monthlyGoalId) ?? []), w]);

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
    run(() => addMonthlyGoal(month, title, draftMs ? Number(draftMs) : null), () => {
      setDraft("");
      inputRef.current?.focus();
    });
  };

  return (
    <div className="grid gap-3">
      <ol className="grid gap-1.5">
        {goals.length === 0 && <li className="py-2 text-sm text-muted-foreground">이달 목표가 없습니다. 이달에 이루고 싶은 것을 2~4개 정도 적고, 주간 항목을 여기에 연결하세요.</li>}
        {goals.map((g) => (
          <GoalRow key={g.id} goal={g} items={itemsByGoal.get(g.id) ?? []} msTitle={g.milestoneId != null ? msTitle.get(g.milestoneId) : undefined} milestones={milestones} disabled={pending} onStatus={(s) => run(() => setMonthlyGoalStatus(g.id, s))} onRename={(t) => run(() => renameMonthlyGoal(g.id, t))} onDelete={() => run(() => deleteMonthlyGoal(g.id))} onMilestone={(id) => run(() => setMonthlyGoalMilestone(g.id, id))} />
        ))}
      </ol>
      <form className="grid gap-2 rounded-md border border-dashed p-2" onSubmit={(e) => { e.preventDefault(); submit(); }}>
        <div className="flex gap-2">
          <Input ref={inputRef} value={draft} onChange={(e) => setDraft(e.target.value)} placeholder="이달 목표를 입력하고 Enter" maxLength={200} disabled={pending} aria-label="새 월간 목표" />
          <Button type="submit" size="sm" disabled={pending || !draft.trim()}>
            {pending ? <Loader2Icon className="size-4 animate-spin" /> : <PlusIcon className="size-4" />}
            추가
          </Button>
        </div>
        <NativeSelect size="sm" value={draftMs} onChange={(e) => setDraftMs(e.target.value)} aria-label="마일스톤 연결" className="w-fit">
          <NativeSelectOption value="">마일스톤 연결 안 함</NativeSelectOption>
          {milestones.map((m) => (<NativeSelectOption key={m.id} value={m.id}>{m.team} · {m.title}</NativeSelectOption>))}
        </NativeSelect>
      </form>
    </div>
  );
}

function GoalRow({ goal, items, msTitle, milestones, disabled, onStatus, onRename, onDelete, onMilestone }: { goal: MonthlyGoal; items: WeeklyItem[]; msTitle?: string; milestones: MilestoneOption[]; disabled: boolean; onStatus: (s: TaskStatus) => void; onRename: (t: string) => void; onDelete: () => void; onMilestone: (id: number | null) => void }) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(goal.title);
  const done = items.filter((i) => i.status === "done").length;
  const pct = items.length ? Math.round((done / items.length) * 100) : null;
  const commit = () => { const v = value.trim(); setEditing(false); if (v && v !== goal.title) onRename(v); else setValue(goal.title); };
  return (
    <li className="group grid gap-1.5 rounded-md border px-2.5 py-2">
      <div className="flex flex-wrap items-center gap-2">
        {editing ? (
          <form className="flex flex-1 items-center gap-1" onSubmit={(e) => { e.preventDefault(); commit(); }}>
            <Input autoFocus value={value} onChange={(e) => setValue(e.target.value)} onBlur={commit} onKeyDown={(e) => { if (e.key === "Escape") { setValue(goal.title); setEditing(false); } }} maxLength={200} className="h-8" aria-label={`${goal.title} 수정`} />
            <Button type="submit" size="icon" variant="ghost" className="size-8" aria-label="저장"><CheckIcon className="size-4" /></Button>
          </form>
        ) : (
          <button type="button" onClick={() => setEditing(true)} disabled={disabled} className={cn("flex-1 truncate text-left text-sm font-medium", goal.status === "done" && "text-muted-foreground line-through")} title="클릭해서 수정">{goal.title}</button>
        )}
        <StatusToggle value={goal.status} onChange={onStatus} disabled={disabled} label={goal.title} />
        <Button type="button" size="icon" variant="ghost" className="size-7 opacity-0 group-hover:opacity-100 focus:opacity-100" aria-label={`${goal.title} 삭제`} disabled={disabled} onClick={onDelete}><Trash2Icon className="size-3.5" /></Button>
      </div>
      <div className="flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
        <NativeSelect size="sm" value={goal.milestoneId ?? ""} disabled={disabled} onChange={(e) => onMilestone(e.target.value ? Number(e.target.value) : null)} aria-label={`${goal.title} 마일스톤`}>
          <NativeSelectOption value="">마일스톤 없음</NativeSelectOption>
          {milestones.map((m) => (<NativeSelectOption key={m.id} value={m.id}>{m.team} · {m.title}</NativeSelectOption>))}
        </NativeSelect>
        {msTitle && goal.milestoneId != null && <Link href={`/team/milestones?m=${goal.milestoneId}`} className="inline-flex items-center gap-1 text-blue-900 hover:underline"><FlagIcon className="size-3" />{msTitle}</Link>}
        {pct !== null ? (
          <span className="ml-auto flex items-center gap-2 tabular-nums">주간 항목 {done}/{items.length}<span className="inline-block h-1.5 w-24 overflow-hidden rounded-full bg-muted"><span className="block h-full rounded-full bg-emerald-500" style={{ width: `${pct}%` }} /></span></span>
        ) : (
          <span className="ml-auto">연결된 주간 항목 없음</span>
        )}
      </div>
      {items.length > 0 && (
        <ul className="grid gap-0.5 pl-1 text-xs">
          {items.map((i) => (<li key={i.id} className={cn("truncate", i.status === "done" && "text-muted-foreground line-through")}>· {i.weekStart.slice(5).replace("-", "/")}주 — {i.title}</li>))}
        </ul>
      )}
    </li>
  );
}
