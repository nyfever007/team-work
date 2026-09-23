import type { Metadata } from "next";
import Link from "next/link";
import { and, eq, gte, inArray, lte } from "drizzle-orm";
import { CalendarCheckIcon, MessageSquareIcon, PalmtreeIcon } from "lucide-react";
import { leaveBalance } from "@/lib/leaves/balance";
import { formatDays } from "@/lib/requests/calc";
import { requireUser } from "@/lib/auth/dal";
import { addDays, currentHourKST, formatKoDate, formatTime, todayKey, weekStartOf } from "@/lib/dates";
import { db, schema } from "@/lib/db";
import { saveDailyLog } from "@/lib/logs/actions";
import { allMembers } from "@/lib/members/queries";
import { weeklyItemsFor } from "@/lib/plans/queries";
import { reviewsFor } from "@/lib/reviews/queries";
import { myTasks } from "@/lib/tasks/queries";
import { isWorkingDay, loadHolidays, weekInfo } from "@/lib/workdays";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { TextEntryForm } from "@/components/forms/text-entry-form";
import { TaskPlanner } from "./task-planner";
import { TaskReview } from "./task-review";
import { WeekLeaves } from "./week-leaves";

export const metadata: Metadata = { title: "오늘" };

export default async function TodayPage() {
  const user = await requireUser();
  const today = todayKey();
  const hour = currentHourKST();
  const weekStart = weekStartOf(today);
  const weekEnd = addDays(weekStart, 6);
  const holidays = loadHolidays(weekStart, weekEnd);
  const week = weekInfo(weekStart, holidays);
  const working = isWorkingDay(today, holidays);
  const holidayName = holidays.get(today);
  const morning = working && hour < 14;

  const members = allMembers();
  const memberIds = members.map((m) => m.id);
  const weekLeaves = memberIds.length
    ? db
        .select()
        .from(schema.leaves)
        .where(and(inArray(schema.leaves.memberId, memberIds), gte(schema.leaves.date, weekStart), lte(schema.leaves.date, weekEnd)))
        .all()
    : [];

  const me = user.memberId != null ? members.find((m) => m.id === user.memberId) : undefined;
  const myLog = me ? db.select().from(schema.dailyLogs).where(and(eq(schema.dailyLogs.memberId, me.id), eq(schema.dailyLogs.date, today))).get() : undefined;
  const tasks = me ? myTasks(me.id, today) : [];
  const weeklyItems = me ? weeklyItemsFor([me.id], weekStart) : [];

  // Previous working day with unfinished items not already on today's list → offer carry-over.
  let carryFrom: { date: string; label: string; count: number } | null = null;
  if (me) {
    let prev = addDays(today, -1);
    for (let i = 0; i < 10 && !isWorkingDay(prev, loadHolidays(prev, prev)); i++) prev = addDays(prev, -1);
    const todayTitles = new Set(tasks.map((t) => t.title));
    const pendingPrev = myTasks(me.id, prev).filter((t) => t.status !== "done" && !todayTitles.has(t.title)).length;
    if (pendingPrev > 0) carryFrom = { date: prev, label: formatKoDate(prev), count: pendingPrev };
  }

  const balance = me ? leaveBalance(me, today) : null;
  const recentReview = me ? reviewsFor([me.id], addDays(today, -14), addDays(today, -1)).at(-1) ?? null : null;
  const myWeekly = me
    ? db.select().from(schema.weeklyReports).where(and(eq(schema.weeklyReports.memberId, me.id), eq(schema.weeklyReports.weekStart, weekStart))).get()
    : undefined;
  const isFirstWD = today === week.firstWorkingDay;
  const isLastWD = today === week.lastWorkingDay;
  const weeklyDue = !!me && ((isFirstWD && weeklyItems.length === 0) || (isLastWD && !myWeekly?.result.trim()));

  return (
    <div className="grid gap-8">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight">{user.name}님, 안녕하세요</h2>
          <p className="text-sm text-muted-foreground">
            오늘은 {formatKoDate(today)}
            {!working && <span className="ml-2 text-amber-700">· 근무일이 아닙니다{holidayName ? ` (${holidayName})` : ""}</span>}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
        {balance && (
          <Button variant="outline" asChild>
            <Link href="/schedule/requests" title="휴가 현황과 품의서">
              <PalmtreeIcon className="size-4" />
              연차 {formatDays(balance.annual.remaining)}일 · 병가 {formatDays(balance.sick.remaining)}일 남음
            </Link>
          </Button>
        )}
        {weeklyDue && (
          <Button asChild>
            <Link href="/my/week">
              <CalendarCheckIcon className="size-4" />
              이번 주 {isFirstWD ? "할 일" : "성과"} 작성
              <Badge variant="secondary" className="ml-1">
                오늘
              </Badge>
            </Link>
          </Button>
        )}
        </div>
      </div>

      {me ? (
        <section className="grid gap-4 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                오늘 할 일
                {morning && <Badge>지금 작성</Badge>}
              </CardTitle>
              <CardDescription>오늘 처리할 일을 하나씩 추가하세요. 클릭하면 수정할 수 있습니다.</CardDescription>
            </CardHeader>
            <CardContent>
              <TaskPlanner date={today} tasks={tasks} carryFrom={carryFrom} weeklyItems={weeklyItems} />
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                오늘 한 일
                {working && !morning && <Badge>지금 작성</Badge>}
              </CardTitle>
              <CardDescription>각 할 일의 완료 여부를 표시하고, 계획에 없던 일은 아래에 적어 주세요.</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4">
              <TaskReview tasks={tasks} />
              <div className="grid gap-1.5">
                <div className="text-sm font-medium">추가로 한 일</div>
                <TextEntryForm action={saveDailyLog.bind(null, today, "done")} defaultValue={myLog?.done ?? ""} savedLabel={formatTime(myLog?.doneUpdatedAt)} rows={3} />
              </div>
            </CardContent>
          </Card>
          {recentReview && (
            <p className="flex items-center gap-1 text-xs text-muted-foreground lg:col-span-2">
              <MessageSquareIcon className="size-3.5 text-amber-700" />
              {formatKoDate(recentReview.date)} {recentReview.reviewerName} 팀장 리뷰:{" "}
              <Link href={`/my/history?week=${recentReview.date}`} className="truncate underline underline-offset-4">
                {recentReview.comment.length > 60 ? `${recentReview.comment.slice(0, 60)}…` : recentReview.comment}
              </Link>
            </p>
          )}
        </section>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>구성원과 연결되지 않은 계정입니다</CardTitle>
            <CardDescription>
              일일·주간 기록을 작성하려면{" "}
              <Link href="/admin/members" className="underline underline-offset-4">
                구성원 관리
              </Link>
              에서 이 계정을 구성원과 연결하세요.
            </CardDescription>
          </CardHeader>
        </Card>
      )}

      <section>
        <WeekLeaves days={week.days} today={today} holidays={holidays} members={members} leaves={weekLeaves} myMemberId={user.memberId} />
      </section>
    </div>
  );
}
