import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { AlertTriangleIcon, FlagIcon, MessageSquareIcon, SparklesIcon } from "lucide-react";
import { requireUser } from "@/lib/auth/dal";
import { formatKoDate } from "@/lib/dates";
import { allMembers, allTeams, memberById } from "@/lib/members/queries";
import { milestonesInRange } from "@/lib/milestones/queries";
import { OVERDUE_BADGE, isOverdue } from "@/lib/milestones/types";
import { LEAVE_LABEL } from "@/lib/leaves/types";
import { reviewerContext } from "@/lib/reviews/queries";
import { TASK_STATUS_CLASS, TASK_STATUS_MARK } from "@/lib/tasks/types";
import { buildInsights, type MemberInsight } from "@/lib/team/insights";
import { defaultReviewWeek, memberReviewsForWeek } from "@/lib/member-reviews/queries";
import { addDays } from "@/lib/dates";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { LeaderBadge } from "@/components/leader-badge";
import { DailyReviewForm } from "@/components/reviews/daily-review-form";
import { cn } from "@/lib/utils";
import { AssignItemForm, RemoveAssignedButton } from "./assign-item-form";

export const metadata: Metadata = { title: "팀 관리" };

export default async function ManagePage() {
  const user = await requireUser();
  const me = user.memberId != null ? memberById(user.memberId) : undefined;
  const isAdmin = user.role === "admin";
  if (!isAdmin && !me?.isLeader) redirect("/team");

  const teams = allTeams().filter((t) => isAdmin || t.id === me?.teamId);
  const members = allMembers().filter((m) => teams.some((t) => t.id === m.teamId));
  const { insights, summary, today, weekStart, working } = buildInsights(members, user.id);
  const reviewer = reviewerContext(user);
  const msOptions = milestonesInRange(addDays(today, -60), addDays(today, 180)).filter((m) => m.status !== "done" && m.status !== "on_hold");

  const flagged = insights.filter((i) => i.attention.some((a) => a.level === "warn"));
  const reviewable = members.filter((m) => reviewer.canReview(m));
  const reviewWeek = defaultReviewWeek(today);
  const sharedReviews = memberReviewsForWeek(reviewable.map((m) => m.id), reviewWeek).filter((r) => r.status === "shared").length;

  return (
    <div className="grid gap-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold">팀 관리</h2>
          <p className="text-sm text-muted-foreground">
            {formatKoDate(today)}{!working && " · 근무일 아님"} · {teams.map((t) => t.name).join(", ")} · 구성원 {summary.members}명
          </p>
        </div>
        <Link href="/team?view=week" className="text-sm text-muted-foreground hover:underline">주간 기록 보기 →</Link>
      </div>

      {reviewable.length > 0 && (
        <Link href={`/team/reviews?week=${reviewWeek}`} className="group flex flex-wrap items-center gap-3 rounded-xl border border-brand/20 bg-gradient-to-r from-brand-soft to-card px-4 py-3 text-sm transition-shadow hover:shadow-sm">
          <SparklesIcon className="size-4 text-brand" />
          <span className="font-semibold text-accent-foreground">
            {formatKoDate(reviewWeek)} 주 구성원 리뷰 {sharedReviews}/{reviewable.length}명 공유
          </span>
          <span className="text-muted-foreground">{sharedReviews < reviewable.length ? "AI 초안으로 빠르게 리뷰를 마무리하세요." : "이번 주기 리뷰를 모두 마쳤어요."}</span>
          <span className="ml-auto font-medium text-accent-foreground transition-transform group-hover:translate-x-0.5">주간 리뷰 →</span>
        </Link>
      )}

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="오늘 할 일 작성" value={`${summary.planned}/${summary.members - summary.onLeave}`} hint={summary.onLeave ? `휴가 ${summary.onLeave}명 제외` : undefined} />
        <Stat label="이번 주 항목 완료" value={`${summary.weekDone}/${summary.weekTotal}`} hint={summary.weekTotal ? `${Math.round((summary.weekDone / summary.weekTotal) * 100)}%` : "항목 없음"} />
        <Stat label="지난 주 미완료 항목" value={String(summary.overdue)} tone={summary.overdue ? "warn" : undefined} />
        <Stat label="담당 마일스톤" value={`진행 ${summary.milestones.active}`} hint={summary.milestones.overdue ? `지연 ${summary.milestones.overdue}` : `완료 ${summary.milestones.done}`} tone={summary.milestones.overdue ? "warn" : undefined} />
      </div>

      {flagged.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
          <AlertTriangleIcon className="size-4 shrink-0" />
          주의 필요: {flagged.map((i) => i.member.name).join(", ")}
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        {insights.map((ins) => (
          <MemberCard key={ins.member.id} ins={ins} today={today} weekStart={weekStart} canReview={reviewer.canReview(ins.member)} canAssign={isAdmin || (me?.isLeader === true && me.teamId === ins.member.teamId && me.id !== ins.member.id)} msOptions={msOptions.filter((m) => m.teamId === ins.member.teamId).map((m) => ({ id: m.id, title: m.title }))} />
        ))}
      </div>
    </div>
  );
}

function Stat({ label, value, hint, tone }: { label: string; value: string; hint?: string; tone?: "warn" }) {
  return (
    <div className={cn("rounded-xl border bg-card px-4 py-3 shadow-xs", tone === "warn" && "border-amber-200 bg-amber-50/60")}>
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="text-2xl font-semibold tabular-nums">{value}</div>
      {hint && <div className="text-xs text-muted-foreground">{hint}</div>}
    </div>
  );
}

function MemberCard({ ins, today, weekStart, canReview, canAssign, msOptions }: { ins: MemberInsight; today: string; weekStart: string; canReview: boolean; canAssign: boolean; msOptions: { id: number; title: string }[] }) {
  const m = ins.member;
  const doneToday = ins.tasksToday.filter((t) => t.status === "done").length;
  const doneWeek = ins.weekItems.filter((w) => w.status === "done").length;
  const warn = ins.attention.filter((a) => a.level === "warn");
  const info = ins.attention.filter((a) => a.level === "info");
  return (
    <Card className={cn(warn.length > 0 && "border-amber-300/70")}>
      <CardHeader className="pb-3">
        <CardTitle className="flex flex-wrap items-center gap-2 text-base">
          <Link href={`/team?date=${today}`} className="hover:underline">{m.name}</Link>
          {m.isLeader && <LeaderBadge />}
          <span className="text-sm font-normal text-muted-foreground">{m.team} · {m.position}</span>
          {ins.leaveToday && <Badge variant="secondary">오늘 {LEAVE_LABEL[ins.leaveToday.type]}</Badge>}
          <span className="ml-auto flex flex-wrap gap-1">
            {warn.map((a) => (<Badge key={a.key} className="bg-amber-100 text-amber-900">{a.label}</Badge>))}
            {info.map((a) => (<Badge key={a.key} variant="outline" className="text-muted-foreground">{a.label}</Badge>))}
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent className="grid gap-4 text-sm">
        <div className="grid gap-3 md:grid-cols-2">
          <div>
            <div className="mb-1 flex items-center justify-between text-xs text-muted-foreground"><span>오늘 할 일</span><span className="tabular-nums">{doneToday}/{ins.tasksToday.length}</span></div>
            {ins.tasksToday.length === 0 ? <p className="text-xs text-muted-foreground">—</p> : (
              <ul className="grid gap-0.5">
                {ins.tasksToday.map((t) => (<li key={t.id} className="flex items-start gap-1.5 truncate"><span className={cn("shrink-0", TASK_STATUS_CLASS[t.status])}>{TASK_STATUS_MARK[t.status]}</span><span className={cn("truncate", t.status === "done" && "text-muted-foreground line-through")}>{t.title}</span></li>))}
              </ul>
            )}
          </div>
          <div>
            <div className="mb-1 flex items-center justify-between text-xs text-muted-foreground"><span>이번 주 항목</span><span className="tabular-nums">{doneWeek}/{ins.weekItems.length}</span></div>
            <div className="mb-1 h-1.5 overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full bg-emerald-500" style={{ width: `${ins.weekItems.length ? (doneWeek / ins.weekItems.length) * 100 : 0}%` }} /></div>
            {ins.weekItems.length === 0 ? <p className="text-xs text-muted-foreground">—</p> : (
              <ul className="grid gap-0.5">
                {ins.weekItems.map((w) => (<li key={w.id} className="flex items-start gap-1.5 truncate"><span className={cn("shrink-0", TASK_STATUS_CLASS[w.status])}>{TASK_STATUS_MARK[w.status]}</span><span className={cn("truncate", w.status === "done" && "text-muted-foreground line-through")}>{w.title}</span>{w.assignedByName && <span className="shrink-0 rounded bg-violet-100 px-1 text-[10px] text-violet-900">지정</span>}{w.assignedByName && canAssign && <RemoveAssignedButton id={w.id} title={w.title} />}</li>))}
              </ul>
            )}
          </div>
        </div>

        {(ins.overdueItems.length > 0 || ins.ownedMilestones.length > 0) && (
          <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
            {ins.overdueItems.length > 0 && <span>지난 주 미완료: {ins.overdueItems.slice(0, 3).map((w) => w.title).join(", ")}{ins.overdueItems.length > 3 && ` 외 ${ins.overdueItems.length - 3}개`}</span>}
            {ins.ownedMilestones.map((ms) => (
              <Link key={ms.id} href={`/team/milestones?m=${ms.id}`} className={cn("inline-flex items-center gap-1 hover:underline", isOverdue(ms, today) && "text-red-700")}><FlagIcon className="size-3" />{ms.title} {ms.progress}%{isOverdue(ms, today) && <Badge className={cn("h-4 px-1 text-[10px]", OVERDUE_BADGE)}>지연</Badge>}</Link>
            ))}
          </div>
        )}

        <div className="grid gap-2 border-t pt-3 md:grid-cols-2">
          <div className="grid gap-1.5">
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground"><MessageSquareIcon className="size-3.5" />오늘 리뷰{ins.lastReview && ` · 마지막 리뷰 ${formatKoDate(ins.lastReview.date)}`}</div>
            {canReview ? <DailyReviewForm memberId={m.id} memberName={m.name} date={today} existing={ins.myReviewToday ?? undefined} /> : <p className="text-xs text-muted-foreground">리뷰 권한 없음</p>}
          </div>
          <div className="grid gap-1.5">
            <div className="text-xs text-muted-foreground">이번 주 항목 지정</div>
            {canAssign ? <AssignItemForm memberId={m.id} memberName={m.name} weekStart={weekStart} milestones={msOptions} /> : <p className="text-xs text-muted-foreground">지정 권한 없음</p>}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
