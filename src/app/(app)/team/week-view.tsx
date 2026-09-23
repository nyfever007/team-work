import Link from "next/link";
import { and, eq, gte, inArray, lte } from "drizzle-orm";
import { ChevronLeftIcon, ChevronRightIcon } from "lucide-react";
import type { SafeUser } from "@/lib/auth/session";
import { allMembers } from "@/lib/members/queries";
import { addDays, formatKoDate, formatTime, weekStartOf } from "@/lib/dates";
import { db, schema } from "@/lib/db";
import { LEAVE_BADGE_CLASS, LEAVE_LABEL } from "@/lib/leaves/types";
import { groupBy, weeklyItemsFor } from "@/lib/plans/queries";
import { groupTasks, tasksFor } from "@/lib/tasks/queries";
import { TASK_STATUS_CLASS, TASK_STATUS_MARK } from "@/lib/tasks/types";
import { isWorkingDay, loadHolidays, weekInfo } from "@/lib/workdays";
import { TaskLines } from "@/components/task-lines";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { LeaderBadge } from "@/components/leader-badge";

function Text({ value }: { value: string }) {
  if (!value.trim()) return <span className="text-muted-foreground">작성되지 않음</span>;
  return <span className="whitespace-pre-wrap">{value}</span>;
}

export function WeekView({ user, weekStart, today, toggle }: { user: SafeUser; weekStart: string; today: string; toggle: React.ReactNode }) {
  const weekEnd = addDays(weekStart, 6);
  const holidays = loadHolidays(weekStart, weekEnd);
  const week = weekInfo(weekStart, holidays);
  const thisWeek = weekStartOf(today);

  const members = allMembers();
  const ids = members.map((m) => m.id);
  const [logs, reports, leaves] = ids.length
    ? [
        db.select().from(schema.dailyLogs).where(and(inArray(schema.dailyLogs.memberId, ids), gte(schema.dailyLogs.date, weekStart), lte(schema.dailyLogs.date, weekEnd))).all(),
        db.select().from(schema.weeklyReports).where(and(inArray(schema.weeklyReports.memberId, ids), eq(schema.weeklyReports.weekStart, weekStart))).all(),
        db.select().from(schema.leaves).where(and(inArray(schema.leaves.memberId, ids), gte(schema.leaves.date, weekStart), lte(schema.leaves.date, weekEnd))).all(),
      ]
    : [[], [], []];

  const logKey = (m: number, d: string) => `${m}:${d}`;
  const taskMap = groupTasks(tasksFor(ids, weekStart, weekEnd));
  const weeklyByMember = groupBy(weeklyItemsFor(ids, weekStart), (w) => w.memberId);
  const logMap = new Map(logs.map((l) => [logKey(l.memberId, l.date), l]));
  const leaveMap = new Map(leaves.map((l) => [logKey(l.memberId, l.date), l]));
  const reportMap = new Map(reports.map((r) => [r.memberId, r]));

  // Show Mon–Fri always; weekend days only when someone wrote something.
  const visibleDays = week.days.filter((d, i) => i < 5 || logs.some((l) => l.date === d) || [...taskMap.keys()].some((k) => k.endsWith(`:${d}`)));

  return (
    <div className="grid gap-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold">주간 기록</h2>
          <p className="text-sm text-muted-foreground">
            {formatKoDate(weekStart)} ~ {formatKoDate(weekEnd)} · 근무일 {week.workingDays.length}일
          </p>
        </div>
        <div className="flex items-center gap-2">
          {toggle}
          <Button variant="outline" size="icon" asChild aria-label="이전 주">
            <Link href={`/team?view=week&week=${addDays(weekStart, -7)}`}>
              <ChevronLeftIcon className="size-4" />
            </Link>
          </Button>
          <Button variant="outline" size="sm" asChild>
            <Link href="/team?view=week">이번 주</Link>
          </Button>
          <Button variant="outline" size="icon" asChild aria-label="다음 주" disabled={weekStart >= thisWeek}>
            <Link href={`/team?view=week&week=${addDays(weekStart, 7)}`} aria-disabled={weekStart >= thisWeek}>
              <ChevronRightIcon className="size-4" />
            </Link>
          </Button>
        </div>
      </div>

      {members.length === 0 && <p className="text-sm text-muted-foreground">등록된 구성원이 없습니다.</p>}

      {members.map((m) => {
        const report = reportMap.get(m.id);
        const mine = m.id === user.memberId;
        return (
          <Card key={m.id} className={cn(mine && "border-primary/40")}>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                {m.name}
                {m.isLeader && <LeaderBadge />}
                <span className="text-sm font-normal text-muted-foreground">{m.team} · {m.position}</span>
                {mine && <span className="rounded bg-muted px-1.5 py-0.5 text-xs">나</span>}
              </CardTitle>
              <CardDescription>
                주간 항목 {(weeklyByMember.get(m.id) ?? []).filter((w) => w.status === "done").length}/{(weeklyByMember.get(m.id) ?? []).length} 완료 · 주간 성과 {formatTime(report?.resultUpdatedAt) ?? "미작성"}
              </CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="rounded-md bg-muted/40 p-3 text-sm">
                  <div className="mb-1 text-xs font-medium text-muted-foreground">이번 주 할 일</div>
                  {(weeklyByMember.get(m.id) ?? []).length === 0 ? (
                    <Text value={report?.plan ?? ""} />
                  ) : (
                    <ul className="grid gap-0.5">
                      {(weeklyByMember.get(m.id) ?? []).map((w) => (
                        <li key={w.id} className="flex items-start gap-1.5">
                          <span className={cn("shrink-0", TASK_STATUS_CLASS[w.status])}>{TASK_STATUS_MARK[w.status]}</span>
                          <span className={cn(w.status === "done" && "text-muted-foreground line-through")}>{w.title}</span>
                          {w.assignedByName && <span className="rounded bg-violet-100 px-1 text-[10px] text-violet-900">{w.assignedByName} 지정</span>}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
                <div className="rounded-md bg-muted/40 p-3 text-sm">
                  <div className="mb-1 text-xs font-medium text-muted-foreground">이번 주 성과</div>
                  <Text value={report?.result ?? ""} />
                </div>
              </div>
              <div className="overflow-hidden rounded-md border">
                <table className="w-full text-sm">
                  <thead className="bg-muted/40 text-xs text-muted-foreground">
                    <tr>
                      <th className="w-32 px-3 py-2 text-left font-medium">날짜</th>
                      <th className="px-3 py-2 text-left font-medium">할 일</th>
                      <th className="px-3 py-2 text-left font-medium">한 일</th>
                    </tr>
                  </thead>
                  <tbody>
                    {visibleDays.map((d) => {
                      const log = logMap.get(logKey(m.id, d));
                      const leave = leaveMap.get(logKey(m.id, d));
                      const tasks = taskMap.get(logKey(m.id, d)) ?? [];
                      const off = !isWorkingDay(d, holidays);
                      const holidayName = holidays.get(d);
                      return (
                        <tr key={d} className={cn("border-t align-top", off && "bg-muted/20 text-muted-foreground", d === today && "bg-primary/5")}>
                          <td className="px-3 py-2 whitespace-nowrap">
                            <div>{formatKoDate(d)}</div>
                            {holidayName && <div className="text-xs">{holidayName}</div>}
                            {leave && (
                              <span className={cn("mt-1 inline-block rounded px-1.5 py-0.5 text-xs font-medium", LEAVE_BADGE_CLASS[leave.type])}>
                                {LEAVE_LABEL[leave.type]}
                              </span>
                            )}
                          </td>
                          <td className="px-3 py-2">
                            <TaskLines tasks={tasks} extra={tasks.length === 0 ? log?.plan : undefined} />
                          </td>
                          <td className="px-3 py-2">
                            <TaskLines tasks={tasks} review extra={log?.done} />
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
