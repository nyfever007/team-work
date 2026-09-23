import Link from "next/link";
import { monthOf } from "@/lib/dates";
import type { Leave } from "@/lib/db/schema";
import type { Member } from "@/lib/members/types";
import { LEAVE_LABEL } from "@/lib/leaves/types";
import { memberColorMap } from "@/lib/members/colors";
import type { HolidayMap } from "@/lib/workdays";
import { WeekTimeline, mergeRuns, type TimelineItem } from "@/components/week-timeline";
import { cn } from "@/lib/utils";

type Props = {
  days: string[];
  today: string;
  holidays: HolidayMap;
  members: Member[];
  leaves: Leave[];
  myMemberId: number | null;
};

export function WeekLeaves({ days, today, holidays, members, leaves, myMemberId }: Props) {
  const colors = memberColorMap(members.map((m) => m.id));
  const nameOf = new Map(members.map((m) => [m.id, m.name]));

  const items: TimelineItem[] = [];
  const byMember = new Map<number, Leave[]>();
  for (const l of leaves) byMember.set(l.memberId, [...(byMember.get(l.memberId) ?? []), l]);

  for (const [memberId, rows] of byMember) {
    const color = colors.get(memberId);
    const name = nameOf.get(memberId);
    if (!color || !name) continue;
    for (const run of mergeRuns(rows, (r) => r.date, (a, b) => a.type === b.type)) {
      const type = run.first.type;
      const isHalf = type === "half_am" || type === "half_pm";
      const notes = rows.filter((r) => r.date >= run.start && r.date <= run.end && r.note).map((r) => r.note);
      items.push({
        key: `leave:${memberId}:${run.start}`,
        start: run.start,
        end: run.end,
        label: `${name} ${LEAVE_LABEL[type]}`,
        title: `${name} · ${LEAVE_LABEL[type]} · ${run.start}${run.count > 1 ? ` ~ ${run.end} (${run.count}일)` : ""}${notes.length ? ` · ${notes.join(", ")}` : ""}`,
        color,
        half: isHalf ? (type === "half_am" ? "am" : "pm") : undefined,
      });
    }
  }

  const offMembers = new Set(leaves.map((l) => l.memberId));

  return (
    <div className="grid gap-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-lg font-semibold">이번 주 휴가</h2>
        <div className="flex gap-3 text-sm text-muted-foreground">
          <Link href="/team/milestones?view=calendar" className="hover:underline">
            마일스톤 달력 →
          </Link>
          <Link href={`/schedule?month=${monthOf(today)}`} className="hover:underline">
            달력에서 휴가 등록 →
          </Link>
        </div>
      </div>
      <WeekTimeline days={days} today={today} holidays={holidays} items={items} emptyText="이번 주 휴가 일정이 없습니다." />
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
        {members.map((m) => (
          <span key={m.id} className={cn("inline-flex items-center gap-1", m.id === myMemberId && "font-medium text-foreground")}>
            <span className={cn("size-2.5 rounded-full", colors.get(m.id)?.dot, !offMembers.has(m.id) && "opacity-40")} />
            {m.name}
          </span>
        ))}
      </div>
    </div>
  );
}
