import type { Metadata } from "next";
import Link from "next/link";
import { ChevronLeftIcon, ChevronRightIcon } from "lucide-react";
import { requireUser } from "@/lib/auth/dal";
import { addDays, addMonths, daysInMonth, formatKoMonth, isValidMonth, monthOf, todayKey, weekStartOf } from "@/lib/dates";
import { memberById } from "@/lib/members/queries";
import { milestonesInRange } from "@/lib/milestones/queries";
import { monthlyGoalsFor, weeklyItemsInRange } from "@/lib/plans/queries";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { MonthlyGoals } from "./monthly-goals";

export const metadata: Metadata = { title: "이번 달" };

export default async function MonthPage({ searchParams }: PageProps<"/my/month">) {
  const user = await requireUser();
  const { month: monthParam } = await searchParams;
  const today = todayKey();
  const month = isValidMonth(monthParam) ? monthParam : monthOf(today);
  const days = daysInMonth(month);
  const me = user.memberId != null ? memberById(user.memberId) : undefined;
  if (!me) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>구성원과 연결되지 않은 계정입니다</CardTitle>
          <CardDescription><Link href="/admin/members" className="underline underline-offset-4">구성원 관리</Link>에서 이 계정을 구성원과 연결하면 월간 목표를 작성할 수 있습니다.</CardDescription>
        </CardHeader>
      </Card>
    );
  }
  const goals = monthlyGoalsFor([me.id], month);
  const weeklyItems = weeklyItemsInRange([me.id], weekStartOf(days[0]), weekStartOf(days[days.length - 1]));
  const milestones = milestonesInRange(addDays(days[0], -90), addDays(days[days.length - 1], 180))
    .filter((m) => (m.status !== "done" && m.status !== "on_hold" && m.teamId === me.teamId) || goals.some((g) => g.milestoneId === m.id))
    .map((m) => ({ id: m.id, title: m.title, team: m.team }));
  const done = goals.filter((g) => g.status === "done").length;

  return (
    <div className="grid gap-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold">{formatKoMonth(month)} 목표</h2>
          <p className="text-sm text-muted-foreground">목표 {done}/{goals.length} 완료 · 주간 항목을 목표에 연결하면 진행률이 여기에 모입니다.{month === monthOf(today) && " · 이번 달"}</p>
        </div>
        <div className="flex items-center gap-1">
          <Button variant="outline" size="icon" asChild aria-label="이전 달"><Link href={`/my/month?month=${addMonths(month, -1)}`}><ChevronLeftIcon className="size-4" /></Link></Button>
          <Button variant="outline" size="sm" asChild><Link href="/my/month">이번 달</Link></Button>
          <Button variant="outline" size="icon" asChild aria-label="다음 달"><Link href={`/my/month?month=${addMonths(month, 1)}`}><ChevronRightIcon className="size-4" /></Link></Button>
        </div>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>이달의 목표</CardTitle>
          <CardDescription>개인 목표를 팀 마일스톤에 연결하면 마일스톤 상세의 참여 현황에 표시됩니다.</CardDescription>
        </CardHeader>
        <CardContent>
          <MonthlyGoals month={month} goals={goals} weeklyItems={weeklyItems} milestones={milestones} />
        </CardContent>
      </Card>
    </div>
  );
}
