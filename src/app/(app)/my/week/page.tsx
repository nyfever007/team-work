import type { Metadata } from "next";
import Link from "next/link";
import { and, eq, gte, lte } from "drizzle-orm";
import { ChevronLeftIcon, ChevronRightIcon, MessageSquareHeartIcon } from "lucide-react";
import { requireUser } from "@/lib/auth/dal";
import { addDays, formatKoDate, formatTime, isValidKey, todayKey, weekStartOf } from "@/lib/dates";
import { db, schema } from "@/lib/db";
import { LEAVE_BADGE_CLASS, LEAVE_LABEL } from "@/lib/leaves/types";
import { saveWeeklyReport } from "@/lib/logs/actions";
import { WEEKLY_REPORT_SECTIONS, WEEKLY_REPORT_TEMPLATE } from "@/lib/logs/template";
import { memberReviewFor } from "@/lib/member-reviews/queries";
import { memberById } from "@/lib/members/queries";
import { tasksFor } from "@/lib/tasks/queries";
import { isWorkingDay, loadHolidays, weekInfo } from "@/lib/workdays";
import { TextEntryForm } from "@/components/forms/text-entry-form";
import { ProgressBar } from "@/components/motion";
import { TaskLines } from "@/components/task-lines";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "주간 보고" };

/**
 * 주간 보고: members write one report per week; the week's daily goals/results are summarised automatically beside it.
 * (The weekly plan items of phase 2 are no longer part of the member flow; their rows stay in the DB.)
 */
