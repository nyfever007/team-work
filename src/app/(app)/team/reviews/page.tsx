import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { CheckCheckIcon, ChevronLeftIcon, ChevronRightIcon, CircleDashedIcon, FileTextIcon, FlagIcon, MessageCircleReplyIcon, SendIcon } from "lucide-react";
import { requireUser } from "@/lib/auth/dal";
import { addDays, formatKoDate, isValidKey, todayKey, weekStartOf } from "@/lib/dates";
import type { MemberReview } from "@/lib/db/schema";
import { LEAVE_BADGE_CLASS, LEAVE_LABEL } from "@/lib/leaves/types";
import { collectMemberWeek, hasRecords, renderMemberWeek, weekStatsFor, type MemberWeek, type MemberWeekStats } from "@/lib/member-reviews/data";
import { defaultReviewWeek, memberReviewsForWeek } from "@/lib/member-reviews/queries";
import { allMembers } from "@/lib/members/queries";
import { memberColorMap } from "@/lib/members/colors";
import { STATUS_LABEL } from "@/lib/milestones/types";
import { openAIConfigured, openAIModel } from "@/lib/reports/openai";
import { reviewerContext } from "@/lib/reviews/queries";
import { TASK_STATUS_CLASS, TASK_STATUS_MARK } from "@/lib/tasks/types";
import { FadeIn, ProgressBar } from "@/components/motion";
import { TaskLines } from "@/components/task-lines";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { ReviewForm } from "./review-form";

export const metadata: Metadata = { title: "주간 리뷰" };

type State = { key: "none" | "draft" | "shared" | "acked" | "replied"; label: string; className: string; icon: typeof SendIcon };

function stateOf(r: MemberReview | undefined): State {
  if (!r) return { key: "none", label: "미작성", className: "text-muted-foreground bg-muted", icon: CircleDashedIcon };
  if (r.status === "draft") return { key: "draft", label: "초안", className: "bg-slate-100 text-slate-700", icon: FileTextIcon };
  if (r.reply) return { key: "replied", label: "답글 있음", className: "bg-violet-100 text-violet-800", icon: MessageCircleReplyIcon };
  if (r.ackAt) return { key: "acked", label: "확인함", className: "bg-emerald-100 text-emerald-800", icon: CheckCheckIcon };
  return { key: "shared", label: "공유됨", className: "bg-brand-soft text-accent-foreground", icon: SendIcon };
}

const pct = (a: number, b: number) => (b ? Math.round((a / b) * 100) : 0);

