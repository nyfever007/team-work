import type { Metadata } from "next";
import Link from "next/link";
import { and, eq, gte, inArray, lte } from "drizzle-orm";
import { ArrowRightIcon, CalendarCheckIcon, CheckIcon, MessageSquareHeartIcon, MessageSquareIcon, MoonIcon, PalmtreeIcon, SunIcon, SunriseIcon } from "lucide-react";
import { leaveBalance } from "@/lib/leaves/balance";
import { LEAVE_LABEL } from "@/lib/leaves/types";
import { formatDays } from "@/lib/requests/calc";
import { requireUser } from "@/lib/auth/dal";
import { addDays, currentHourKST, formatKoDate, formatTime, todayKey, weekStartOf } from "@/lib/dates";
import { db, schema } from "@/lib/db";
import { saveDailyLog } from "@/lib/logs/actions";
import { teamScopedMembers } from "@/lib/members/access";
import { sharedReviewsFor } from "@/lib/member-reviews/queries";
import { milestoneAccess } from "@/lib/milestones/permissions";
import { myMilestoneRequests, pendingMilestones } from "@/lib/milestones/queries";
import { myOpenRequests, pendingRequestsFor } from "@/lib/requests/queries";
import { weeklyItemsFor } from "@/lib/plans/queries";
import { reviewsFor } from "@/lib/reviews/queries";
import { myTasks } from "@/lib/tasks/queries";
import { TASK_STATUS_CLASS, TASK_STATUS_MARK } from "@/lib/tasks/types";
import { isWorkingDay, loadHolidays, weekInfo } from "@/lib/workdays";
import { FadeIn, ProgressBar, ProgressRing } from "@/components/motion";
import { MemberResponse } from "@/components/member-reviews/member-response";
import { RatingBadge, ReviewView } from "@/components/member-reviews/review-view";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { TextEntryForm } from "@/components/forms/text-entry-form";
import { cn } from "@/lib/utils";
import { TodayGoals } from "./today-goals";
import { ApprovalInbox, MyRequests } from "./approvals";
import { WeekLeaves } from "./week-leaves";

export const metadata: Metadata = { title: "오늘" };

