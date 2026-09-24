import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { desc, eq } from "drizzle-orm";
import { ArrowLeftIcon, CalendarDaysIcon, FlagIcon, MailIcon, MessageCircleReplyIcon, PencilIcon, PhoneIcon, SparklesIcon } from "lucide-react";
import { requireUser } from "@/lib/auth/dal";
import { addDays, formatKoDate, formatTime, todayKey, weekStartOf } from "@/lib/dates";
import { db, schema } from "@/lib/db";
import { leaveBalance } from "@/lib/leaves/balance";
import { LEAVE_BADGE_CLASS, LEAVE_LABEL, REQUEST_STATUS_CLASS, REQUEST_STATUS_LABEL } from "@/lib/leaves/types";
import { collectMemberWeek } from "@/lib/member-reviews/data";
import { evaluationReference, evaluationsFor } from "@/lib/evaluations/queries";
import { isPeriod, isYear, periodOf, yearSummary } from "@/lib/evaluations/types";
import { openAIConfigured, openAIModel } from "@/lib/reports/openai";
import { memberAccess } from "@/lib/members/access";
import { memberColorMap } from "@/lib/members/colors";
import { allMembers, allTeams, memberById } from "@/lib/members/queries";
import { tenure } from "@/lib/members/types";
import { milestonesInRange } from "@/lib/milestones/queries";
import { STATUS_LABEL, isOverdue } from "@/lib/milestones/types";
import { formatDays } from "@/lib/requests/calc";
import { pendingUsage, requestsFor } from "@/lib/requests/queries";
import { reviewerContext } from "@/lib/reviews/queries";
import { LeaderBadge } from "@/components/leader-badge";
import { RatingBadge, ReviewView } from "@/components/member-reviews/review-view";
import { MemberDialog } from "@/components/members/member-dialog";
import { FadeIn, ProgressBar } from "@/components/motion";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { CreateAccount } from "./create-account";
import { EvaluationForm } from "./evaluation-form";
import { EvaluationNav } from "./evaluation-nav";
import { YearSummaryCard } from "./year-summary";

export const metadata: Metadata = { title: "구성원 상세" };

const WEEKS = 8;
const pct = (a: number, b: number) => (b ? Math.round((a / b) * 100) : null);
const short = (key: string) => key.slice(5).replace("-", "/");