export default async function MemberReviewsPage({ searchParams }: PageProps<"/team/reviews">) {
  const user = await requireUser();
  const sp = await searchParams;
  const reviewer = reviewerContext(user);
  const members = allMembers().filter((m) => reviewer.canReview(m));
  if (user.role !== "admin" && members.length === 0) redirect("/team");

  const today = todayKey();
  const thisWeek = weekStartOf(today);
  const suggested = defaultReviewWeek(today);
  const weekStart = isValidKey(sp.week) ? weekStartOf(sp.week) : suggested;
  const reviews = new Map(memberReviewsForWeek(members.map((m) => m.id), weekStart).map((r) => [r.memberId, r]));
  const stats = weekStatsFor(members, weekStart);
  const colors = memberColorMap(allMembers().map((m) => m.id));

  // Selected member: requested, else the first one without a shared review, else the first.
  const requested = Number(sp.member);
  const selected = members.find((m) => m.id === requested) ?? members.find((m) => reviews.get(m.id)?.status !== "shared") ?? members[0];
  const sharedCount = members.filter((m) => reviews.get(m.id)?.status === "shared").length;
  const href = (p: { week?: string; member?: number }) => `/team/reviews?week=${p.week ?? weekStart}${p.member ?? selected?.id ? `&member=${p.member ?? selected?.id}` : ""}`;
  // Pin the selection in the URL; otherwise sharing (which revalidates) would jump to the next unreviewed member.
  if (selected && selected.id !== requested) redirect(href({ member: selected.id }));
  const idx = selected ? members.findIndex((m) => m.id === selected.id) : -1;
  const nextPending = members.slice(idx + 1).concat(members.slice(0, idx)).find((m) => reviews.get(m.id)?.status !== "shared");

  const teams = [...new Set(members.map((m) => m.team))];

  return (
    <div className="grid gap-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold">구성원 주간 리뷰</h2>
          <p className="text-sm text-muted-foreground">
            {formatKoDate(weekStart)} ~ {formatKoDate(addDays(weekStart, 6))}
            {weekStart === thisWeek && " · 이번 주"}
            {weekStart === suggested && weekStart !== thisWeek && " · 리뷰할 주"}
            {" · "}공유 {sharedCount}/{members.length}명
          </p>
        </div>
        <div className="flex items-center gap-1">
          <Button variant="outline" size="icon" asChild aria-label="이전 주">
            <Link href={href({ week: addDays(weekStart, -7) })}>
              <ChevronLeftIcon className="size-4" />
            </Link>
          </Button>
          <Button variant="outline" size="sm" asChild>
            <Link href={href({ week: suggested })}>리뷰할 주</Link>
          </Button>
          <Button variant="outline" size="icon" asChild aria-label="다음 주" disabled={weekStart >= thisWeek}>
            <Link href={href({ week: addDays(weekStart, 7) })} aria-disabled={weekStart >= thisWeek}>
              <ChevronRightIcon className="size-4" />
            </Link>
          </Button>
        </div>
      </div>

      {members.length === 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>리뷰할 구성원이 없습니다</CardTitle>
            <CardDescription>팀장은 같은 팀 구성원을, 관리자는 모든 구성원을 리뷰할 수 있습니다.</CardDescription>
          </CardHeader>
        </Card>
      ) : (
        <div className="grid gap-6 lg:grid-cols-[260px_minmax(0,1fr)]">
          <nav aria-label="구성원" className="grid content-start gap-4">
            <div className="rounded-xl border bg-card p-3 shadow-xs">
              <div className="mb-2 flex items-center justify-between text-xs text-muted-foreground">
                <span>이번 주 리뷰 진행</span>
                <span className="font-semibold text-foreground tabular-nums">{pct(sharedCount, members.length)}%</span>
              </div>
              <ProgressBar value={members.length ? sharedCount / members.length : 0} barClassName="bg-brand" />
            </div>
            {teams.map((team) => (
              <div key={team} className="grid gap-1">
                {teams.length > 1 && <div className="px-2 text-xs font-semibold text-muted-foreground">{team}</div>}
                {members
                  .filter((m) => m.team === team)
                  .map((m) => {
                    const st = stateOf(reviews.get(m.id));
                    const s = stats.get(m.id)!;
                    const active = m.id === selected?.id;
                    const Icon = st.icon;
                    return (
                      <Link
                        key={m.id}
                        href={href({ member: m.id })}
                        aria-current={active ? "page" : undefined}
                        className={cn("flex items-center gap-3 rounded-xl border px-3 py-2.5 transition-all", active ? "border-brand/40 bg-card shadow-sm ring-1 ring-brand/20" : "border-transparent hover:bg-card hover:shadow-xs")}
                      >
                        <span className={cn("grid size-9 shrink-0 place-items-center rounded-full text-sm font-bold", colors.get(m.id)?.soft)}>{m.name.slice(-2)}</span>
                        <span className="min-w-0 flex-1">
                          <span className="flex items-center gap-1.5">
                            <span className="truncate text-sm font-semibold">{m.name}</span>
                          </span>
                          <span className="block truncate text-xs text-muted-foreground tabular-nums">
                            완료율 {pct(s.tasksDone, s.tasksTotal)}% · 작성 {s.plannedDays}/{s.workDays}일
                          </span>
                        </span>
                        <span className={cn("inline-flex shrink-0 items-center gap-1 rounded-full px-1.5 py-0.5 text-[10px] font-semibold", st.className)}>
                          <Icon className="size-3" />
                          {st.label}
                        </span>
                      </Link>
                    );
                  })}
              </div>
            ))}
          </nav>

          {selected && (
            <FadeIn key={`${selected.id}:${weekStart}`} className="grid min-w-0 content-start gap-6">
              <Workspace
                week={collectMemberWeek(selected, weekStart)}
                review={reviews.get(selected.id)}
                stats={stats.get(selected.id)!}
                today={today}
                nextPending={nextPending && nextPending.id !== selected.id ? { name: nextPending.name, href: href({ member: nextPending.id }) } : null}
              />
            </FadeIn>
          )}
        </div>
      )}
    </div>
  );
}