export default async function TodayPage() {
  const user = await requireUser();
  const today = todayKey();
  const hour = currentHourKST();
  const weekStart = weekStartOf(today);
  const weekEnd = addDays(weekStart, 6);
  const holidays = loadHolidays(addDays(today, -14), weekEnd);
  const week = weekInfo(weekStart, holidays);
  const working = isWorkingDay(today, holidays);
  const holidayName = holidays.get(today);
  const morning = working && hour < 14;

  const members = teamScopedMembers(user); // week leave timeline: own team only (admin: everyone)
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
  const myLeaveToday = me ? weekLeaves.find((l) => l.memberId === me.id && l.date === today) : undefined;

  // Previous working day with unfinished items not already on today's list → offer carry-over.
  let carryFrom: { date: string; label: string; count: number } | null = null;
  if (me) {
    let prev = addDays(today, -1);
    for (let i = 0; i < 10 && !isWorkingDay(prev, holidays); i++) prev = addDays(prev, -1);
    const todayTitles = new Set(tasks.map((t) => t.title));
    const pendingPrev = myTasks(me.id, prev).filter((t) => t.status !== "done" && !todayTitles.has(t.title)).length;
    if (pendingPrev > 0) carryFrom = { date: prev, label: formatKoDate(prev), count: pendingPrev };
  }

  const balance = me ? leaveBalance(me, today) : null;
  const latestReview = me ? sharedReviewsFor(me.id, 1)[0] : undefined;
  const recentComments = me ? reviewsFor([me.id], addDays(today, -14), today).slice(-2).reverse() : [];
  const myWeekly = me
    ? db.select().from(schema.weeklyReports).where(and(eq(schema.weeklyReports.memberId, me.id), eq(schema.weeklyReports.weekStart, weekStart))).get()
    : undefined;
  const isFirstWD = today === week.firstWorkingDay;
  const isLastWD = today === week.lastWorkingDay;
  const weeklyDue = !!me && ((isFirstWD && weeklyItems.length === 0) || (isLastWD && !myWeekly?.result.trim()));

  // Day flow: 출근(목표 설정) → 근무(진행) → 퇴근 전(정리).
  const done = tasks.filter((t) => t.status === "done").length;
  const planned = tasks.length > 0;
  const wrapped = planned && (tasks.every((t) => t.status !== "todo" || t.reviewedAt) || !!myLog?.done.trim());
  const step = !planned ? 0 : wrapped ? 3 : hour >= 16 ? 2 : 1;
  const greeting = !working ? "편안한 휴일 보내세요" : hour < 12 ? "좋은 아침이에요" : hour < 18 ? "오늘도 힘내세요" : "오늘도 수고 많으셨어요";
  const tip = !me
    ? null
    : !working
      ? "근무일이 아니에요. 필요하면 기록만 남겨 두세요."
      : step === 0
        ? "출근하셨나요? 오늘 꼭 끝낼 목표 3~5개를 적어 보세요."
        : step === 1
          ? "좋아요! 끝낸 목표는 바로바로 체크해 두세요."
          : step === 2
            ? "퇴근 전에 완료한 목표를 체크하고, 계획에 없던 일을 적어 주세요."
            : "오늘 기록을 모두 마쳤어요. 내일 또 만나요!";

  const weekDone = weeklyItems.filter((w) => w.status === "done").length;
  const toApprove = pendingMilestones(milestoneAccess(user).approveTeamIds);
  const myRequests = myMilestoneRequests(user.id);
  const leavesToApprove = pendingRequestsFor(user);
  const myLeaveRequests = me ? myOpenRequests(me.id) : [];
  const userNames = new Map(toApprove.length ? db.select({ id: schema.users.id, name: schema.users.name }).from(schema.users).all().map((u) => [u.id, u.name]) : []);

  return (
    <div className="grid gap-6">
      {/* Hero */}
      <FadeIn>
        <section className="bg-hero relative overflow-hidden rounded-2xl border p-5 sm:p-6">
          <div className="flex flex-wrap items-center justify-between gap-6">
            <div className="grid gap-1">
              <p className="text-sm text-muted-foreground">
                {formatKoDate(today)}
                {holidayName && <span className="ml-1.5 text-red-600">· {holidayName}</span>}
                {myLeaveToday && <span className="ml-1.5 font-medium text-accent-foreground">· 오늘 {LEAVE_LABEL[myLeaveToday.type]}</span>}
              </p>
              <h2 className="text-2xl font-bold tracking-tight sm:text-[1.7rem]">
                {greeting}, <span className="text-brand">{user.name}</span>님
              </h2>
              {tip && <p className="text-sm text-foreground/75">{tip}</p>}
            </div>
            {me && planned && (
              <ProgressRing value={tasks.length ? done / tasks.length : 0} size={84} stroke={8}>
                <div className="leading-none">
                  <div className="text-lg font-bold tabular-nums">
                    {done}
                    <span className="text-sm font-medium text-muted-foreground">/{tasks.length}</span>
                  </div>
                  <div className="mt-1 text-[10px] font-medium text-muted-foreground">완료</div>
                </div>
              </ProgressRing>
            )}
          </div>
          {me && working && (
            <ol className="mt-5 grid grid-cols-3 gap-2 text-xs sm:text-sm">
              {[
                { icon: SunriseIcon, label: "출근", sub: "오늘 목표 설정" },
                { icon: SunIcon, label: "근무 중", sub: "완료한 목표 체크" },
                { icon: MoonIcon, label: "퇴근 전", sub: "오늘 한 일 정리" },
              ].map((s, i) => {
                const isDone = step > i;
                const isCurrent = step === i;
                const Icon = s.icon;
                return (
                  <li
                    key={s.label}
                    className={cn(
                      "flex items-center gap-2.5 rounded-xl border px-3 py-2 transition-colors",
                      isCurrent ? "border-brand/40 bg-card shadow-sm" : isDone ? "border-transparent bg-card/60" : "border-transparent bg-card/40 text-muted-foreground",
                    )}
                    aria-current={isCurrent ? "step" : undefined}
                  >
                    <span className={cn("grid size-7 shrink-0 place-items-center rounded-full", isDone ? "bg-success text-white" : isCurrent ? "bg-brand text-white" : "bg-muted")}>
                      {isDone ? <CheckIcon className="size-4" strokeWidth={3} /> : <Icon className="size-4" />}
                    </span>
                    <span className="min-w-0">
                      <span className="block font-semibold">{s.label}</span>
                      <span className="hidden truncate text-xs text-muted-foreground sm:block">{s.sub}</span>
                    </span>
                  </li>
                );
              })}
            </ol>
          )}
        </section>
      </FadeIn>

      {toApprove.length + leavesToApprove.length > 0 && (
        <FadeIn delay={0.03}>
          <ApprovalInbox leaves={leavesToApprove} milestones={toApprove} proposerName={userNames} />
        </FadeIn>
      )}

      {me ? (
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
          <div className="grid content-start gap-6">
            <FadeIn delay={0.05}>
              <Card className={cn(step <= 1 && working && "ring-brand/25")}>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-lg font-bold">
                    오늘 목표
                    {morning && !planned && <Badge>지금 작성</Badge>}
                  </CardTitle>
                  <CardDescription>한 줄씩 적고, 끝나면 동그라미를 눌러 체크하세요. 제목을 누르면 수정할 수 있어요.</CardDescription>
                </CardHeader>
                <CardContent>
                  <TodayGoals date={today} tasks={tasks} carryFrom={carryFrom} weeklyItems={weeklyItems} morning={morning} />
                </CardContent>
              </Card>
            </FadeIn>

            <FadeIn delay={0.1}>
              <Card className={cn(step === 2 && "ring-brand/25")}>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-lg font-bold">
                    퇴근 전 정리
                    {working && !morning && !wrapped && <Badge>지금 작성</Badge>}
                    {wrapped && <Badge className="bg-emerald-100 text-emerald-800">완료</Badge>}
                  </CardTitle>
                  <CardDescription>목표 체크 외에 계획에 없던 일, 이슈, 내일로 넘길 일을 짧게 적어 주세요. 팀장이 주간 리뷰 때 참고합니다.</CardDescription>
                </CardHeader>
                <CardContent>
                  <TextEntryForm
                    action={saveDailyLog.bind(null, today, "done")}
                    defaultValue={myLog?.done ?? ""}
                    placeholder={"예) 장애 대응으로 배포 1시간 지연\n예) 내일 API 스펙 리뷰 요청 예정"}
                    savedLabel={formatTime(myLog?.doneUpdatedAt)}
                    rows={3}
                  />
                </CardContent>
              </Card>
            </FadeIn>
          </div>

          <aside className="grid content-start gap-4">
            <FadeIn delay={0.08}>
              <FeedbackCard review={latestReview} comments={recentComments} />
            </FadeIn>

            {myRequests.length + myLeaveRequests.length > 0 && (
              <FadeIn delay={0.1}>
                <MyRequests leaves={myLeaveRequests} milestones={myRequests} />
              </FadeIn>
            )}

            <FadeIn delay={0.12}>
              <Card size="sm">
                <CardHeader>
                  <CardTitle className="flex items-center justify-between">
                    <span>이번 주 항목</span>
                    <span className="text-xs font-normal text-muted-foreground tabular-nums">
                      {weekDone}/{weeklyItems.length} 완료
                    </span>
                  </CardTitle>
                </CardHeader>
                <CardContent className="grid gap-3">
                  {weeklyItems.length > 0 ? (
                    <>
                      <ProgressBar value={weekDone / weeklyItems.length} />
                      <ul className="grid gap-1 text-sm">
                        {weeklyItems.slice(0, 5).map((w) => (
                          <li key={w.id} className="flex items-start gap-1.5">
                            <span className={cn("shrink-0", TASK_STATUS_CLASS[w.status])}>{TASK_STATUS_MARK[w.status]}</span>
                            <span className={cn("min-w-0 flex-1 truncate", w.status === "done" && "text-muted-foreground line-through")}>{w.title}</span>
                            {w.assignedByName && <span className="shrink-0 rounded-full bg-violet-100 px-1.5 text-[10px] text-violet-900">지정</span>}
                          </li>
                        ))}
                        {weeklyItems.length > 5 && <li className="text-xs text-muted-foreground">외 {weeklyItems.length - 5}개</li>}
                      </ul>
                    </>
                  ) : (
                    <p className="text-sm text-muted-foreground">이번 주 항목이 없어요.</p>
                  )}
                  <Button variant={weeklyDue ? "default" : "outline"} size="sm" asChild className="w-full">
                    <Link href="/my/week">
                      <CalendarCheckIcon />
                      {weeklyDue ? `이번 주 ${isFirstWD ? "할 일" : "성과"} 작성하기` : "이번 주 계획 보기"}
                    </Link>
                  </Button>
                </CardContent>
              </Card>
            </FadeIn>

            {balance && (
              <FadeIn delay={0.16}>
                <Link href="/schedule/requests" className="group flex items-center gap-3 rounded-xl border bg-card px-4 py-3 text-sm shadow-xs transition-colors hover:border-brand/30">
                  <span className="grid size-9 place-items-center rounded-lg bg-sky-50 text-sky-700">
                    <PalmtreeIcon className="size-4.5" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-xs text-muted-foreground">남은 휴가</span>
                    <span className="font-semibold tabular-nums">
                      연차 {formatDays(balance.annual.remaining)}일 · 병가 {formatDays(balance.sick.remaining)}일
                    </span>
                  </span>
                  <ArrowRightIcon className="size-4 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
                </Link>
              </FadeIn>
            )}
          </aside>
        </div>
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

      <FadeIn delay={0.15}>
        <WeekLeaves days={week.days} today={today} holidays={holidays} members={members} leaves={weekLeaves} myMemberId={user.memberId} />
      </FadeIn>
    </div>
  );
}

function FeedbackCard({ review, comments }: { review: ReturnType<typeof sharedReviewsFor>[number] | undefined; comments: ReturnType<typeof reviewsFor> }) {
  const unread = !!review && !review.ackAt;
  return (
    <Card size="sm" className={cn(unread && "ring-2 ring-brand/40")}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <MessageSquareHeartIcon className="size-4 text-brand" />
          팀장 피드백
          {unread && (
            <span className="relative ml-auto flex size-2.5">
              <span className="absolute inline-flex size-full animate-ping rounded-full bg-brand opacity-60" />
              <span className="relative inline-flex size-2.5 rounded-full bg-brand" />
            </span>
          )}
        </CardTitle>
        {review && (
          <CardDescription className="flex flex-wrap items-center gap-1.5">
            {formatKoDate(review.weekStart).replace(/ \(.\)$/, "")} 주 · {review.reviewerName}
            <RatingBadge rating={review.rating} />
          </CardDescription>
        )}
      </CardHeader>
      <CardContent className="grid gap-3">
        {review ? (
          <>
            <ReviewView review={review} compact />
            <div className="flex flex-wrap items-center justify-between gap-2">
              <MemberResponse reviewId={review.id} acked={!!review.ackAt} reply={review.reply} reviewerName={review.reviewerName} showReply={false} />
              <Link href="/my/feedback" className="text-xs font-medium text-accent-foreground hover:underline">
                전체 보기 →
              </Link>
            </div>
          </>
        ) : comments.length === 0 ? (
          <p className="text-sm text-muted-foreground">아직 받은 피드백이 없어요. 팀장이 매주 리뷰를 남기면 여기에 표시됩니다.</p>
        ) : null}
        {comments.length > 0 && (
          <ul className={cn("grid gap-1.5", review && "border-t pt-3")}>
            {comments.map((c) => (
              <li key={c.id} className="text-sm">
                <div className="flex items-center gap-1 text-xs text-muted-foreground">
                  <MessageSquareIcon className="size-3" />
                  {formatKoDate(c.date)} · {c.reviewerName}
                </div>
                <p className="line-clamp-2">{c.comment}</p>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
