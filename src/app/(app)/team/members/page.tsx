import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { and, eq, inArray, isNotNull } from "drizzle-orm";
import { ChevronRightIcon, UserPlusIcon } from "lucide-react";
import { requireUser } from "@/lib/auth/dal";
import { todayKey } from "@/lib/dates";
import { db, schema } from "@/lib/db";
import { leaveBalance } from "@/lib/leaves/balance";
import { memberAccess } from "@/lib/members/access";
import { memberColorMap } from "@/lib/members/colors";
import { allMembers, allTeams } from "@/lib/members/queries";
import { tenure } from "@/lib/members/types";
import { gradeOf, periodLabel } from "@/lib/evaluations/types";
import { reviewerContext } from "@/lib/reviews/queries";
import { formatDays } from "@/lib/requests/calc";
import { LeaderBadge } from "@/components/leader-badge";
import { RatingBadge } from "@/components/member-reviews/review-view";
import { MemberDialog } from "@/components/members/member-dialog";
import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "구성원" };

export default async function TeamMembersPage() {
  const user = await requireUser();
  const access = memberAccess(user);
  if (access.teamIds !== "all" && access.teamIds.length === 0) redirect("/team");

  const today = todayKey();
  const everyone = allMembers();
  const members = everyone.filter((m) => access.canManage(m));
  const teams = allTeams().filter((t) => access.canManageTeam(t.id));
  const ids = members.map((m) => m.id);
  const colors = memberColorMap(everyone.map((m) => m.id));

  const withAccount = new Set(ids.length ? db.select({ id: schema.users.memberId }).from(schema.users).where(and(isNotNull(schema.users.memberId), inArray(schema.users.memberId, ids))).all().map((r) => r.id) : []);
  const pending = new Map<number, number>();
  if (ids.length) for (const r of db.select({ memberId: schema.leaveRequests.memberId }).from(schema.leaveRequests).where(and(eq(schema.leaveRequests.status, "submitted"), inArray(schema.leaveRequests.memberId, ids))).all()) pending.set(r.memberId, (pending.get(r.memberId) ?? 0) + 1);
  // Latest shared review per member (rows are few; pick the max week in JS).
  const latestReview = new Map<number, { rating: number | null; weekStart: string }>();
  if (ids.length) {
    for (const r of db.select({ memberId: schema.memberReviews.memberId, rating: schema.memberReviews.rating, weekStart: schema.memberReviews.weekStart }).from(schema.memberReviews).where(and(eq(schema.memberReviews.status, "shared"), inArray(schema.memberReviews.memberId, ids))).all()) {
      const cur = latestReview.get(r.memberId);
      if (!cur || r.weekStart > cur.weekStart) latestReview.set(r.memberId, r);
    }
  }
  // Latest finalized 인사평가 per member — only for members this user may evaluate (never their own).
  const reviewer = reviewerContext(user);
  const latestEval = new Map<number, { period: string; total: number | null }>();
  if (ids.length) {
    for (const e of db.select({ memberId: schema.memberEvaluations.memberId, period: schema.memberEvaluations.period, total: schema.memberEvaluations.total }).from(schema.memberEvaluations).where(and(eq(schema.memberEvaluations.status, "final"), inArray(schema.memberEvaluations.memberId, ids))).all()) {
      const cur = latestEval.get(e.memberId);
      if (!cur || e.period > cur.period) latestEval.set(e.memberId, e);
    }
  }
  const rows = members.map((m) => ({ m, bal: leaveBalance(m, today), ev: reviewer.canReview(m) ? latestEval.get(m.id) : undefined }));

  return (
    <div className="grid gap-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold">구성원</h2>
          <p className="text-sm text-muted-foreground">
            {access.isAdmin ? "전체 팀" : teams.map((t) => t.name).join(", ")} · {members.length}명 · 이름을 누르면 상세 정보와 평가, 휴가 이력을 볼 수 있습니다.
          </p>
        </div>
        {teams.length > 0 && (
          <MemberDialog
            teams={teams.map((t) => ({ id: t.id, name: t.name }))}
            canSetAnnual={access.canSetAnnual}
            trigger={
              <Button>
                <UserPlusIcon />
                구성원 추가
              </Button>
            }
          />
        )}
      </div>

      {members.length === 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>아직 구성원이 없습니다</CardTitle>
            <CardDescription>‘구성원 추가’로 팀원을 등록하세요. 초기 비밀번호를 넣으면 로그인 계정도 함께 만들어집니다.</CardDescription>
          </CardHeader>
        </Card>
      ) : (
        <div className="overflow-x-auto rounded-xl border bg-card shadow-xs">
          <table className="w-full min-w-[960px] text-sm">
            <thead className="border-b bg-muted/40 text-xs text-muted-foreground">
              <tr>
                <th className="px-4 py-2.5 text-left font-medium">이름</th>
                {access.isAdmin && <th className="px-3 py-2.5 text-left font-medium">팀</th>}
                <th className="px-3 py-2.5 text-left font-medium">직급</th>
                <th className="px-3 py-2.5 text-left font-medium">직책 · 직무</th>
                <th className="px-3 py-2.5 text-left font-medium">입사일</th>
                <th className="px-3 py-2.5 text-right font-medium">연차 (남은/총)</th>
                <th className="px-3 py-2.5 text-right font-medium">병가 (남은/총)</th>
                <th className="px-3 py-2.5 text-left font-medium">주간 리뷰</th>
                <th className="px-3 py-2.5 text-left font-medium">인사평가</th>
                <th className="w-8" />
              </tr>
            </thead>
            <tbody>
              {rows.map(({ m, bal, ev }) => {
                const lowAnnual = bal.annual.total > 0 && bal.annual.remaining / bal.annual.total <= 0.2;
                const review = latestReview.get(m.id);
                return (
                  <tr key={m.id} className="group relative border-b transition-colors last:border-b-0 hover:bg-accent/40">
                    <td className="px-4 py-3">
                      <Link href={`/team/members/${m.id}`} className="flex items-center gap-3 after:absolute after:inset-0">
                        <span className={cn("grid size-9 shrink-0 place-items-center rounded-full text-xs font-bold", colors.get(m.id)?.soft)}>{m.name.slice(-2)}</span>
                        <span className="min-w-0">
                          <span className="flex items-center gap-1.5 font-semibold">
                            {m.name}
                            {m.isLeader && <LeaderBadge />}
                          </span>
                          <span className="flex flex-wrap gap-1 text-xs text-muted-foreground">
                            {m.email || "이메일 없음"}
                            {!withAccount.has(m.id) && <span className="rounded bg-amber-100 px-1 text-[10px] font-medium text-amber-900">계정 없음</span>}
                            {pending.get(m.id) ? <span className="rounded bg-brand-soft px-1 text-[10px] font-medium text-accent-foreground">휴가 승인 대기 {pending.get(m.id)}</span> : null}
                          </span>
                        </span>
                      </Link>
                    </td>
                    {access.isAdmin && <td className="px-3 py-3 text-muted-foreground">{m.team}</td>}
                    <td className="px-3 py-3">{m.rank || <span className="text-muted-foreground">—</span>}</td>
                    <td className="px-3 py-3">{m.position}</td>
                    <td className="px-3 py-3 whitespace-nowrap tabular-nums">
                      {m.joinedAt}
                      <span className="block text-xs text-muted-foreground">{tenure(m.joinedAt, today)}</span>
                    </td>
                    <td className="px-3 py-3 text-right whitespace-nowrap tabular-nums">
                      <span className={cn("font-semibold", lowAnnual && "text-amber-700")}>{formatDays(bal.annual.remaining)}</span>
                      <span className="text-muted-foreground"> / {formatDays(bal.annual.total)}일</span>
                      {bal.annual.accrued < bal.annual.total && <span className="block text-[11px] text-muted-foreground">발생 {formatDays(bal.annual.accrued)}일</span>}
                    </td>
                    <td className="px-3 py-3 text-right whitespace-nowrap tabular-nums">
                      <span className="font-semibold">{formatDays(bal.sick.remaining)}</span>
                      <span className="text-muted-foreground"> / {formatDays(bal.sick.allowance)}일</span>
                    </td>
                    <td className="px-3 py-3">
                      {review ? (
                        <span className="flex flex-col items-start gap-0.5">
                          <RatingBadge rating={review.rating} />
                          <span className="text-[11px] text-muted-foreground">{review.weekStart.slice(5).replace("-", "/")} 주</span>
                        </span>
                      ) : (
                        <span className="text-xs text-muted-foreground">없음</span>
                      )}
                    </td>
                    <td className="px-3 py-3">
                      {ev ? (
                        <span className="flex flex-col items-start gap-0.5">
                          <span className={cn("rounded-full px-2 py-0.5 text-xs font-bold", gradeOf(ev.total)?.className)}>
                            {gradeOf(ev.total)?.grade} · {ev.total?.toFixed(1)}
                          </span>
                          <span className="text-[11px] text-muted-foreground">{periodLabel(ev.period)}</span>
                        </span>
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </td>
                    <td className="pr-3 text-muted-foreground">
                      <ChevronRightIcon className="size-4 transition-transform group-hover:translate-x-0.5" />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