function Workspace({ week, review, stats: s, today, nextPending }: { week: MemberWeek; review: MemberReview | undefined; stats: MemberWeekStats; today: string; nextPending: { name: string; href: string } | null }) {
  const m = week.member;
  const records = hasRecords(week);
  const tiles = [
    { label: "목표 작성", value: `${s.plannedDays}/${s.workDays}일`, ratio: s.workDays ? s.plannedDays / s.workDays : 0 },
    { label: "퇴근 정리", value: `${s.wrapDays}/${s.workDays}일`, ratio: s.workDays ? s.wrapDays / s.workDays : 0 },
    { label: "일일 목표 완료", value: `${s.tasksDone}/${s.tasksTotal}`, ratio: s.tasksTotal ? s.tasksDone / s.tasksTotal : 0 },
    { label: "주간 항목 완료", value: `${s.itemsDone}/${s.itemsTotal}`, ratio: s.itemsTotal ? s.itemsDone / s.itemsTotal : 0 },
  ];

  return (
    <>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <h3 className="text-xl font-bold tracking-tight">{m.name}</h3>
        <span className="text-sm text-muted-foreground">
          {m.team} · {m.position}
          {m.rank && ` · ${m.rank}`}
        </span>
        {week.leaves.length > 0 && (
          <span className="flex flex-wrap gap-1">
            {week.leaves.map((l) => (
              <span key={l.id} className={cn("rounded-full px-2 py-0.5 text-[11px] font-medium", LEAVE_BADGE_CLASS[l.type])}>
                {l.date.slice(5).replace("-", "/")} {LEAVE_LABEL[l.type]}
              </span>
            ))}
          </span>
        )}
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {tiles.map((t) => (
          <div key={t.label} className="rounded-xl border bg-card p-3 shadow-xs">
            <div className="text-xs text-muted-foreground">{t.label}</div>
            <div className="mt-0.5 text-xl font-bold tabular-nums">{t.value}</div>
            <ProgressBar value={t.ratio} className="mt-2 h-1" barClassName={t.ratio < 0.5 ? "bg-amber-400" : "bg-success"} />
          </div>
        ))}
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
        <Card className="min-w-0 self-start">
          <CardHeader>
            <CardTitle className="text-base font-bold">이번 주 기록</CardTitle>
            <CardDescription>구성원이 직접 남긴 기록입니다. AI 초안도 이 내용만 근거로 씁니다.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-5 text-sm">
            {week.prevReview && week.prevReview.nextActions.trim() && (
              <section className="rounded-xl border border-dashed border-brand/30 p-3">
                <h4 className="mb-1 text-xs font-semibold text-accent-foreground">지난주 요청한 할 일</h4>
                <ul className="grid gap-0.5 text-sm">
                  {week.prevReview.nextActions.split("\n").filter(Boolean).map((a, i) => {
                    const item = week.items.find((w) => w.title === a.trim());
                    return (
                      <li key={i} className="flex items-start gap-1.5">
                        <span className={cn("shrink-0", item ? TASK_STATUS_CLASS[item.status] : "text-muted-foreground")}>{item ? TASK_STATUS_MARK[item.status] : "·"}</span>
                        <span className={cn(item?.status === "done" && "text-muted-foreground line-through")}>{a}</span>
                      </li>
                    );
                  })}
                </ul>
              </section>
            )}

            <section>
              <h4 className="mb-1.5 text-xs font-semibold text-muted-foreground">주간 항목</h4>
              {week.items.length === 0 ? (
                <p className="text-muted-foreground">없음</p>
              ) : (
                <ul className="grid gap-1">
                  {week.items.map((w) => (
                    <li key={w.id} className="flex items-start gap-1.5">
                      <span className={cn("shrink-0", TASK_STATUS_CLASS[w.status])}>{TASK_STATUS_MARK[w.status]}</span>
                      <span className={cn("flex-1", w.status === "done" && "text-muted-foreground line-through")}>{w.title}</span>
                      {w.assignedByName && <span className="shrink-0 rounded-full bg-violet-100 px-1.5 text-[10px] text-violet-900">지정</span>}
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <section>
              <h4 className="mb-1.5 text-xs font-semibold text-muted-foreground">일별 목표 · 결과</h4>
              <ol className="relative grid gap-3 border-l pl-4">
                {week.days.length === 0 && <li className="text-muted-foreground">아직 지난 근무일이 없습니다.</li>}
                {week.days.map((d) => {
                  const ts = week.tasks.filter((t) => t.date === d);
                  const extra = week.extras.find((e) => e.date === d)?.text;
                  const leave = week.leaves.find((l) => l.date === d);
                  const comments = week.dailyReviews.filter((r) => r.date === d);
                  return (
                    <li key={d} className="relative">
                      <span className={cn("absolute top-1.5 -left-[21px] size-2.5 rounded-full border-2 border-card", ts.length ? "bg-brand" : "bg-muted-foreground/30")} />
                      <div className="mb-0.5 flex items-center gap-1.5 text-xs font-medium">
                        {formatKoDate(d)}
                        {d === today && <span className="rounded bg-brand px-1 text-[10px] text-white">오늘</span>}
                        {leave && <span className={cn("rounded px-1 text-[10px]", LEAVE_BADGE_CLASS[leave.type])}>{LEAVE_LABEL[leave.type]}</span>}
                      </div>
                      <TaskLines tasks={ts} review extra={extra} emptyText="기록 없음" />
                      {comments.map((c) => (
                        <p key={c.id} className="mt-1 rounded-md bg-amber-50 px-2 py-1 text-xs text-amber-900">
                          {c.reviewerName}: {c.comment}
                        </p>
                      ))}
                    </li>
                  );
                })}
              </ol>
            </section>

            {week.result && (
              <section>
                <h4 className="mb-1.5 text-xs font-semibold text-muted-foreground">본인 작성 주간 성과</h4>
                <p className="whitespace-pre-wrap rounded-lg bg-muted/50 p-3">{week.result}</p>
              </section>
            )}

            {week.milestones.length > 0 && (
              <section>
                <h4 className="mb-1.5 text-xs font-semibold text-muted-foreground">관련 마일스톤</h4>
                <ul className="grid gap-1">
                  {week.milestones.map((ms) => (
                    <li key={ms.id}>
                      <Link href={`/team/milestones?m=${ms.id}`} className={cn("inline-flex items-center gap-1.5 hover:underline", ms.overdue && "text-red-700")}>
                        <FlagIcon className="size-3.5" />
                        {ms.title} · {STATUS_LABEL[ms.status]} {ms.progress}%{ms.overdue && " · 지연"}
                      </Link>
                    </li>
                  ))}
                </ul>
              </section>
            )}
          </CardContent>
        </Card>

        <ReviewForm
          key={`${m.id}:${week.weekStart}`}
          memberId={m.id}
          memberName={m.name}
          weekStart={week.weekStart}
          nextWeekLabel={formatKoDate(addDays(week.weekStart, 7))}
          initial={{ summary: review?.summary ?? "", strengths: review?.strengths ?? "", improvements: review?.improvements ?? "", nextActions: review?.nextActions ?? "", rating: (review?.rating as 1 | 2 | 3 | 4 | 5 | null) ?? null }}
          status={review?.status ?? null}
          meta={review ? { reviewerName: review.reviewerName, updatedAt: review.updatedAt.getTime(), sharedAt: review.sharedAt?.getTime() ?? null, ackAt: review.ackAt?.getTime() ?? null, model: review.model } : null}
          reply={review?.reply ? { text: review.reply, at: review.repliedAt?.getTime() ?? null } : null}
          aiReady={openAIConfigured()}
          model={openAIModel()}
          hasRecords={records}
          sourceText={renderMemberWeek(week)}
          nextPending={nextPending}
        />
      </div>
    </>
  );
}
