import type { Metadata } from "next";
import Link from "next/link";
import { and, eq } from "drizzle-orm";
import { ChevronLeftIcon, ChevronRightIcon } from "lucide-react";
import { requireUser } from "@/lib/auth/dal";
import { addDays, formatKoDate, formatTime, isValidKey, monthOf, todayKey, weekStartOf } from "@/lib/dates";
import { db, schema } from "@/lib/db";
import { saveWeeklyReport } from "@/lib/logs/actions";
import { memberById } from "@/lib/members/queries";
import { milestonesInRange } from "@/lib/milestones/queries";
import { monthlyGoalsFor, tasksForWeeklyItems, weeklyItemsFor } from "@/lib/plans/queries";
import { loadHolidays, weekInfo } from "@/lib/workdays";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { TextEntryForm } from "@/components/forms/text-entry-form";
import { cn } from "@/lib/utils";
import { WeeklyPlanner } from "./weekly-planner";

export const metadata: Metadata = { title: "이번 주" };

export default async function WeekPage({ searchParams }: PageProps<"/my/week">) {
  const user = await requireUser();
  const { week: weekParam } = await searchParams;
  const today = todayKey();
  const thisWeek = weekStartOf(today);
  const weekStart = isValidKey(weekParam) ? weekStartOf(weekParam) : thisWeek;
  const weekEnd = addDays(weekStart, 6);
  const holidays = loadHolidays(weekStart, weekEnd);
  const week = weekInfo(weekStart, holidays);
  const isThisWeek = weekStart === thisWeek;
  const isFirstWD = isThisWeek && today === week.firstWorkingDay;
  const isLastWD = isThisWeek && today === week.lastWorkingDay;

  const me = user.memberId != null ? memberById(user.memberId) : undefined;
  if (!me) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>구성원과 연결되지 않은 계정입니다</CardTitle>
          <CardDescription>
            <Link href="/admin/members" className="underline underline-offset-4">구성원 관리</Link>에서 이 계정을 구성원과 연결하면 주간 계획을 작성할 수 있습니다.
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  const items = weeklyItemsFor([me.id], weekStart);
  const linkedTasks = tasksForWeeklyItems(items.map((i) => i.id));
  const goals = monthlyGoalsFor([me.id], monthOf(weekStart)).filter((g) => g.status !== "done" || items.some((i) => i.monthlyGoalId === g.id));
  const milestones = milestonesInRange(addDays(weekStart, -60), addDays(weekEnd, 120))
    .filter((m) => m.status !== "done" && m.status !== "on_hold")
    .filter((m) => m.teamId === me.teamId || items.some((i) => i.milestoneId === m.id))
    .map((m) => ({ id: m.id, title: m.title, team: m.team }));
  const report = db.select().from(schema.weeklyReports).where(and(eq(schema.weeklyReports.memberId, me.id), eq(schema.weeklyReports.weekStart, weekStart))).get();
  const done = items.filter((i) => i.status === "done").length;

  return (
    <div className="grid gap-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold">이번 주 할 일 · 성과</h2>
          <p className="text-sm text-muted-foreground">
            {formatKoDate(week.days[0])} ~ {formatKoDate(week.days[6])} · 근무일 {week.workingDays.length}일{isThisWeek && " · 이번 주"} · 항목 {done}/{items.length} 완료
          </p>
        </div>
        <div className="flex items-center gap-1">
          <Button variant="outline" size="icon" asChild aria-label="이전 주"><Link href={`/my/week?week=${addDays(weekStart, -7)}`}><ChevronLeftIcon className="size-4" /></Link></Button>
          <Button variant="outline" size="sm" asChild><Link href="/my/week">이번 주</Link></Button>
          <Button variant="outline" size="icon" asChild aria-label="다음 주"><Link href={`/my/week?week=${addDays(weekStart, 7)}`}><ChevronRightIcon className="size-4" /></Link></Button>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-[3fr_2fr]">
        <Card className={cn(isFirstWD && "border-primary/40")}>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              이번 주 할 일
              {isFirstWD && <Badge>오늘 작성</Badge>}
            </CardTitle>
            <CardDescription>
              매주 첫 근무일에 작성{week.firstWorkingDay && ` · ${formatKoDate(week.firstWorkingDay)}`}. 항목을 월간 목표나 팀 마일스톤에 연결하고, ‘오늘로’를 눌러 오늘 할 일로 가져옵니다.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <WeeklyPlanner weekStart={weekStart} today={today} isThisWeek={isThisWeek} items={items} linkedTasks={linkedTasks} milestones={milestones} goals={goals.map((g) => ({ id: g.id, title: g.title }))} />
          </CardContent>
        </Card>
        <Card className={cn(isLastWD && "border-primary/40")}>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              이번 주 성과
              {isLastWD && <Badge>오늘 작성</Badge>}
            </CardTitle>
            <CardDescription>매주 마지막 근무일에 작성{week.lastWorkingDay && ` · ${formatKoDate(week.lastWorkingDay)}`}. 항목 완료 표시 외에 정리할 결과와 배운 점을 적어 주세요.</CardDescription>
          </CardHeader>
          <CardContent>
            <TextEntryForm action={saveWeeklyReport.bind(null, weekStart, "result")} defaultValue={report?.result ?? ""} placeholder="이번 주에 이룬 결과, 이슈, 다음 주로 넘기는 일" savedLabel={formatTime(report?.resultUpdatedAt)} rows={12} />
          </CardContent>
        </Card>
      </div>

      <p className="text-sm text-muted-foreground">
        팀 전체의 주간 기록은 <Link href={`/team?view=week&week=${weekStart}`} className="underline underline-offset-4">팀 › 현황 › 한 주</Link>에서, 월간 목표는 <Link href={`/my/month?month=${monthOf(weekStart)}`} className="underline underline-offset-4">이번 달</Link>에서 볼 수 있습니다.
      </p>
    </div>
  );
}
