import Link from "next/link";
import { addDays, parseKey } from "@/lib/dates";
import { OVERDUE_BADGE, STATUS_LABEL, STATUS_STYLE, isOverdue, type MilestoneRow } from "@/lib/milestones/types";
import type { HolidayMap } from "@/lib/workdays";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

type Props = {
  from: string; // Monday
  weeks: number;
  today: string;
  holidays: HolidayMap;
  milestones: MilestoneRow[];
  memberName: Map<number, string>;
  hrefFor: (id: number) => string;
};

const LEFT_W = 280;

function daysBetween(a: string, b: string) {
  return Math.round((parseKey(b).getTime() - parseKey(a).getTime()) / 86_400_000);
}

export function Gantt({ from, weeks, today, holidays, milestones, memberName, hrefFor }: Props) {
  const totalDays = weeks * 7;
  const to = addDays(from, totalDays - 1);
  const pct = (d: string) => (daysBetween(from, d) / totalDays) * 100;

  const weekStarts = Array.from({ length: weeks }, (_, i) => addDays(from, i * 7));
  // month segments for the top header
  const months: { label: string; left: number; width: number }[] = [];
  for (let d = from; d <= to; ) {
    const [y, m] = d.split("-").map(Number);
    const monthEnd = `${y}-${String(m).padStart(2, "0")}-${new Date(Date.UTC(y, m, 0)).getUTCDate()}`;
    const segEnd = monthEnd < to ? monthEnd : to;
    months.push({ label: `${y}년 ${m}월`, left: pct(d), width: ((daysBetween(d, segEnd) + 1) / totalDays) * 100 });
    d = addDays(segEnd, 1);
  }
  const todayIn = today >= from && today <= to;
  const holidayDays = [...holidays.keys()].filter((d) => d >= from && d <= to);

  // group rows by team
  const groups = new Map<string, MilestoneRow[]>();
  for (const m of milestones) groups.set(m.team, [...(groups.get(m.team) ?? []), m]);

  return (
    <div className="overflow-x-auto rounded-lg border">
      <div className="min-w-[960px]">
        {/* header */}
        <div className="flex border-b bg-muted/30 text-xs text-muted-foreground">
          <div className="shrink-0 border-r px-3 py-2 font-medium" style={{ width: LEFT_W }}>
            마일스톤
          </div>
          <div className="relative flex-1">
            <div className="relative h-6 border-b">
              {months.map((m) => (
                <div key={m.label} className="absolute top-0 flex h-6 items-center border-l px-2 font-medium first:border-l-0" style={{ left: `${m.left}%`, width: `${m.width}%` }}>
                  <span className="truncate">{m.label}</span>
                </div>
              ))}
            </div>
            <div className="relative h-6">
              {weekStarts.map((w) => (
                <div key={w} className="absolute top-0 flex h-6 items-center border-l px-1.5 tabular-nums first:border-l-0" style={{ left: `${pct(w)}%`, width: `${100 / weeks}%` }}>
                  {Number(w.slice(5, 7))}/{Number(w.slice(8))}
                </div>
              ))}
            </div>
          </div>
        </div>

        {milestones.length === 0 && <p className="py-10 text-center text-sm text-muted-foreground">이 기간에 표시할 마일스톤이 없습니다.</p>}

        {[...groups.entries()].map(([team, rows]) => (
          <div key={team}>
            <div className="flex border-b bg-muted/20 text-xs font-medium">
              <div className="shrink-0 px-3 py-1.5" style={{ width: LEFT_W }}>
                {team}
              </div>
              <div className="flex-1 px-3 py-1.5 text-muted-foreground">{rows.length}개</div>
            </div>
            {rows.map((m) => {
              const style = STATUS_STYLE[m.status];
              const overdue = isOverdue(m, today);
              const clipStart = m.startDate < from ? from : m.startDate;
              const clipEnd = m.dueDate > to ? to : m.dueDate;
              const left = pct(clipStart);
              const width = ((daysBetween(clipStart, clipEnd) + 1) / totalDays) * 100;
              const owner = m.ownerId != null ? memberName.get(m.ownerId) : undefined;
              const label = `${m.title} · ${STATUS_LABEL[m.status]} ${m.progress}%`;
              return (
                <div key={m.id} className="flex border-b last:border-b-0 hover:bg-accent/40">
                  <Link href={hrefFor(m.id)} scroll={false} className="flex shrink-0 flex-col justify-center gap-0.5 border-r px-3 py-2" style={{ width: LEFT_W }}>
                    <div className="flex items-center gap-1.5">
                      <span className={cn("size-2 shrink-0 rounded-full", style.dot)} />
                      <span className="truncate text-sm font-medium">{m.title}</span>
                    </div>
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      {owner && <span className="truncate">{owner}</span>}
                      <span className="tabular-nums">
                        {m.startDate.slice(5).replace("-", "/")} ~ {m.dueDate.slice(5).replace("-", "/")}
                      </span>
                      {overdue && <Badge className={cn("h-4 px-1 text-[10px]", OVERDUE_BADGE)}>지연</Badge>}
                    </div>
                  </Link>
                  <div className="relative flex-1 py-2">
                    {/* week grid + holidays */}
                    <div className="pointer-events-none absolute inset-0" aria-hidden>
                      {weekStarts.map((w) => (
                        <div key={w} className="absolute inset-y-0 border-l border-dashed border-border/70 first:border-l-0" style={{ left: `${pct(w)}%` }} />
                      ))}
                      {weekStarts.map((w) => (
                        <div key={`we-${w}`} className="absolute inset-y-0 bg-muted/40" style={{ left: `${pct(addDays(w, 5))}%`, width: `${200 / totalDays}%` }} />
                      ))}
                      {holidayDays.map((d) => (
                        <div key={d} className="absolute inset-y-0 bg-red-50" style={{ left: `${pct(d)}%`, width: `${100 / totalDays}%` }} />
                      ))}
                    </div>
                    <Link
                      href={hrefFor(m.id)}
                      scroll={false}
                      title={label}
                      aria-label={label}
                      className={cn(
                        "absolute top-1/2 h-7 -translate-y-1/2 overflow-hidden rounded-md text-xs shadow-sm ring-1 ring-black/5 transition hover:ring-2 hover:ring-primary/40",
                        style.bar,
                        m.startDate < from && "rounded-l-none",
                        m.dueDate > to && "rounded-r-none",
                        overdue && "ring-red-400/70",
                      )}
                      style={{ left: `${left}%`, width: `max(${width}%, 6px)` }}
                    >
                      <span className={cn("absolute inset-y-0 left-0", style.fill)} style={{ width: `${m.progress}%` }} />
                      <span className="relative flex h-full items-center gap-1 truncate px-2 font-medium">
                        {width > 9 ? m.title : ""}
                        {width > 14 && <span className="opacity-70">{m.progress}%</span>}
                      </span>
                    </Link>
                  </div>
                </div>
              );
            })}
          </div>
        ))}

        {/* today line spans the body via sticky overlay */}
        {todayIn && (
          <div className="pointer-events-none relative h-0">
            <div className="absolute bottom-0 flex flex-col items-center" style={{ left: `calc(${LEFT_W}px + (100% - ${LEFT_W}px) * ${(daysBetween(from, today) + 0.5) / totalDays})`, transform: "translateX(-50%)" }}>
              <span className="mb-0.5 rounded bg-primary px-1 text-[10px] font-medium text-primary-foreground">오늘</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
