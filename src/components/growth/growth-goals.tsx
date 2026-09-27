"use client";

import { useState, useTransition } from "react";
import { DownloadIcon, MessageSquareQuoteIcon, PencilIcon, PlusIcon, Trash2Icon } from "lucide-react";
import { toast } from "sonner";
import { addGrowthGoal, deleteGrowthGoal, importUnfinishedGrowthGoals, saveGrowthReflection, setGrowthGoalStatus, updateGrowthGoal, type GrowthGoalInput } from "@/lib/growth/actions";
import { GROWTH_MAX_PER_QUARTER, GROWTH_STATUSES, GROWTH_STATUS_CLASS, GROWTH_STATUS_LABEL, GROWTH_TEXT_MAX, GROWTH_TITLE_MAX, type GrowthStatus } from "@/lib/growth/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

export type GoalView = { id: number; title: string; plan: string; status: GrowthStatus; reflection: string; leaderComment: string; leaderName: string | null };
type Result = { ok: true; message: string } | { ok: false; error: string };

/** Member's own goals for one quarter. `canImport` = the previous quarter has unfinished goals. */
export function GrowthGoals({ quarter, goals, canImport }: { quarter: string; goals: GoalView[]; canImport: boolean }) {
  const [pending, start] = useTransition();
  const [editing, setEditing] = useState<number | null>(null);
  const [adding, setAdding] = useState(false);
  const full = goals.length >= GROWTH_MAX_PER_QUARTER;

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
      {goals.length === 0 && !adding && <p className="text-sm text-muted-foreground">이 분기의 성장 목표가 없습니다.</p>}
      {goals.map((g, i) => (
        <article key={g.id} className="grid gap-3 rounded-xl border bg-card p-4 shadow-xs">
          {editing === g.id ? (
            <GoalEditor initial={g} pending={pending} submitLabel="저장" onCancel={() => setEditing(null)} onSubmit={(v) => run(() => updateGrowthGoal(g.id, v), () => setEditing(null))} />
          ) : (
            <>
              <header className="flex flex-wrap items-start gap-2">
                <span className="mt-0.5 grid size-6 shrink-0 place-items-center rounded-full bg-brand-soft text-xs font-semibold text-accent-foreground tabular-nums">{i + 1}</span>
                <h3 className={cn("min-w-0 flex-1 font-semibold", g.status === "dropped" && "text-muted-foreground line-through")}>{g.title}</h3>
                <NativeSelect
                  size="sm"
                  aria-label="상태"
                  value={g.status}
                  disabled={pending}
                  className={cn("rounded-lg font-semibold", GROWTH_STATUS_CLASS[g.status])}
                  onChange={(e) => run(() => setGrowthGoalStatus(g.id, e.target.value as GrowthStatus))}
                >
                  {GROWTH_STATUSES.map((s) => (
                    <NativeSelectOption key={s} value={s}>
                      {GROWTH_STATUS_LABEL[s]}
                    </NativeSelectOption>
                  ))}
                </NativeSelect>
                <span className="flex gap-0.5">
                  <Button size="icon-xs" variant="ghost" aria-label={`${g.title} 수정`} disabled={pending} onClick={() => setEditing(g.id)}>
                    <PencilIcon />
                  </Button>
                  <Button
                    size="icon-xs"
                    variant="ghost"
                    aria-label={`${g.title} 삭제`}
                    disabled={pending}
                    onClick={() => {
                      if (confirm(`"${g.title}" 목표를 삭제할까요?`)) run(() => deleteGrowthGoal(g.id));
                    }}
                  >
                    <Trash2Icon />
                  </Button>
                </span>
              </header>
              {g.plan && (
                <div className="grid gap-1">
                  <span className="text-xs font-medium text-muted-foreground">실행 계획</span>
                  <p className="text-sm whitespace-pre-wrap">{g.plan}</p>
                </div>
              )}
              <Reflection key={g.reflection} goalId={g.id} initial={g.reflection} pending={pending} onSave={(id, text) => run(() => saveGrowthReflection(id, text))} />
              {g.leaderComment && (
                <p className="flex gap-1.5 rounded-lg bg-brand-soft/60 px-3 py-2 text-sm">
                  <MessageSquareQuoteIcon className="mt-0.5 size-4 shrink-0 text-brand" />
                  <span className="grid gap-0.5">
                    <span className="whitespace-pre-wrap">{g.leaderComment}</span>
                    {g.leaderName && <span className="text-xs text-muted-foreground">{g.leaderName}</span>}
                  </span>
                </p>
              )}
            </>
          )}
        </article>
      ))}

      {adding ? (
        <div className="rounded-xl border border-dashed p-4">
          <GoalEditor pending={pending} submitLabel="추가" onCancel={() => setAdding(false)} onSubmit={(v) => run(() => addGrowthGoal(quarter, v), () => setAdding(false))} />
        </div>
      ) : (
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" size="sm" disabled={full || pending} onClick={() => setAdding(true)}>
            <PlusIcon />
            목표 추가
          </Button>
          {canImport && !full && (
            <Button variant="ghost" size="sm" disabled={pending} onClick={() => run(() => importUnfinishedGrowthGoals(quarter))}>
              <DownloadIcon />
              지난 분기에서 가져오기
            </Button>
          )}
          <span className="text-xs text-muted-foreground tabular-nums">
            {goals.length}/{GROWTH_MAX_PER_QUARTER}
          </span>
        </div>
      )}
    </div>
  );
}

function Reflection({ goalId, initial, pending, onSave }: { goalId: number; initial: string; pending: boolean; onSave: (id: number, text: string) => void }) {
  const [text, setText] = useState(initial);
  const dirty = text.trim() !== initial;
  return (
    <div className="grid gap-1.5">
      <label htmlFor={`reflection-${goalId}`} className="text-xs font-medium text-muted-foreground">
        회고 · 결과
      </label>
      <Textarea id={`reflection-${goalId}`} value={text} onChange={(e) => setText(e.target.value)} maxLength={GROWTH_TEXT_MAX} rows={2} placeholder="무엇을 했고 무엇을 배웠는지" />
      {dirty && (
        <div className="flex justify-end gap-1.5">
          <Button size="xs" variant="ghost" disabled={pending} onClick={() => setText(initial)}>
            취소
          </Button>
          <Button size="xs" disabled={pending} onClick={() => onSave(goalId, text)}>
            저장
          </Button>
        </div>
      )}
    </div>
  );
}

function GoalEditor({ initial, pending, submitLabel, onCancel, onSubmit }: { initial?: GoalView; pending: boolean; submitLabel: string; onCancel: () => void; onSubmit: (v: GrowthGoalInput) => void }) {
  const [title, setTitle] = useState(initial?.title ?? "");
  const [plan, setPlan] = useState(initial?.plan ?? "");
  return (
    <form
      className="grid gap-2"
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit({ title, plan });
      }}
    >
      <Input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={GROWTH_TITLE_MAX} placeholder="성장 목표" aria-label="성장 목표" autoFocus />
      <Textarea value={plan} onChange={(e) => setPlan(e.target.value)} maxLength={GROWTH_TEXT_MAX} rows={3} placeholder="실행 계획 (방법, 자료, 일정)" aria-label="실행 계획" />
      <div className="flex justify-end gap-1.5">
        <Button type="button" size="sm" variant="ghost" onClick={onCancel} disabled={pending}>
          취소
        </Button>
        <Button type="submit" size="sm" disabled={pending || !title.trim()}>
          {submitLabel}
        </Button>
      </div>
    </form>
  );
}
