import Link from "next/link";
import { and, eq, inArray } from "drizzle-orm";
import { ChevronLeftIcon, ChevronRightIcon } from "lucide-react";
import type { SafeUser } from "@/lib/auth/session";
import { allMembers } from "@/lib/members/queries";
import { addDays, formatKoDate } from "@/lib/dates";
import { db, schema } from "@/lib/db";
import { LEAVE_BADGE_CLASS, LEAVE_LABEL } from "@/lib/leaves/types";
import { groupReviews, reviewerContext, reviewsFor } from "@/lib/reviews/queries";
import { groupTasks, tasksFor } from "@/lib/tasks/queries";
import { DailyReviewForm } from "@/components/reviews/daily-review-form";
import { ReviewList } from "@/components/reviews/review-list";
import { isWorkingDay, loadHolidays } from "@/lib/workdays";
import { TaskLines } from "@/components/task-lines";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { LeaderBadge } from "@/components/leader-badge";
import { cn } from "@/lib/utils";

export function DayView({ user, date, today, toggle }: { user: SafeUser; date: string; today: string; toggle: React.ReactNode }) {
  const holidays = loadHolidays(date, date);
  const working = isWorkingDay(date, holidays);
  const holidayName = holidays.get(date);

  const members = allMembers();
  const ids = members.map((m) => m.id);
  const logs = ids.length ? db.select().from(schema.dailyLogs).where(and(eq(schema.dailyLogs.date, date), inArray(schema.dailyLogs.memberId, ids))).all() : [];
  const leaves = ids.length ? db.select().from(schema.leaves).where(and(eq(schema.leaves.date, date), inArray(schema.leaves.memberId, ids))).all() : [];
  const logByMember = new Map(logs.map((l) => [l.memberId, l]));
  const taskMap = groupTasks(tasksFor(ids, date, date));
  const reviewMap = groupReviews(reviewsFor(ids, date, date));
  const reviewer = reviewerContext(user);
  const canReviewAny = members.some((m) => reviewer.canReview(m));
  const leaveByMember = new Map(leaves.map((l) => [l.memberId, l]));

  const written = members.filter((m) => (taskMap.get(`${m.id}:${date}`)?.length ?? 0) > 0 || logByMember.get(m.id)?.plan.trim()).length;
  const totalTasks = [...taskMap.values()].reduce((n, t) => n + t.length, 0);
  const doneTasks = [...taskMap.values()].reduce((n, t) => n + t.filter((x) => x.status === "done").length, 0);

  return (
    <div className="grid gap-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold">하루 현황</h2>
          <p className="text-sm text-muted-foreground">
            {formatKoDate(date)}
            {date === today && " · 오늘"}
            {!working && <span className="ml-1 text-amber-700">· 근무일 아님{holidayName ? ` (${holidayName})` : ""}</span>}
            {" · "}할 일 작성 {written}/{members.length}명 · 완료 {doneTasks}/{totalTasks} · 휴가 {leaves.length}명
          </p>
        </div>
        <div className="flex items-center gap-2">
          {toggle}
          <Button variant="outline" size="icon" asChild aria-label="이전 날">
            <Link href={`/team?date=${addDays(date, -1)}`}>
              <ChevronLeftIcon className="size-4" />
            </Link>
          </Button>
          <Button variant="outline" size="sm" asChild>
            <Link href="/team">오늘</Link>
          </Button>
          <Button variant="outline" size="icon" asChild aria-label="다음 날">
            <Link href={`/team?date=${addDays(date, 1)}`}>
              <ChevronRightIcon className="size-4" />
            </Link>
          </Button>
        </div>
      </div>

      <div className="rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-44">구성원</TableHead>
              <TableHead className="w-28">상태</TableHead>
              <TableHead>할 일</TableHead>
              <TableHead>한 일{canReviewAny && <span className="ml-1 font-normal text-muted-foreground">· 팀장 리뷰</span>}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {members.length === 0 && (
              <TableRow>
                <TableCell colSpan={4} className="h-20 text-center text-muted-foreground">
                  등록된 구성원이 없습니다.
                </TableCell>
              </TableRow>
            )}
            {members.map((m) => {
              const log = logByMember.get(m.id);
              const leave = leaveByMember.get(m.id);
              const tasks = taskMap.get(`${m.id}:${date}`) ?? [];
              const reviews = reviewer.canSee(m) ? reviewMap.get(`${m.id}:${date}`) ?? [] : [];
              const mine = reviews.find((r) => r.reviewerId === user.id);
              const hasPlan = tasks.length > 0 || !!log?.plan.trim();
              return (
                <TableRow key={m.id} className={cn("align-top", m.id === user.memberId && "bg-muted/40")}>
                  <TableCell>
                    <div className="flex items-center gap-1.5 font-medium">
                      {m.name}
                      {m.isLeader && <LeaderBadge />}
                    </div>
                    <div className="text-xs text-muted-foreground">{m.team}</div>
                  </TableCell>
                  <TableCell>
                    {leave ? (
                      <span className={cn("rounded-md px-2 py-0.5 text-xs font-medium", LEAVE_BADGE_CLASS[leave.type])}>{LEAVE_LABEL[leave.type]}</span>
                    ) : !working ? (
                      <span className="text-xs text-muted-foreground">휴무</span>
                    ) : hasPlan ? (
                      <span className="text-xs text-emerald-700">근무 중</span>
                    ) : (
                      <span className="text-xs text-muted-foreground">미작성</span>
                    )}
                  </TableCell>
                  <TableCell className="whitespace-normal text-sm">
                    <TaskLines tasks={tasks} extra={tasks.length === 0 ? log?.plan : undefined} />
                  </TableCell>
                  <TableCell className="whitespace-normal text-sm">
                    <div className="grid gap-2">
                      <TaskLines tasks={tasks} review extra={log?.done} />
                      <ReviewList reviews={reviews.filter((r) => r.reviewerId !== user.id)} />
                      {mine && !reviewer.canReview(m) && <ReviewList reviews={[mine]} />}
                      {reviewer.canReview(m) && (
                        <DailyReviewForm memberId={m.id} memberName={m.name} date={date} existing={mine?.comment} />
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

    </div>
  );
}
