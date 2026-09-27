import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ChevronLeftIcon, ChevronRightIcon, LockIcon, ScaleIcon } from "lucide-react";
import { requireUser } from "@/lib/auth/dal";
import { todayKey } from "@/lib/dates";
import { evaluationsForPeriod } from "@/lib/evaluations/queries";
import { DISTRIBUTION, GRADES, GRADE_LETTERS, currentPeriod, gradeOf, levelOf, periodLabel, periodRange, relativeGrade, shiftPeriod, type Grade } from "@/lib/evaluations/types";
import { allMembers } from "@/lib/members/queries";
import { reviewerContext } from "@/lib/reviews/queries";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { FinalGradeSelect } from "./final-grade";

export const metadata: Metadata = { title: "고과평가" };

const gradeClass = (g: string | null) => GRADES.find((x) => x.grade === g)?.className ?? "bg-muted text-muted-foreground";

/**
 * 분기 고과평가 (leaders/admin, private): 절대평가 = the quarter evaluation's grade; 상대평가 = rank within the team mapped
 * onto the forced distribution (S 10 · A 20 · B 40 · C 20 · D 10 %); 최종 고과 = the leader's pick (member_evaluations.final_grade).
 */
export default async function AppraisalPage({ searchParams }: PageProps<"/team/appraisal">) {
  const user = await requireUser();
  const reviewer = reviewerContext(user);
  const members = allMembers().filter((m) => reviewer.canReview(m));
  if (members.length === 0) redirect("/team");

  const sp = await searchParams;
  const today = todayKey();
  const requested = typeof sp.period === "string" ? sp.period : "";
  const quarter = levelOf(requested) === "quarter" && periodRange(requested).start <= today ? requested : currentPeriod("quarter", today);
  const prev = shiftPeriod(quarter, -1);
  const next = shiftPeriod(quarter, 1);
  const evals = new Map(evaluationsForPeriod(members.map((m) => m.id), quarter).map((e) => [e.memberId, e]));
  const teams = [...new Set(members.map((m) => m.team))];

  return (
    <div className="grid gap-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2 text-lg font-bold">
            <ScaleIcon className="size-5 text-brand" />
            고과평가
          </h2>
          <p className="flex items-center gap-1 text-sm text-muted-foreground">
            <LockIcon className="size-3.5" />
            팀장·관리자 전용 · 분기 인사평가를 바탕으로 절대평가와 팀 내 상대평가를 함께 보고 최종 고과를 정합니다.
          </p>
        </div>
        <div className="flex items-center gap-1">
          <Button variant="outline" size="icon" asChild aria-label="이전 분기">
            <Link href={`/team/appraisal?period=${prev}`}><ChevronLeftIcon className="size-4" /></Link>
          </Button>
          <span className="min-w-28 text-center text-sm font-semibold">{periodLabel(quarter)}</span>
          <Button variant="outline" size="icon" asChild aria-label="다음 분기" disabled={periodRange(next).start > today}>
            <Link href={`/team/appraisal?period=${next}`} aria-disabled={periodRange(next).start > today}><ChevronRightIcon className="size-4" /></Link>
          </Button>
        </div>
      </div>

      {teams.map((team) => {
        const inTeam = members.filter((m) => m.team === team);
        const rated = inTeam
          .map((m) => ({ m, e: evals.get(m.id) }))
          .filter((r) => r.e?.total != null)
          .sort((a, b) => b.e!.total! - a.e!.total!);
        // Standard competition ranking (ties share a rank).
        const ranks = new Map<number, number>();
        rated.forEach((r, i) => ranks.set(r.m.id, i > 0 && rated[i - 1].e!.total === r.e!.total ? ranks.get(rated[i - 1].m.id)! : i + 1));
        const unrated = inTeam.filter((m) => !rated.some((r) => r.m.id === m.id));
        const finals = inTeam.map((m) => evals.get(m.id)?.finalGrade).filter((g): g is string => !!g);
        return (
          <Card key={team}>
            <CardHeader>
              <CardTitle className="text-base font-bold">{team}</CardTitle>
              <CardDescription>
                평가 {rated.length}/{inTeam.length}명 · 확정 {inTeam.filter((m) => evals.get(m.id)?.status === "final").length}명 · 최종 고과 {finals.length}명
              </CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4">
              <div className="overflow-x-auto rounded-xl border">
                <table className="w-full min-w-[720px] text-sm">
                  <thead className="border-b bg-muted/40 text-xs text-muted-foreground">
                    <tr>
                      <th className="px-3 py-2 text-left font-medium">순위</th>
                      <th className="px-3 py-2 text-left font-medium">구성원</th>
                      <th className="px-3 py-2 text-right font-medium">분기 총점</th>
                      <th className="px-3 py-2 text-center font-medium">절대평가</th>
                      <th className="px-3 py-2 text-center font-medium">상대평가</th>
                      <th className="px-3 py-2 text-left font-medium">평가 상태</th>
                      <th className="px-3 py-2 text-left font-medium">최종 고과</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rated.map(({ m, e }) => {
                      const rank = ranks.get(m.id)!;
                      const abs = gradeOf(e!.total)?.grade ?? null;
                      const rel = relativeGrade(rank, rated.length);
                      return (
                        <tr key={m.id} className="border-b last:border-b-0">
                          <td className="px-3 py-2.5 tabular-nums">
                            {rank}
                            <span className="text-xs text-muted-foreground">/{rated.length}</span>
                          </td>
                          <td className="px-3 py-2.5">
                            <Link href={`/team/members/${m.id}?period=${quarter}#evaluation`} className="font-medium hover:underline">{m.name}</Link>
                            <div className="text-xs text-muted-foreground">{[m.rank, m.position].filter(Boolean).join(" · ")}</div>
                          </td>
                          <td className="px-3 py-2.5 text-right font-semibold tabular-nums">{e!.total!.toFixed(1)}</td>
                          <td className="px-3 py-2.5 text-center"><span className={cn("rounded-full px-2 py-0.5 text-xs font-bold", gradeClass(abs))}>{abs}</span></td>
                          <td className="px-3 py-2.5 text-center"><span className={cn("rounded-full px-2 py-0.5 text-xs font-bold", gradeClass(rel))}>{rel}</span></td>
                          <td className="px-3 py-2.5 text-xs">{e!.status === "final" ? <span className="text-emerald-700">확정</span> : <span className="text-muted-foreground">초안</span>}</td>
                          <td className="px-3 py-2.5">
                            <FinalGradeSelect memberId={m.id} quarter={quarter} value={(e!.finalGrade as Grade | null) ?? null} suggested={abs === rel ? (abs as Grade) : null} />
                          </td>
                        </tr>
                      );
                    })}
                    {unrated.map((m) => (
                      <tr key={m.id} className="border-b text-muted-foreground last:border-b-0">
                        <td className="px-3 py-2.5">—</td>
                        <td className="px-3 py-2.5">
                          <Link href={`/team/members/${m.id}?period=${quarter}#evaluation`} className="font-medium text-foreground hover:underline">{m.name}</Link>
                        </td>
                        <td className="px-3 py-2.5 text-right" colSpan={5}>
                          분기 인사평가 미작성 ·{" "}
                          <Link href={`/team/members/${m.id}?period=${quarter}#evaluation`} className="text-accent-foreground hover:underline">작성하기 →</Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="flex flex-wrap items-center gap-2 text-xs">
                <span className="text-muted-foreground">최종 고과 분포</span>
                {GRADE_LETTERS.map((g) => {
                  const n = finals.filter((f) => f === g).length;
                  const rec = Math.round((DISTRIBUTION.find((d) => d.grade === g)!.share) * rated.length * 10) / 10;
                  return (
                    <span key={g} className={cn("inline-flex items-center gap-1 rounded-full px-2 py-0.5 font-semibold", gradeClass(g))}>
                      {g} {n}
                      <span className="font-normal opacity-70">/ 권장 {rec}</span>
                    </span>
                  );
                })}
                <span className="text-muted-foreground">· 상대평가 분포: S 10% · A 20% · B 40% · C 20% · D 10%</span>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
