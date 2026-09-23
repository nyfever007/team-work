import Link from "next/link";
import { WEEKDAY_KO, addDays, dayOfWeek, parseKey } from "@/lib/dates";
import type { HolidayMap } from "@/lib/workdays";
import { cn } from "@/lib/utils";

/**
 * One bar on the timeline. `start`/`end` are inclusive YYYY-MM-DD keys
 * (already clipped to the visible week). Leaves today; team schedules later.
 */
export type TimelineItem = {
  key: string;
  start: string;
  end: string;
  label: string;
  title?: string;
  /** Tailwind classes for the bar (background + text). */
  color: { bar: string };
  /** Render a single-day bar on the left or right half of the cell (반차). */
  half?: "am" | "pm";
  /** Optional link target (e.g. milestone detail). */
  href?: string;
  /** Visual variant: solid member bar (default) or outlined schedule bar. */
  variant?: "solid" | "outline";
};

type Props = {
  days: string[]; // Mon..Sun
  today: string;
  holidays: HolidayMap;
  items: TimelineItem[];
  emptyText?: string;
};

/** Greedy interval packing: first lane whose last item ends before this one starts. */
export function packLanes(items: TimelineItem[]): TimelineItem[][] {
  const sorted = [...items].sort((a, b) => (a.start === b.start ? a.end.localeCompare(b.end) : a.start.localeCompare(b.start)));
  const lanes: TimelineItem[][] = [];
  for (const item of sorted) {
    const lane = lanes.find((l) => l[l.length - 1].end < item.start);
    if (lane) lane.push(item);
    else lanes.push([item]);
  }
  return lanes;
}

export function WeekTimeline({ days, today, holidays, items, emptyText = "이번 주 일정이 없습니다." }: Props) {
  const index = new Map(days.map((d, i) => [d, i]));
  const lanes = packLanes(items);

  const colClass = (d: string, base = "") => {
    const dow = dayOfWeek(d);
    const off = dow === 0 || dow === 6 || holidays.has(d);
    return cn(base, off && "bg-muted/50", d === today && "bg-primary/10");
  };

  return (
    <div className="overflow-x-auto rounded-lg border">
      <div className="min-w-[640px]">
        {/* header */}
        <div className="grid grid-cols-7 border-b bg-muted/30">
          {days.map((d) => {
            const dow = dayOfWeek(d);
            const holiday = holidays.get(d);
            const isToday = d === today;
            return (
              <div key={d} className={colClass(d, "px-2 py-2 text-center")}>
                <div className={cn("text-xs", dow === 0 || holiday ? "text-red-600" : dow === 6 ? "text-blue-600" : "text-muted-foreground")}>
                  {WEEKDAY_KO[dow]}
                </div>
                <div className={cn("mx-auto mt-0.5 inline-flex size-7 items-center justify-center rounded-full text-sm tabular-nums", isToday && "bg-primary font-semibold text-primary-foreground")}>
                  {parseKey(d).getUTCDate()}
                </div>
                {holiday && <div className="truncate text-[11px] text-red-600">{holiday}</div>}
              </div>
            );
          })}
        </div>

        {/* body: column shading behind, lanes on top */}
        <div className="relative">
          <div className="absolute inset-0 grid grid-cols-7" aria-hidden>
            {days.map((d) => (
              <div key={d} className={colClass(d, "border-r last:border-r-0")} />
            ))}
          </div>
          <div className="relative grid gap-1.5 py-2">
            {lanes.length === 0 && <p className="py-4 text-center text-sm text-muted-foreground">{emptyText}</p>}
            {lanes.map((lane, li) => (
              <div key={li} className="grid grid-cols-7 gap-y-1">
                {lane.map((item) => {
                  const s = index.get(item.start);
                  const e = index.get(item.end);
                  if (s === undefined || e === undefined) return null;
                  const span = e - s + 1;
                  return (
                    <div
                      key={item.key}
                      style={{ gridColumn: `${s + 1} / span ${span}` }}
                      className={cn("px-1", item.half === "am" && "pr-[50%]", item.half === "pm" && "pl-[50%]")}
                    >
                      {item.href ? (
                        <Link
                          href={item.href}
                          title={item.title ?? item.label}
                          className={cn("block truncate rounded-md px-2 py-1 text-xs font-medium shadow-sm hover:ring-2 hover:ring-primary/40", item.color.bar, item.variant === "outline" && "ring-1 ring-black/10")}
                        >
                          {item.label}
                        </Link>
                      ) : (
                        <div
                          title={item.title ?? item.label}
                          className={cn("truncate rounded-md px-2 py-1 text-xs font-medium shadow-sm", item.color.bar, item.variant === "outline" && "ring-1 ring-black/10")}
                        >
                          {item.label}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

/** Merge consecutive same-group days into [start, end] runs. */
export function mergeRuns<T>(
  rows: T[],
  date: (r: T) => string,
  sameRun: (a: T, b: T) => boolean,
): { start: string; end: string; first: T; count: number }[] {
  const sorted = [...rows].sort((a, b) => date(a).localeCompare(date(b)));
  const runs: { start: string; end: string; first: T; count: number }[] = [];
  for (const r of sorted) {
    const last = runs[runs.length - 1];
    if (last && sameRun(last.first, r) && addDays(last.end, 1) === date(r)) {
      last.end = date(r);
      last.count++;
    } else {
      runs.push({ start: date(r), end: date(r), first: r, count: 1 });
    }
  }
  return runs;
}
