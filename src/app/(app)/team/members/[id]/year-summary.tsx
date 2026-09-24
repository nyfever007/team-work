import Link from "next/link";
import { ClipboardCheckIcon, LockIcon } from "lucide-react";
import { CRITERIA, MAX_SCORE, QUARTERS, gradeOf, quarterKey, type YearSummary } from "@/lib/evaluations/types";
import { ProgressBar } from "@/components/motion";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

/** Read-only yearly average computed from finalized quarters. */
export function YearSummaryCard({ summary: s, memberId, memberName }: { summary: YearSummary; memberId: number; memberName: string }) {
  const grade = gradeOf(s.total);
  const byQuarter = new Map(s.quarters.map((q) => [q.period, q.total]));
  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-center gap-2">
          <CardTitle className="flex items-center gap-2 text-lg font-bold">
            <ClipboardCheckIcon className="size-5 text-brand" />
            {s.year}년 연평균
          </CardTitle>
          <span className="ml-auto flex items-center gap-1 text-xs text-muted-foreground">
            <LockIcon className="size-3" />팀장·관리자만 볼 수 있습니다
          </span>
        </div>
        <CardDescription>
          {memberName}님의 {s.year}년 확정된 분기 평가 {s.quarters.length}개의 평균입니다.
          {s.drafts > 0 && ` 임시 저장 상태인 ${s.drafts}개 분기는 포함하지 않았습니다.`}
        </CardDescription>
      </CardHeader>
      <CardContent>
        {s.quarters.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">아직 확정된 분기 평가가 없습니다. 분기 탭에서 평가를 작성하고 확정하면 연평균이 계산됩니다.</p>
        ) : (
          <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_260px]">
            <ul className="grid gap-2.5">
              {CRITERIA.map((c) => {
                const v = s.criteria[c.key];
                return (
                  <li key={c.key} className="grid grid-cols-[110px_minmax(0,1fr)_48px] items-center gap-3 text-sm">
                    <span className="font-medium">{c.label}</span>
                    <ProgressBar value={v != null ? v / MAX_SCORE : 0} className="h-2" barClassName={v == null ? "bg-muted" : v <= 4 ? "bg-red-400" : v <= 6 ? "bg-amber-400" : v <= 8 ? "bg-sky-500" : "bg-brand"} />
                    <span className="text-right font-semibold tabular-nums">{v != null ? v.toFixed(1) : "—"}</span>
                  </li>
                );
              })}
            </ul>
            <div className="grid content-start gap-3">
              <div className="rounded-2xl border bg-gradient-to-br from-brand-soft to-card p-4 text-center">
                <div className="text-xs font-medium text-muted-foreground">연평균 총점</div>
                <div className="mt-1 text-4xl font-bold tabular-nums">
                  {s.total != null ? s.total.toFixed(1) : "–"}
                  <span className="text-sm font-normal text-muted-foreground"> / {MAX_SCORE}</span>
                </div>
                {grade && <span className={cn("mt-2 inline-flex rounded-full px-3 py-1 text-sm font-bold", grade.className)}>{grade.grade} · {grade.label}</span>}
              </div>
              <ul className="grid grid-cols-4 gap-1.5 text-center text-xs">
                {QUARTERS.map((q) => {
                  const key = quarterKey(s.year, q);
                  const t = byQuarter.get(key);
                  return (
                    <li key={q}>
                      <Link href={`/team/members/${memberId}?period=${key}#evaluation`} scroll={false} className="block rounded-lg border px-1 py-2 hover:bg-muted">
                        <div className="text-muted-foreground">{q}분기</div>
                        <div className="font-semibold tabular-nums">{t != null ? t.toFixed(1) : "—"}</div>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
