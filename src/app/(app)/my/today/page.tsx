import type { Metadata } from 'next';
import Link from 'next/link';
import { and, eq, gte, inArray, lte } from 'drizzle-orm';
import {
  ArrowRightIcon,
  CalendarCheckIcon,
  CheckIcon,
  MoonIcon,
  PalmtreeIcon,
  SunIcon,
  SunriseIcon,
} from 'lucide-react';
import { leaveBalance } from '@/lib/leaves/balance';
import { LEAVE_LABEL } from '@/lib/leaves/types';
import { formatDays } from '@/lib/requests/calc';
import { requireUser } from '@/lib/auth/dal';
import {
  addDays,
  currentHourKST,
  formatKoDate,
  formatTime,
  todayKey,
  weekStartOf,
} from '@/lib/dates';
import { db, schema } from '@/lib/db';
import { saveDailyLog } from '@/lib/logs/actions';
import { teamScopedMembers } from '@/lib/members/access';
import { milestoneAccess } from '@/lib/milestones/permissions';
import {
  myMilestoneRequests,
  pendingMilestones,
} from '@/lib/milestones/queries';
import { myOpenRequests, pendingRequestsFor } from '@/lib/requests/queries';
import { myOpenOvertime, pendingOvertimeFor } from '@/lib/overtime/queries';
import { myOpenGeneral, pendingGeneralFor } from '@/lib/general/queries';
import { myOpenTaxi, pendingTaxiFor } from '@/lib/taxi/queries';
import { myOpenDinner, pendingDinnerFor } from '@/lib/dinner/queries';
import {
  myMilestones,
  myMilestoneTasks,
  tasksToReview,
} from '@/lib/milestones/task-queries';
import { myTasks, tasksFor } from '@/lib/tasks/queries';
import { isWorkingDay, loadHolidays, weekInfo } from '@/lib/workdays';
import { FadeIn, ProgressBar, ProgressRing } from '@/components/motion';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { TextEntryForm } from '@/components/forms/text-entry-form';
import { cn } from '@/lib/utils';
import { TodayGoals } from './today-goals';
import { ApprovalInbox, MyRequests } from './approvals';
import { MyMilestoneTasks } from './my-milestone-tasks';
import { MyMilestones } from './my-milestones';
import { WeekLeaves } from './week-leaves';