export default async function MemberDetailPage({ params, searchParams }: PageProps<"/team/members/[id]">) {
  const user = await requireUser();
  const { id } = await params;
  const sp = await searchParams;
  const member = memberById(Number(id));
  const access = memberAccess(user);
  if (!member || !access.canManage(member)) notFound();

  const today = todayKey();
  const account = db.select({ id: schema.users.id, email: schema.users.email, username: schema.users.username }).from(schema.users).where(eq(schema.users.memberId, member.id)).get();
  const bal = leaveBalance(member, today);
  const held = pendingUsage(member.id, bal.period.start, bal.period.end);
  const color = memberColorMap(allMembers().map((m) => m.id)).get(member.id);
  const canSeeReviews = reviewerContext(user).canSee(member);
  const canReview = reviewerContext(user).canReview(member);

  // Last WEEKS weeks, newest first: record habits + completion + that week's review.
  const reviews = canSeeReviews ? db.select().from(schema.memberReviews).where(eq(schema.memberReviews.memberId, member.id)).orderBy(desc(schema.memberReviews.weekStart)).limit(20).all() : [];
  const reviewByWeek = new Map(reviews.map((r) => [r.weekStart, r]));
  const thisWeek = weekStartOf(today);
  const weeks = Array.from({ length: WEEKS }, (_, i) => addDays(thisWeek, -7 * i)).map((w) => ({ week: w, stats: collectMemberWeek(member, w).stats, review: reviewByWeek.get(w) }));
  const totals = weeks.slice(1, 5).reduce((a, w) => ({ done: a.done + w.stats.tasksDone, total: a.total + w.stats.tasksTotal, planned: a.planned + w.stats.plannedDays, work: a.work + w.stats.workDays }), { done: 0, total: 0, planned: 0, work: 0 });

  // 인사평가 (quarterly + yearly average): only for evaluators (admin / this member's leader, never self).
  // ?period=2026-Q3 → that quarter's form; ?period=2026 → yearly average; default = current quarter.
  const evaluations = canReview ? evaluationsFor(member.id) : [];
  const period = isPeriod(sp.period) ? sp.period : isYear(sp.period) ? null : periodOf(today);
  const thisYear = Number(today.slice(0, 4));
  const minYear = Math.min(Number(member.joinedAt.slice(0, 4)), ...evaluations.map((e) => Number(e.period.slice(0, 4))));
  const evalYear = Math.min(thisYear, Math.max(minYear, Number((period ?? String(sp.period)).slice(0, 4))));
  const evaluation = period ? evaluations.find((e) => e.period === period) : undefined;
  const savedPeriods = new Map(evaluations.map((e) => [e.period, { status: e.status, total: e.total }]));

  const requests = requestsFor([member.id], 50);
  const owned = milestonesInRange(addDays(today, -365), addDays(today, 365)).filter((ms) => ms.ownerId === member.id && ms.status !== "done");

  return (
    <div className="grid gap-6">
      <Link href="/team/members" className="flex w-fit items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeftIcon className="size-4" />
        구성원 목록
      </Link>

      {/* Profile */}
      <FadeIn>
        <section className="bg-hero flex flex-wrap items-start gap-5 rounded-2xl border p-5 sm:p-6">
          <span className={cn("grid size-16 shrink-0 place-items-center rounded-2xl text-xl font-bold shadow-sm", color?.soft)}>{member.name.slice(-2)}</span>
          <div className="grid min-w-0 flex-1 gap-1.5">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-2xl font-bold tracking-tight">{member.name}</h2>
              {member.isLeader && <LeaderBadge />}
              <Badge variant="secondary">{member.team}</Badge>
            </div>
            <p className="text-sm text-foreground/80">
              {[member.rank, member.position].filter(Boolean).join(" · ")} · 입사 {member.joinedAt} ({tenure(member.joinedAt, today)})
            </p>
            <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground">
              <span className="inline-flex items-center gap-1">
                <MailIcon className="size-3.5" />
                {member.email || "—"}
              </span>
              <span className="inline-flex items-center gap-1">
                <PhoneIcon className="size-3.5" />
                {member.phone || "—"}
              </span>
              <span className="inline-flex items-center gap-1">
                {account ? <span className="text-emerald-700">로그인 계정 있음</span> : <span className="text-amber-700">로그인 계정 없음</span>}
              </span>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {!account && <CreateAccount memberId={member.id} email={member.email} />}
            {canReview && (
              <Button variant="outline" size="sm" asChild>
                <Link href={`/team/reviews?member=${member.id}`}>
                  <SparklesIcon />
                  주간 리뷰 작성
                </Link>
              </Button>
            )}
            <MemberDialog
              member={member}
              teams={allTeams().filter((t) => access.isAdmin || t.id === member.teamId).map((t) => ({ id: t.id, name: t.name }))}
              canSetAnnual={access.canSetAnnual}
              trigger={
                <Button size="sm">
                  <PencilIcon />
                  정보 수정
                </Button>
              }
            />
          </div>
        </section>
      </FadeIn>

      {/* Key numbers */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Tile label="연차 (남은/총)" value={`${formatDays(bal.annual.remaining)} / ${formatDays(bal.annual.total)}일`} ratio={bal.annual.total ? bal.annual.remaining / bal.annual.total : 0} hint={`사용 ${formatDays(bal.annual.used)}일${held.annual ? ` · 승인 대기 ${formatDays(held.annual)}일` : ""}${bal.annual.accrued < bal.annual.total ? ` · 발생 ${formatDays(bal.annual.accrued)}일` : ""}`} />
        <Tile label="병가 (남은/총)" value={`${formatDays(bal.sick.remaining)} / ${formatDays(bal.sick.allowance)}일`} ratio={bal.sick.allowance ? bal.sick.remaining / bal.sick.allowance : 0} hint={`연차 연도 ${short(bal.period.start)} ~ ${short(bal.period.end)}`} />
        <Tile label="최근 4주 목표 완료율" value={pct(totals.done, totals.total) == null ? "—" : `${pct(totals.done, totals.total)}%`} ratio={totals.total ? totals.done / totals.total : 0} hint={`${totals.done}/${totals.total}개 완료`} />
        <Tile label="최근 4주 목표 작성" value={`${totals.planned}/${totals.work}일`} ratio={totals.work ? totals.planned / totals.work : 0} hint="근무일 중 오늘 목표를 쓴 날" />
      </div>

      {canReview && (
        <section id="evaluation" className="grid scroll-mt-20 gap-3">
          <EvaluationNav memberId={member.id} year={evalYear} period={period} minYear={minYear} maxYear={thisYear} today={today} saved={savedPeriods} />
          {period ? (
            <EvaluationForm
              key={period}
              memberId={member.id}
              memberName={member.name}
              period={period}
              initial={{ scores: evaluation?.scores ?? {}, reasons: evaluation?.reasons ?? {}, summary: evaluation?.summary ?? "", strengths: evaluation?.strengths ?? "", improvements: evaluation?.improvements ?? "" }}
              status={evaluation?.status ?? null}
              meta={evaluation ? { evaluatorName: evaluation.evaluatorName, updatedAt: evaluation.updatedAt.getTime(), finalizedAt: evaluation.finalizedAt?.getTime() ?? null, aiModel: evaluation.aiModel, aiGeneratedAt: evaluation.aiGeneratedAt?.getTime() ?? null } : null}
              reference={evaluationReference(member, period)}
              aiReady={openAIConfigured()}
              model={openAIModel()}
            />
          ) : (
            <YearSummaryCard summary={yearSummary(String(evalYear), evaluations)} memberId={member.id} memberName={member.name} />
          )}
        </section>
      )}

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.25fr)_minmax(0,1fr)]">
        {/* Weekly record + reviews */}
        <div className="grid content-start gap-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-base font-bold">주간 기록 · 평가 ({WEEKS}주)</CardTitle>
              <CardDescription>주차를 누르면 그 주 리뷰 화면으로 이동합니다.</CardDescription>
            </CardHeader>
            <CardContent className="overflow-x-auto p-0">
              <table className="w-full min-w-[520px] text-sm">
                <thead className="border-y bg-muted/40 text-xs text-muted-foreground">
                  <tr>
                    <th className="px-4 py-2 text-left font-medium">주차</th>
                    <th className="px-3 py-2 text-right font-medium">목표 작성</th>
                    <th className="px-3 py-2 text-right font-medium">퇴근 정리</th>
                    <th className="px-3 py-2 text-right font-medium">목표 완료</th>
                    <th className="px-3 py-2 text-right font-medium">주간 항목</th>
                    <th className="px-4 py-2 text-left font-medium">평가</th>
                  </tr>
                </thead>
                <tbody>
                  {weeks.map(({ week, stats: s, review }) => {
                    const rate = pct(s.tasksDone, s.tasksTotal);
                    return (
                      <tr key={week} className="border-b last:border-b-0">
                        <td className="px-4 py-2.5 whitespace-nowrap">
                          {canReview ? (
                            <Link href={`/team/reviews?week=${week}&member=${member.id}`} className="font-medium hover:underline">
                              {short(week)} 주
                            </Link>
                          ) : (
                            <span className="font-medium">{short(week)} 주</span>
                          )}
                          {week === thisWeek && <span className="ml-1 text-[10px] text-brand">이번 주</span>}
                        </td>
                        <td className="px-3 py-2.5 text-right tabular-nums">{s.workDays ? `${s.plannedDays}/${s.workDays}일` : "—"}</td>
                        <td className="px-3 py-2.5 text-right tabular-nums">{s.workDays ? `${s.wrapDays}/${s.workDays}일` : "—"}</td>
                        <td className={cn("px-3 py-2.5 text-right tabular-nums", rate != null && rate < 50 && "text-amber-700")}>{rate == null ? "—" : `${rate}% (${s.tasksDone}/${s.tasksTotal})`}</td>
                        <td className="px-3 py-2.5 text-right tabular-nums">{s.itemsTotal ? `${s.itemsDone}/${s.itemsTotal}` : "—"}</td>
                        <td className="px-4 py-2.5">
                          {!review ? (
                            <span className="text-xs text-muted-foreground">{canSeeReviews ? "미작성" : "—"}</span>
                          ) : review.status === "draft" ? (
                            <span className="text-xs text-muted-foreground">초안</span>
                          ) : (
                            <RatingBadge rating={review.rating} />
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </CardContent>
          </Card>

          {canSeeReviews && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base font-bold">주간 평가</CardTitle>
                <CardDescription>공유된 리뷰는 구성원도 볼 수 있습니다. 초안은 팀장·관리자에게만 보입니다.</CardDescription>
              </CardHeader>
              <CardContent className="grid gap-4">
                {reviews.length === 0 && <p className="text-sm text-muted-foreground">아직 작성된 주간 평가가 없습니다.</p>}
                {reviews.map((r) => (
                  <article key={r.id} className="grid gap-3 rounded-xl border p-4">
                    <header className="flex flex-wrap items-center gap-2 text-sm">
                      <b className="font-semibold">
                        {formatKoDate(r.weekStart)} 주
                      </b>
                      <RatingBadge rating={r.rating} />
                      {r.status === "draft" ? (
                        <Badge variant="secondary">초안</Badge>
                      ) : r.ackAt ? (
                        <Badge className="bg-emerald-100 text-emerald-800">구성원 확인</Badge>
                      ) : (
                        <Badge className="bg-brand-soft text-accent-foreground">공유됨 · 미확인</Badge>
                      )}
                      <span className="ml-auto text-xs text-muted-foreground">
                        {r.reviewerName} · {formatTime(r.sharedAt ?? r.updatedAt)}
                      </span>
                    </header>
                    <ReviewView review={r} />
                    {r.reply && (
                      <p className="flex gap-1.5 rounded-lg bg-violet-50 px-3 py-2 text-sm text-violet-950">
                        <MessageCircleReplyIcon className="mt-0.5 size-4 shrink-0 text-violet-600" />
                        <span className="whitespace-pre-wrap">{r.reply}</span>
                      </p>
                    )}
                  </article>
                ))}
              </CardContent>
            </Card>
          )}
        </div>

        {/* Leave + milestones */}
        <div className="grid content-start gap-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base font-bold">
                <CalendarDaysIcon className="size-4 text-sky-600" />
                휴가 품의
              </CardTitle>
              <CardDescription>
                연차 연도 {bal.period.start} ~ {bal.period.end}
                {bal.others.length > 0 && ` · 기타 ${bal.others.map((o) => `${LEAVE_LABEL[o.type]} ${formatDays(o.days)}일`).join(", ")}`}
              </CardDescription>
            </CardHeader>
            <CardContent className="overflow-x-auto p-0">
              {requests.length === 0 ? (
                <p className="px-4 pb-4 text-sm text-muted-foreground">휴가 품의 이력이 없습니다.</p>
              ) : (
                <table className="w-full min-w-[480px] text-sm">
                  <thead className="border-y bg-muted/40 text-xs text-muted-foreground">
                    <tr>
                      <th className="px-4 py-2 text-left font-medium">휴가 기간</th>
                      <th className="px-3 py-2 text-right font-medium">일수</th>
                      <th className="px-3 py-2 text-left font-medium">작성일</th>
                      <th className="px-3 py-2 text-left font-medium">승인일</th>
                      <th className="px-4 py-2 text-left font-medium">상태</th>
                    </tr>
                  </thead>
                  <tbody>
                    {requests.map((r) => (
                      <tr key={r.id} className={cn("border-b last:border-b-0", (r.status === "cancelled" || r.status === "rejected") && "text-muted-foreground")}>
                        <td className="px-4 py-2.5">
                          <Link href={`/schedule/requests/${r.id}`} className="grid gap-0.5 hover:underline">
                            <span className="flex items-center gap-1.5 whitespace-nowrap tabular-nums">
                              <span className={cn("rounded px-1.5 py-0.5 text-[11px] font-medium", LEAVE_BADGE_CLASS[r.type])}>{LEAVE_LABEL[r.type]}</span>
                              {r.startDate === r.endDate ? r.startDate : `${r.startDate} ~ ${short(r.endDate)}`}
                            </span>
                          </Link>
                        </td>
                        <td className="px-3 py-2.5 text-right tabular-nums">{formatDays(r.days)}일</td>
                        <td className="px-3 py-2.5 whitespace-nowrap tabular-nums">{short(r.writtenAt)}</td>
                        <td className="px-3 py-2.5 whitespace-nowrap tabular-nums">{r.status === "approved" && r.decidedAt ? short(todayKey(r.decidedAt)) : "—"}</td>
                        <td className="px-4 py-2.5">
                          <span className={cn("rounded-full px-2 py-0.5 text-[11px] font-semibold", REQUEST_STATUS_CLASS[r.status])}>{REQUEST_STATUS_LABEL[r.status]}</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </CardContent>
          </Card>

          <Card size="sm">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FlagIcon className="size-4 text-brand" />
                담당 마일스톤
              </CardTitle>
            </CardHeader>
            <CardContent className="grid gap-2.5">
              {owned.length === 0 && <p className="text-sm text-muted-foreground">진행 중인 담당 마일스톤이 없습니다.</p>}
              {owned.map((ms) => (
                <Link key={ms.id} href={`/team/milestones?m=${ms.id}`} className="grid gap-1 rounded-lg px-1 py-0.5 hover:bg-muted/50">
                  <span className="flex items-center justify-between gap-2 text-sm">
                    <span className={cn("truncate font-medium", isOverdue(ms, today) && "text-red-700")}>{ms.title}</span>
                    <span className="shrink-0 text-xs text-muted-foreground">
                      {STATUS_LABEL[ms.status]} · ~{short(ms.dueDate)}
                      {isOverdue(ms, today) && " · 지연"}
                    </span>
                  </span>
                  <ProgressBar value={ms.progress / 100} barClassName={isOverdue(ms, today) ? "bg-red-400" : "bg-brand"} />
                </Link>
              ))}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

function Tile({ label, value, ratio, hint }: { label: string; value: string; ratio: number; hint?: string }) {
  return (
    <div className="rounded-xl border bg-card p-3.5 shadow-xs">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="mt-0.5 text-xl font-bold tabular-nums">{value}</div>
      <ProgressBar value={ratio} className="mt-2 h-1" barClassName={ratio < 0.3 ? "bg-amber-400" : "bg-success"} />
      {hint && <div className="mt-1.5 truncate text-[11px] text-muted-foreground">{hint}</div>}
    </div>
  );
}
