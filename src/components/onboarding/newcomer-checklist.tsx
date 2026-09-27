"use client";

import { useOptimistic, useTransition } from "react";
import Link from "next/link";
import { CheckIcon, FileTextIcon } from "lucide-react";
import { toast } from "sonner";
import { toggleOnboardingCheck } from "@/lib/onboarding/actions";
import { ProgressBar, ProgressRing } from "@/components/motion";
import { cn } from "@/lib/utils";
import type { ChecklistItem } from "./checklist-manager";

/** Newcomer's own checklist: toggles + progress. `checks` maps itemId → check date (YYYY-MM-DD). */
export function NewcomerChecklist({ items, checks, today }: { items: ChecklistItem[]; checks: Record<number, string>; today: string }) {
  const [pending, start] = useTransition();
  const [optimistic, apply] = useOptimistic(checks, (state, { id, checked }: { id: number; checked: boolean }) => {
    const next = { ...state };
    if (checked) next[id] = today;
    else delete next[id];
    return next;
  });
  const done = items.filter((it) => optimistic[it.id]).length;
  const total = items.length;
  const ratio = total ? done / total : 0;

  const toggle = (id: number, checked: boolean) =>
    start(async () => {
      apply({ id, checked });
      try {
        const r = await toggleOnboardingCheck(id, checked);
        if (!r.ok) toast.error(r.error);
      } catch {
        toast.error("요청에 실패했습니다.");
      }
    });

  if (total === 0) return <p className="text-sm text-muted-foreground">등록된 온보딩 항목이 없습니다.</p>;

  return (
    <div className="grid gap-4">
      <div className="flex items-center gap-4">
        <ProgressRing value={ratio} size={64} stroke={6}>
          <span className="text-sm font-bold tabular-nums">{Math.round(ratio * 100)}%</span>
        </ProgressRing>
        <div className="grid flex-1 gap-1.5">
          <span className="text-sm font-semibold tabular-nums">
            {done} / {total} 완료
          </span>
          <ProgressBar value={ratio} />
        </div>
      </div>
      <ol className="grid gap-2">
        {items.map((it) => {
          const at = optimistic[it.id];
          return (
            <li key={it.id} className={cn("flex items-start gap-3 rounded-lg border px-3 py-2.5 transition-colors", at && "bg-muted/40")}>
              <button
                type="button"
                role="checkbox"
                aria-checked={!!at}
                aria-label={it.title}
                disabled={pending}
                onClick={() => toggle(it.id, !at)}
                className={cn("mt-0.5 grid size-5 shrink-0 place-items-center rounded-md border transition-colors", at ? "border-success bg-success text-white" : "bg-card hover:border-brand")}
              >
                {at && <CheckIcon className="size-3.5" />}
              </button>
              <div className="grid min-w-0 flex-1 gap-1">
                <span className={cn("text-sm font-medium", at && "text-muted-foreground line-through decoration-muted-foreground/40")}>{it.title}</span>
                {it.description && <p className="text-xs whitespace-pre-wrap text-muted-foreground">{it.description}</p>}
                {it.postId != null && (
                  <Link href={`/lounge/${it.postId}`} className="inline-flex w-fit items-center gap-1 text-xs text-accent-foreground hover:underline">
                    <FileTextIcon className="size-3" />
                    {it.postTitle}
                  </Link>
                )}
              </div>
              {at && <span className="shrink-0 text-xs text-emerald-700 tabular-nums">{at.slice(5).replace("-", "/")} 완료</span>}
            </li>
          );
        })}
      </ol>
    </div>
  );
}