export const metadata: Metadata = { title: '오늘' };

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
        .where(
          and(
            inArray(schema.leaves.memberId, memberIds),
            gte(schema.leaves.date, weekStart),
            lte(schema.leaves.date, weekEnd),
          ),
        )
        .all()
    : [];

  const me =
    user.memberId != null
      ? members.find((m) => m.id === user.memberId)
      : undefined;
  const myLog = me
    ? db
        .select()
        .from(schema.dailyLogs)
        .where(
          and(
            eq(schema.dailyLogs.memberId, me.id),
            eq(schema.dailyLogs.date, today),
          ),
        )
        .get()
    : undefined;
  const tasks = me ? myTasks(me.id, today) : [];
  const myLeaveToday = me
    ? weekLeaves.find((l) => l.memberId === me.id && l.date === today)
    : undefined;

  // Previous working day with unfinished items not already on today's list → offer carry-over.
  let carryFrom: { date: string; label: string; count: number } | null = null;
  if (me) {
    let prev = addDays(today, -1);
    for (let i = 0; i < 10 && !isWorkingDay(prev, holidays); i++)
      prev = addDays(prev, -1);
    const todayTitles = new Set(tasks.map((t) => t.title));
    const pendingPrev = myTasks(me.id, prev).filter(
      (t) => t.status !== 'done' && !todayTitles.has(t.title),
    ).length;
    if (pendingPrev > 0)
      carryFrom = { date: prev, label: formatKoDate(prev), count: pendingPrev };
  }

  const balance = me ? leaveBalance(me, today) : null;
  const myWeekly = me
    ? db
        .select()
        .from(schema.weeklyReports)
        .where(
          and(
            eq(schema.weeklyReports.memberId, me.id),
            eq(schema.weeklyReports.weekStart, weekStart),
          ),
        )
        .get()
    : undefined;
  // 주간 보고 is due from the week's last working day until the week ends.
  const reported = !!myWeekly?.result.trim();
  const weeklyDue =
    !!me && !!week.lastWorkingDay && today >= week.lastWorkingDay && !reported;
  const weekTasks = me ? tasksFor([me.id], weekStart, today) : [];

  // Day flow: 출근(목표 설정) → 근무(진행) → 퇴근 전(정리).
  const done = tasks.filter((t) => t.status === 'done').length;
  const planned = tasks.length > 0;
  const wrapped =
    planned &&
    (tasks.every((t) => t.status !== 'todo' || t.reviewedAt) ||
      !!myLog?.done.trim());
  const step = !planned ? 0 : wrapped ? 3 : hour >= 16 ? 2 : 1;
  const greeting = !working
    ? '편안한 휴일 보내세요'
    : hour < 12
      ? '좋은 아침이에요'
      : hour < 18
        ? '오늘도 힘내세요'
        : '오늘도 수고 많으셨어요';
  const tip = !me
    ? null
    : !working
      ? '근무일이 아니에요. 필요하면 기록만 남겨 두세요.'
      : step === 0
        ? '출근하셨나요? 오늘 꼭 끝낼 목표 3~5개를 적어 보세요.'
        : step === 1
          ? '좋아요! 끝낸 목표는 바로바로 체크해 두세요.'
          : step === 2
            ? '퇴근 전에 완료한 목표를 체크하고, 계획에 없던 일을 적어 주세요.'
            : '오늘 기록을 모두 마쳤어요. 내일 또 만나요!';

  const weekDone = weekTasks.filter((t) => t.status === 'done').length;
  const toApprove = pendingMilestones(milestoneAccess(user).approveTeamIds);
  const myRequests = myMilestoneRequests(user.id);
  const leavesToApprove = pendingRequestsFor(user);
  const myLeaveRequests = me ? myOpenRequests(me.id) : [];
  const overtimeToApprove = pendingOvertimeFor(user);
  const myOvertime = me ? myOpenOvertime(me.id) : [];
  const generalToApprove = pendingGeneralFor(user);
  const myGeneral = me ? myOpenGeneral(me.id) : [];
  const taxiToApprove = pendingTaxiFor(user);
  const myTaxi = me ? myOpenTaxi(me.id) : [];
  const dinnerToApprove = pendingDinnerFor(user);
  const myDinner = me ? myOpenDinner(me.id) : [];
  const msTasks = me ? myMilestoneTasks(me.id) : [];
  const msReviews = tasksToReview(user);
  const myMs = me ? myMilestones(me.id) : [];
  const onToday = new Set(
    tasks.map((t) => t.milestoneTaskId).filter((v): v is number => v != null),
  );
  // Chip on today's goals that came from a milestone 작업: task id → milestone title.
  const msLinkTitle: Record<number, string> = {};
  for (const t of msTasks) msLinkTitle[t.id] = t.milestoneTitle;
  const userNames = new Map(
    toApprove.length
      ? db
          .select({ id: schema.users.id, name: schema.users.name })
          .from(schema.users)
          .all()
          .map((u) => [u.id, u.name])
      : [],
  );

  return (
    <div className='grid gap-6'>
      {/* Hero */}
      <FadeIn>
        <section className=' relative overflow-hidden rounded-2xl'>
          <div className='flex flex-wrap items-center justify-between gap-6'>
            <div className='grid gap-1'>
              <p className='text-2xl font-bold tracking-tight sm:text-[1.7rem]'>
                {formatKoDate(today)}
                {holidayName && (
                  <span className='ml-1.5 text-red-600'>· {holidayName}</span>
                )}
                {myLeaveToday && (
                  <span className='ml-1.5 font-medium text-accent-foreground'>
                    · 오늘 {LEAVE_LABEL[myLeaveToday.type]}
                  </span>
                )}
              </p>
            </div>
            {me && planned && (
              <ProgressRing
                value={tasks.length ? done / tasks.length : 0}
                size={84}
                stroke={8}
              >
                <div className='leading-none'>
                  <div className='text-lg font-bold tabular-nums'>
                    {done}
                    <span className='text-sm font-medium text-muted-foreground'>
                      /{tasks.length}
                    </span>
                  </div>
                  <div className='mt-1 text-[10px] font-medium text-muted-foreground'>
                    완료
                  </div>
                </div>
              </ProgressRing>
            )}
          </div>
          {me && working && (
            <ol className='mt-5 grid grid-cols-3 gap-2 text-xs sm:text-sm'>
              {[
                { icon: SunriseIcon, label: '출근', sub: '오늘 목표 설정' },
                { icon: SunIcon, label: '근무 중', sub: '완료한 목표 체크' },
                { icon: MoonIcon, label: '퇴근 전', sub: '오늘 한 일 정리' },
              ].map((s, i) => {
                const isDone = step > i;
                const isCurrent = step === i;
                const Icon = s.icon;
                return (
                  <li
                    key={s.label}
                    className={cn(
                      'flex items-center gap-2.5 rounded-xl border px-3 py-2 transition-colors',
                      isCurrent
                        ? 'border-brand/40 bg-card shadow-sm'
                        : isDone
                          ? 'border-transparent bg-card/60'
                          : 'border-transparent bg-card/40 text-muted-foreground',
                    )}
                    aria-current={isCurrent ? 'step' : undefined}
                  >
                    <span
                      className={cn(
                        'grid size-7 shrink-0 place-items-center rounded-full',
                        isDone
                          ? 'bg-success text-white'
                          : isCurrent
                            ? 'bg-brand text-white'
                            : 'bg-muted',
                      )}
                    >
                      {isDone ? (
                        <CheckIcon className='size-4' strokeWidth={3} />
                      ) : (
                        <Icon className='size-4' />
                      )}
                    </span>
                    <span className='min-w-0'>
                      <span className='block font-semibold'>{s.label}</span>
                      <span className='hidden truncate text-xs text-muted-foreground sm:block'>
                        {s.sub}
                      </span>
                    </span>
                  </li>
                );
              })}
            </ol>
          )}
        </section>
      </FadeIn>

      {myMs.length > 0 && (
        <FadeIn delay={0.02}>
          <MyMilestones items={myMs} today={today} />
        </FadeIn>
      )}

      {toApprove.length +
        leavesToApprove.length +
        overtimeToApprove.length +
        generalToApprove.length +
        taxiToApprove.length +
        dinnerToApprove.length >
        0 && (
        <FadeIn delay={0.03}>
          <ApprovalInbox
            leaves={leavesToApprove}
            overtime={overtimeToApprove}
            general={generalToApprove}
            taxi={taxiToApprove}
            dinner={dinnerToApprove}
            milestones={toApprove}
            proposerName={userNames}
          />
        </FadeIn>
      )}

      {me ? (
        <div className='grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px]'>
          <div className='grid content-start gap-6'>
            <FadeIn delay={0.05}>
              <Card className={cn(step <= 1 && working && 'ring-brand/25')}>
                <CardHeader>
                  <CardTitle className='flex items-center gap-2 text-lg font-bold'>
                    오늘 목표
                    {morning && !planned && <Badge>지금 작성</Badge>}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <TodayGoals
                    date={today}
                    tasks={tasks}
                    carryFrom={carryFrom}
                    milestoneLinks={msLinkTitle}
                    morning={morning}
                  />
                </CardContent>
              </Card>
            </FadeIn>

            <FadeIn delay={0.1}>
              <Card className={cn(step === 2 && 'ring-brand/25')}>
                <CardHeader>
                  <CardTitle className='flex items-center gap-2 text-lg font-bold'>
                    퇴근 전 정리
                    {working && !morning && !wrapped && (
                      <Badge>지금 작성</Badge>
                    )}
                    {wrapped && (
                      <Badge className='bg-emerald-100 text-emerald-800'>
                        완료
                      </Badge>
                    )}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <TextEntryForm
                    action={saveDailyLog.bind(null, today, 'done')}
                    defaultValue={myLog?.done ?? ''}
                    placeholder='계획에 없던 일, 이슈'
                    savedLabel={formatTime(myLog?.doneUpdatedAt)}
                    rows={3}
                  />
                </CardContent>
              </Card>
            </FadeIn>
          </div>

          <aside className='grid content-start gap-4'>
            {myRequests.length +
              myLeaveRequests.length +
              myOvertime.length +
              myGeneral.length +
              myTaxi.length +
              myDinner.length >
              0 && (
              <FadeIn delay={0.1}>
                <MyRequests
                  leaves={myLeaveRequests}
                  overtime={myOvertime}
                  general={myGeneral}
                  taxi={myTaxi}
                  dinner={myDinner}
                  milestones={myRequests}
                />
              </FadeIn>
            )}

            {msTasks.length + msReviews.length > 0 && (
              <FadeIn delay={0.11}>
                <MyMilestoneTasks
                  tasks={msTasks.map((t) => ({
                    id: t.id,
                    title: t.title,
                    status: t.status,
                    dueDate: t.dueDate,
                    milestoneId: t.milestoneId,
                    milestoneTitle: t.milestoneTitle,
                    reviewNote: t.reviewNote,
                    onToday: onToday.has(t.id),
                  }))}
                  reviews={msReviews.map((r) => ({
                    id: r.id,
                    title: r.title,
                    milestoneId: r.milestoneId,
                    milestoneTitle: r.milestoneTitle,
                    assigneeName: r.assigneeName,
                  }))}
                  today={today}
                />
              </FadeIn>
            )}

            <FadeIn delay={0.12}>
              <Card
                size='sm'
                className={cn(weeklyDue && 'ring-2 ring-brand/35')}
              >
                <CardHeader>
                  <CardTitle className='flex items-center justify-between'>
                    <span>주간 보고</span>
                    {reported ? (
                      <span className='text-xs font-medium text-emerald-700'>
                        작성함
                      </span>
                    ) : (
                      <span
                        className={cn(
                          'text-xs',
                          weeklyDue
                            ? 'font-semibold text-brand'
                            : 'font-normal text-muted-foreground',
                        )}
                      >
                        {weeklyDue ? '오늘 작성' : '미작성'}
                      </span>
                    )}
                  </CardTitle>
                </CardHeader>
                <CardContent className='grid gap-3'>
                  <div className='grid gap-1'>
                    <div className='flex items-center justify-between text-xs text-muted-foreground'>
                      <span>이번 주 목표 완료</span>
                      <span className='tabular-nums'>
                        {weekDone}/{weekTasks.length}
                      </span>
                    </div>
                    <ProgressBar
                      value={weekTasks.length ? weekDone / weekTasks.length : 0}
                    />
                  </div>
                  <p className='text-xs text-muted-foreground'>
                    {reported
                      ? `마지막 저장 ${formatTime(myWeekly?.resultUpdatedAt)}`
                      : `매주 마지막 근무일${week.lastWorkingDay ? `(${formatKoDate(week.lastWorkingDay)})` : ''}에 한 주를 정리해 팀장에게 보고합니다.`}
                  </p>
                  <Button
                    variant={weeklyDue ? 'default' : 'outline'}
                    size='sm'
                    asChild
                    className='w-full'
                  >
                    <Link href='/my/week'>
                      <CalendarCheckIcon />
                      {reported ? '주간 보고 보기' : '주간 보고 작성'}
                    </Link>
                  </Button>
                </CardContent>
              </Card>
            </FadeIn>

            {balance && (
              <FadeIn delay={0.16}>
                <Link
                  href='/schedule/requests'
                  className='group flex items-center gap-3 rounded-xl border bg-card px-4 py-3 text-sm shadow-xs transition-colors hover:border-brand/30'
                >
                  <span className='grid size-9 place-items-center rounded-lg bg-sky-50 text-sky-700'>
                    <PalmtreeIcon className='size-4.5' />
                  </span>
                  <span className='min-w-0 flex-1'>
                    <span className='block text-xs text-muted-foreground'>
                      남은 휴가
                    </span>
                    <span className='font-semibold tabular-nums'>
                      연차 {formatDays(balance.annual.remaining)}일 · 병가{' '}
                      {formatDays(balance.sick.remaining)}일
                    </span>
                  </span>
                  <ArrowRightIcon className='size-4 text-muted-foreground transition-transform group-hover:translate-x-0.5' />
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
              일일·주간 기록을 작성하려면{' '}
              <Link
                href='/admin/members'
                className='underline underline-offset-4'
              >
                구성원 관리
              </Link>
              에서 이 계정을 구성원과 연결하세요.
            </CardDescription>
          </CardHeader>
        </Card>
      )}

      <FadeIn delay={0.15}>
        <WeekLeaves
          days={week.days}
          today={today}
          holidays={holidays}
          members={members}
          leaves={weekLeaves}
          myMemberId={user.memberId}
        />
      </FadeIn>
    </div>
  );
}
