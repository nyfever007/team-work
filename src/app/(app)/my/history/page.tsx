import type { Metadata } from "next";
import Link from "next/link";
import { and, eq, gte, lte } from "drizzle-orm";
import { ChevronLeftIcon, ChevronRightIcon } from "lucide-react";
import { requireUser } from "@/lib/auth/dal";
import { addDays, formatKoDate, isValidKey, todayKey, weekStartOf } from "@/lib/dates";
import { db, schema } from "@/lib/db";
import { LEAVE_BADGE_CLASS, LEAVE_LABEL } from "@/lib/leaves/types";
import { groupReviews, reviewsFor } from "@/lib/reviews/queries";
import { groupTasks, tasksFor } from "@/lib/tasks/queries";
import { isWorkingDay, loadHolidays, weekInfo } from "@/lib/workdays";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ReviewList } from "@/components/reviews/review-list";
import { TaskLines } from "@/components/task-lines";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "내 기록" };

export default async function HistoryPage({ searchParams }: PageProps<"/history">) {
  const user = await requireUser();
  const { week: weekParam } = await searchParams;
  const today = todayKey();
  const thisWeek = weekStartOf(today);
  const weekStart = isValidKey(weekParam) ? weekStartOf(weekParam) : thisWeek;
  const weekEnd = addDays(weekStart, 6);
  const holidays = loadHolidays(weekStart, weekEnd);
  const week = weekInfo(weekStart, holidays);

  if (user.memberId == null) {
    return (
      <div className="grid gap-6">
        <h1 className="text-2xl font-semibold tracking-tight">내 기록</h1>
        <Card>
          <CardHeader>
            <CardTitle>구성원과 연결되지 않은 계정입니다</CardTitle>
            <CardDescription>
              <Link href="/admin/members" className="underline underline-offset-4">
                구성원 페이지
              </Link>
              에서 이 계정을 구성원과 연결하면 날짜별 기록과 팀장 리뷰를 볼 수 있습니다.
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  const memberId = user.memberId;
  const taskMap = groupTasks(tasksFor([memberId], weekStart, weekEnd));
  const reviewMap = groupReviews(reviewsFor([memberId], weekStart, weekEnd));
  const logs = db.select().from(schema.dailyLogs).where(and(eq(schema.dailyLogs.memberId, memberId), gte(schema.dailyLogs.date, weekStart), lte(schema.dailyLogs.date, weekEnd))).all();
  const logMap = new Map(logs.map((l) => [l.date, l]));
  const leaves = db.select().from(schema.leaves).where(and(eq(schema.leaves.memberId, memberId), gte(schema.leaves.date, weekStart), lte(schema.leaves.date, weekEnd))).all();
  const leaveMap = new Map(leaves.map((l) => [l.date, l]));

  const days = week.days.filter((d) => d <= today && (isWorkingDay(d, holidays) || taskMap.has(`${memberId}:${d}`) || logMap.get(d)?.done.trim()));
  const totalTasks = [...taskMap.values()].reduce((n, t) => n + t.length, 0);
  const doneTasks = [...taskMap.values()].reduce((n, t) => n + t.filter((x) => x.status === "done").length, 0);
  const reviewCount = [...reviewMap.values()].reduce((n, r) => n + r.length, 0);

  return (
    <div className="grid gap-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">내 기록</h1>
          <p className="text-sm text-muted-foreground">
            {formatKoDate(weekStart)} ~ {formatKoDate(weekEnd)} · 완료 {doneTasks}/{totalTasks} · 팀장 리뷰 {reviewCount}건
          </p>
        </div>
        <div className="flex items-center gap-1">
          <Button variant="outline" size="icon" asChild aria-label="이전 주">
            <Link href={`/my/history?week=${addDays(weekStart, -7)}`}>
              <ChevronLeftIcon className="size-4" />
            </Link>
          </Button>
          <Button variant="outline" size="sm" asChild>
            <Link href="/my/history">이번 주</Link>
          </Button>
          <Button variant="outline" size="icon" asChild aria-label="다음 주" disabled={weekStart >= thisWeek}>
            <Link href={`/my/history?week=${addDays(weekStart, 7)}`} aria-disabled={weekStart >= thisWeek}>
              <ChevronRightIcon className="size-4" />
            </Link>
          </Button>
        </div>
      </div>

      {days.length === 0 && <p className="text-sm text-muted-foreground">이 주에는 기록이 없습니다.</p>}

      <div className="grid gap-4">
        {[...days].reverse().map((d) => {
          const tasks = taskMap.get(`${memberId}:${d}`) ?? [];
          const log = logMap.get(d);
          const reviews = reviewMap.get(`${memberId}:${d}`) ?? [];
          const leave = leaveMap.get(d);
          const holiday = holidays.get(d);
          const isToday = d === today;
          return (
            <Card key={d} className={cn(isToday && "border-primary/40")}>
              <CardHeader>
                <CardTitle className="flex flex-wrap items-center gap-2 text-base">
                  {formatKoDate(d)}
                  {isToday && <span className="rounded bg-primary px-1.5 py-0.5 text-[11px] font-medium text-primary-foreground">오늘</span>}
                  {holiday && <span className="text-xs font-normal text-red-600">{holiday}</span>}
                  {leave && <span className={cn("rounded px-1.5 py-0.5 text-xs font-medium", LEAVE_BADGE_CLASS[leave.type])}>{LEAVE_LABEL[leave.type]}</span>}
                  {tasks.length > 0 && (
                    <span className="ml-auto text-xs font-normal text-muted-foreground tabular-nums">
                      완료 {tasks.filter((t) => t.status === "done").length}/{tasks.length}
                    </span>
                  )}
                </CardTitle>
              </CardHeader>
              <CardContent className="grid gap-4 md:grid-cols-[1fr_minmax(260px,40%)]">
                <div>
                  <div className="mb-1 text-xs font-medium text-muted-foreground">한 일</div>
                  <TaskLines tasks={tasks} review extra={log?.done} emptyText={isToday ? "아직 기록이 없습니다." : "기록이 없습니다."} />
                </div>
                <div>
                  <div className="mb-1 text-xs font-medium text-muted-foreground">팀장 리뷰</div>
                  <ReviewList reviews={reviews} emptyText={isToday ? "아직 리뷰가 없습니다." : "리뷰가 없습니다."} />
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
