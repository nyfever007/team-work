import Link from "next/link";
import { ArrowRightIcon, CrownIcon, GanttChartIcon } from "lucide-react";
import { addDays, weekStartOf } from "@/lib/dates";
import type { MyMilestone } from "@/lib/milestones/task-queries";
import { MS_TASK_LABEL } from "@/lib/milestones/task-types";
import { STATUS_STYLE } from "@/lib/milestones/types";
import { cn } from "@/lib/utils";

const WEEKS = 12;
const BACK_WEEKS = 2;
const LEFT = "minmax(140px, 220px)";

const days = (a: string, b: string) => Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / 86_400_000);

/**
 * 오늘 top: compact timeline of the milestones I own (담당) or have 작업 on — 12 weeks from two weeks ago.
 * Bars are clipped to the window; ◆ marks my 작업 due dates. Team views (/team/milestones) are unchanged.
 */
export function MyMilestones({ items, today }: { items: MyMilestone[]; today: string }) {
  if (items.length === 0) return null;
  const from = addDays(weekStartOf(today), -7 * BACK_WEEKS);
  const total = WEEKS * 7;
  const to = addDays(from, total - 1);
  const pct = (key: string) => (Math.min(Math.max(days(from, key), 0), total) / total) * 100;
  const weeks = Array.from({ length: WEEKS }, (_, i) => addDays(from, i * 7));
  const visible = items.filter((m) => m.startDate <= to && m.dueDate >= from);
  const outside = items.length - visible.length;

  return (
    <section className="grid gap-2">
      <div className="flex items-center justify-between">
        <h2 className="flex items-center gap-1.5 text-base font-bold">
          <GanttChartIcon className="size-4 text-brand" />
          참여 중인 마일스톤 <span className="text-sm font-normal text-muted-foreground">{items.length}</span>
        </h2>
        <Link href="/team/milestones" className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
          팀 타임라인 <ArrowRightIcon className="size-3" />
        </Link>
      </div>

      <div className="overflow-x-auto rounded-xl border bg-card shadow-xs">
        <div className="min-w-[680px]">
          {/* week header */}
          <div className="grid border-b bg-muted/30 text-[11px] text-muted-foreground" style={{ gridTemplateColumns: `${LEFT} 1fr` }}>
            <div className="border-r px-3 py-1.5">마일스톤</div>
            <div className="relative h-7">
              {weeks.map((w) => (
                <span key={w} className="absolute top-0 flex h-full items-center border-l pl-1 tabular-nums first:border-l-0" style={{ left: `${pct(w)}%` }}>
                  {Number(w.slice(5, 7))}/{Number(w.slice(8))}
                </span>
              ))}
            </div>
          </div>

          {visible.map((m) => {
            const start = m.startDate < from ? from : m.startDate;
            const end = m.dueDate > to ? to : m.dueDate;
            const left = pct(start);
            const width = Math.max(((days(start, end) + 1) / total) * 100, 1.2);
            const late = m.dueDate < today;
            const style = STATUS_STYLE[m.status];
            return (
              <Link key={m.id} href={`/team/milestones?m=${m.id}`} className="group grid border-b last:border-b-0 hover:bg-accent/30" style={{ gridTemplateColumns: `${LEFT} 1fr` }}>
                <div className="grid content-center gap-0.5 border-r px-3 py-2">
                  <span className="truncate text-sm font-medium group-hover:underline">{m.title}</span>
                  <span className="flex items-center gap-1 text-[11px] text-muted-foreground">
                    {m.owned ? (
                      <span className="inline-flex items-center gap-0.5 font-medium text-accent-foreground">
                        <CrownIcon className="size-3" />
                        담당
                      </span>
                    ) : (
                      "작업 참여"
                    )}
                    {m.myTotal > 0 && <span>· 내 작업 {m.myOpen > 0 ? `${m.myOpen}개 남음` : "완료"}</span>}
                  </span>
                </div>
                <div className="relative h-12">
                  {/* week grid + today */}
                  {weeks.map((w) => (
                    <span key={w} className="pointer-events-none absolute inset-y-0 border-l border-dashed border-border/60" style={{ left: `${pct(w)}%` }} />
                  ))}
                  <span className="pointer-events-none absolute inset-y-0 w-px bg-brand/70" style={{ left: `${pct(today)}%` }} />
                  {/* bar */}
                  <span
                    className={cn("absolute top-1/2 h-6 -translate-y-1/2 overflow-hidden rounded-md text-[11px] ring-1 ring-black/5", style.bar, m.startDate < from && "rounded-l-none", m.dueDate > to && "rounded-r-none", late && "ring-red-400/70")}
                    style={{ left: `${left}%`, width: `${width}%` }}
                    title={`${m.title} · ${m.startDate} ~ ${m.dueDate} · ${m.progress}%${m.total ? ` · 작업 ${m.approved}/${m.total}` : ""}`}
                  >
                    <span className={cn("absolute inset-y-0 left-0", style.fill)} style={{ width: `${m.progress}%` }} />
                    <span className="relative flex h-full items-center gap-1 truncate px-1.5 font-medium">
                      {width > 10 && <span className="tabular-nums">{m.progress}%</span>}
                      {width > 22 && m.total > 0 && <span className="opacity-70">작업 {m.approved}/{m.total}</span>}
                    </span>
                  </span>
                  {/* my task due markers */}
                  {m.myDue
                    .filter((t) => t.dueDate >= from && t.dueDate <= to)
                    .map((t, i) => (
                      <span
                        key={i}
                        className={cn(
                          "absolute bottom-0.5 size-2 -translate-x-1/2 rotate-45 ring-1 ring-card",
                          t.status === "approved" ? "bg-success" : t.dueDate < today ? "bg-red-500" : t.status === "review" ? "bg-brand/60" : "bg-brand",
                        )}
                        style={{ left: `${pct(t.dueDate) + 100 / total / 2}%` }}
                        title={`내 작업 · ${t.title} · ${t.dueDate} · ${MS_TASK_LABEL[t.status]}`}
                      />
                    ))}
                </div>
              </Link>
            );
          })}
          {visible.length === 0 && <p className="px-3 py-4 text-sm text-muted-foreground">이 기간에 보이는 마일스톤이 없습니다.</p>}
        </div>
      </div>
      <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
        <span className="inline-flex items-center gap-1"><span className="h-3 w-px bg-brand/70" />오늘</span>
        <span className="inline-flex items-center gap-1"><span className="size-2 rotate-45 bg-brand" />내 작업 기한</span>
        <span className="inline-flex items-center gap-1"><span className="size-2 rotate-45 bg-red-500" />기한 지남</span>
        <span className="inline-flex items-center gap-1"><span className="size-2 rotate-45 bg-success" />검수 완료</span>
        {outside > 0 && <span>· 기간 밖 {outside}개는 팀 타임라인에서 볼 수 있습니다</span>}
      </p>
    </section>
  );
}
