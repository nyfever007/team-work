import Link from "next/link";
import { WEEKDAY_KO, dayOfWeek, monthGrid, monthOf, parseKey } from "@/lib/dates";
import { APPROVAL_LABEL, OVERDUE_BADGE, STATUS_LABEL, STATUS_STYLE, isOverdue, type MilestoneRow } from "@/lib/milestones/types";
import type { HolidayMap } from "@/lib/workdays";
import { packLanes, type TimelineItem } from "@/components/week-timeline";
import { cn } from "@/lib/utils";

type Props = {
  month: string;
  today: string;
  holidays: HolidayMap;
  milestones: MilestoneRow[];
  hrefFor: (id: number) => string;
};

/** Month grid with milestone bars spanning their days (clipped per week row), coloured by status. */
export function MilestoneCalendar({ month, today, holidays, milestones, hrefFor }: Props) {
  const grid = monthGrid(month);
  return (
    <div className="overflow-hidden rounded-lg border bg-background">
      <div className="grid grid-cols-7 border-b bg-muted/40 text-center text-xs font-medium text-muted-foreground">
        {WEEKDAY_KO.map((d, i) => (
          <div key={d} className={cn("py-2", i === 0 && "text-red-600", i === 6 && "text-blue-600")}>{d}</div>
        ))}
      </div>
      {grid.map((week, wi) => {
        const ws = week[0];
        const we = week[6];
        const items: TimelineItem[] = milestones
          .filter((m) => m.startDate <= we && m.dueDate >= ws)
          .map((m) => {
            const overdue = isOverdue(m, today);
            const proposal = m.approval !== "approved";
            return {
              key: `ms:${m.id}:${ws}`,
              start: m.startDate < ws ? ws : m.startDate,
              end: m.dueDate > we ? we : m.dueDate,
              label: `${proposal ? `[${APPROVAL_LABEL[m.approval]}] ` : ""}${m.title}${proposal ? "" : ` ${m.progress}%`}${m.dueDate >= ws && m.dueDate <= we ? " ◆" : ""}`,
              title: `${m.team} · ${m.title} · ${proposal ? APPROVAL_LABEL[m.approval] : `${STATUS_LABEL[m.status]} ${m.progress}%`} · ${m.startDate} ~ ${m.dueDate}${overdue && !proposal ? " · 지연" : ""}`,
              color: {
                bar: proposal
                  ? cn("border border-dashed bg-card shadow-none", m.approval === "pending" ? "border-brand/50 text-accent-foreground" : "border-red-300 text-red-800 opacity-70")
                  : cn(STATUS_STYLE[m.status].bar, overdue && "ring-1 ring-red-400"),
              },
              href: hrefFor(m.id),
            };
          });
        const lanes = packLanes(items);
        const index = new Map(week.map((d, i) => [d, i]));
        return (
          <div key={ws} className={cn("border-b last:border-b-0", wi === grid.length - 1 && "border-b-0")}>
            <div className="grid grid-cols-7">
              {week.map((date) => {
                const inMonth = monthOf(date) === month;
                const dow = dayOfWeek(date);
                const holiday = holidays.get(date);
                const isToday = date === today;
                return (
                  <div key={date} className={cn("flex items-center justify-between border-r px-1.5 pt-1.5 last:border-r-0", !inMonth && "bg-muted/20 text-muted-foreground", (dow === 0 || dow === 6 || holiday) && inMonth && "bg-muted/30")}>
                    <span className={cn("inline-flex size-6 items-center justify-center rounded-full text-sm", (dow === 0 || holiday) && "text-red-600", dow === 6 && !holiday && "text-blue-600", isToday && "bg-primary font-semibold text-primary-foreground")}>{parseKey(date).getUTCDate()}</span>
                    {holiday && <span className="truncate text-[11px] text-red-600">{holiday}</span>}
                  </div>
                );
              })}
            </div>
            <div className="relative min-h-14 pb-1.5">
              <div className="absolute inset-0 grid grid-cols-7" aria-hidden>
                {week.map((d) => (<div key={d} className="border-r last:border-r-0" />))}
              </div>
              <div className="relative grid gap-1 pt-1">
                {lanes.map((lane, li) => (
                  <div key={li} className="grid grid-cols-7">
                    {lane.map((it) => {
                      const s = index.get(it.start)!;
                      const e = index.get(it.end)!;
                      return (
                        <div key={it.key} style={{ gridColumn: `${s + 1} / span ${e - s + 1}` }} className="px-1">
                          <Link href={it.href!} scroll={false} title={it.title} className={cn("block truncate rounded px-1.5 py-0.5 text-[11px] font-medium shadow-sm hover:ring-2 hover:ring-primary/40", it.color.bar)}>{it.label}</Link>
                        </div>
                      );
                    })}
                  </div>
                ))}
              </div>
            </div>
          </div>
        );
      })}
      <div className="flex flex-wrap items-center gap-2 border-t px-3 py-2 text-[11px] text-muted-foreground">
        <span>◆ 마감일이 포함된 주</span>
        <span className={cn("rounded px-1.5 py-0.5", OVERDUE_BADGE)}>빨간 테두리 = 마감 지남</span>
      </div>
    </div>
  );
}