export default async function WeeklyReportPage({ searchParams }: PageProps<"/my/week">) {
  const user = await requireUser();
  const { week: weekParam } = await searchParams;
  const today = todayKey();
  const thisWeek = weekStartOf(today);
  const weekStart = isValidKey(weekParam) ? weekStartOf(weekParam) : thisWeek;
  const weekEnd = addDays(weekStart, 6);
  const holidays = loadHolidays(weekStart, weekEnd);
  const week = weekInfo(weekStart, holidays);
  const isThisWeek = weekStart === thisWeek;
  const dueNow = isThisWeek && !!week.lastWorkingDay && today >= week.lastWorkingDay;

  const me = user.memberId != null ? memberById(user.memberId) : undefined;
  if (!me) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>구성원과 연결되지 않은 계정입니다</CardTitle>
          <CardDescription>구성원과 연결된 계정만 주간 보고를 작성할 수 있습니다.</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  const tasks = tasksFor([me.id], weekStart, weekEnd);
  const logs = db.select().from(schema.dailyLogs).where(and(eq(schema.dailyLogs.memberId, me.id), gte(schema.dailyLogs.date, weekStart), lte(schema.dailyLogs.date, weekEnd))).all();
  const leaves = db.select().from(schema.leaves).where(and(eq(schema.leaves.memberId, me.id), gte(schema.leaves.date, weekStart), lte(schema.leaves.date, weekEnd))).all();
  const report = db.select().from(schema.weeklyReports).where(and(eq(schema.weeklyReports.memberId, me.id), eq(schema.weeklyReports.weekStart, weekStart))).get();
  const review = memberReviewFor(me.id, weekStart);
  const done = tasks.filter((t) => t.status === "done").length;
  const days = week.days.filter((d) => (d <= today && isWorkingDay(d, holidays)) || tasks.some((t) => t.date === d) || logs.some((l) => l.date === d && l.done.trim()));
  const plannedDays = days.filter((d) => tasks.some((t) => t.date === d)).length;
  const workDays = days.filter((d) => isWorkingDay(d, holidays)).length;

  return (
    <div className="grid gap-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2 text-lg font-bold">
            주간 보고
            {dueNow && !report?.result.trim() && <Badge>지금 작성</Badge>}
          </h2>
          <p className="text-sm text-muted-foreground">
            {formatKoDate(weekStart)} ~ {formatKoDate(weekEnd)}
            {isThisWeek && " · 이번 주"} · 매주 마지막 근무일{week.lastWorkingDay && `(${formatKoDate(week.lastWorkingDay)})`}에 작성해 팀장에게 보고합니다.
          </p>
        </div>
        <div className="flex items-center gap-1">
          <Button variant="outline" size="icon" asChild aria-label="이전 주">
            <Link href={`/my/week?week=${addDays(weekStart, -7)}`}><ChevronLeftIcon className="size-4" /></Link>
          </Button>
          <Button variant="outline" size="sm" asChild>
            <Link href="/my/week">이번 주</Link>
          </Button>
          <Button variant="outline" size="icon" asChild aria-label="다음 주" disabled={weekStart >= thisWeek}>
            <Link href={`/my/week?week=${addDays(weekStart, 7)}`} aria-disabled={weekStart >= thisWeek}><ChevronRightIcon className="size-4" /></Link>
          </Button>
        </div>
      </div>

      {review?.status === "shared" && (
        <Link href="/my/feedback" className="flex items-center gap-2 rounded-xl border border-brand/25 bg-brand-soft/60 px-4 py-2.5 text-sm hover:bg-brand-soft">
          <MessageSquareHeartIcon className="size-4 text-brand" />
          <b className="font-semibold text-accent-foreground">{review.reviewerName} 팀장의 이 주 리뷰가 도착했습니다</b>
          <span className="ml-auto text-xs text-muted-foreground">피드백 보기 →</span>
        </Link>
      )}

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
        <Card className="self-start">
          <CardHeader>
            <CardTitle className="text-base font-bold">이번 주 한 일</CardTitle>
            <CardDescription>매일 적은 목표와 결과가 자동으로 모입니다. 보고서를 쓸 때 참고하세요.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4">
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div className="rounded-lg border p-3">
                <div className="text-xs text-muted-foreground">목표 완료</div>
                <div className="text-lg font-bold tabular-nums">
                  {done}/{tasks.length}
                </div>
                <ProgressBar value={tasks.length ? done / tasks.length : 0} className="mt-1.5 h-1" />
              </div>
              <div className="rounded-lg border p-3">
                <div className="text-xs text-muted-foreground">목표 작성</div>
                <div className="text-lg font-bold tabular-nums">
                  {plannedDays}/{workDays}일
                </div>
                <ProgressBar value={workDays ? plannedDays / workDays : 0} className="mt-1.5 h-1" barClassName="bg-brand" />
              </div>
            </div>
            <ol className="relative grid gap-3 border-l pl-4">
              {days.length === 0 && <li className="text-sm text-muted-foreground">아직 기록이 없습니다.</li>}
              {days.map((d) => {
                const ts = tasks.filter((t) => t.date === d);
                const extra = logs.find((l) => l.date === d)?.done;
                const leave = leaves.find((l) => l.date === d);
                return (
                  <li key={d} className="relative">
                    <span className={cn("absolute top-1.5 -left-[21px] size-2.5 rounded-full border-2 border-card", ts.length ? "bg-brand" : "bg-muted-foreground/30")} />
                    <div className="mb-0.5 flex items-center gap-1.5 text-xs font-medium">
                      {formatKoDate(d)}
                      {d === today && <span className="rounded bg-brand px-1 text-[10px] text-white">오늘</span>}
                      {leave && <span className={cn("rounded px-1 text-[10px]", LEAVE_BADGE_CLASS[leave.type])}>{LEAVE_LABEL[leave.type]}</span>}
                    </div>
                    <TaskLines tasks={ts} review extra={extra} emptyText="기록 없음" />
                  </li>
                );
              })}
            </ol>
          </CardContent>
        </Card>

        <Card className={cn("self-start", dueNow && !report?.result.trim() && "ring-2 ring-brand/30")}>
          <CardHeader>
            <CardTitle className="text-base font-bold">주간 보고서</CardTitle>
            <CardDescription>항목마다 한두 줄이면 충분합니다. 해당 없는 항목은 비워 두세요.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4">
            <ol className="grid gap-1 rounded-lg bg-muted/40 px-3 py-2.5 text-xs">
              {WEEKLY_REPORT_SECTIONS.map((s, i) => (
                <li key={s.heading} className="flex gap-1.5">
                  <span className="w-4 shrink-0 text-right font-semibold text-brand tabular-nums">{i + 1}.</span>
                  <span className="shrink-0 font-medium">{s.heading}</span>
                  <span className="text-muted-foreground">— {s.guide}</span>
                </li>
              ))}
            </ol>
            <TextEntryForm key={weekStart} action={saveWeeklyReport.bind(null, weekStart, "result")} defaultValue={report?.result || WEEKLY_REPORT_TEMPLATE} savedLabel={formatTime(report?.resultUpdatedAt)} rows={20} />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
