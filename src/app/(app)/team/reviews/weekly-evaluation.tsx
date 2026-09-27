"use client";

import { useTransition } from "react";
import Link from "next/link";
import { ClipboardCheckIcon, Loader2Icon, LockIcon, RefreshCwIcon, SparklesIcon } from "lucide-react";
import { toast } from "sonner";
import { regenerateWeeklyEvaluation } from "@/lib/evaluations/actions";
import { CRITERIA, gradeOf, type EvaluationStatus } from "@/lib/evaluations/types";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

type Props = {
  memberId: number;
  week: string;
  evaluation: { total: number | null; status: EvaluationStatus; scores: Record<string, number>; summary: string; aiModel: string | null } | null;
  aiReady: boolean;
  reviewShared: boolean;
};

/** Private 주간 인사평가 next to the weekly review. Never shown to the member. */
export function WeeklyEvaluationPanel({ memberId, week, evaluation, aiReady, reviewShared }: Props) {
  const [pending, start] = useTransition();
  const grade = gradeOf(evaluation?.total ?? null);
  const run = () =>
    start(async () => {
      try {
        const r = await regenerateWeeklyEvaluation(memberId, week);
        if (r.ok) toast.success(r.message);
        else toast.error(r.error);
      } catch {
        toast.error("AI 평가 생성에 실패했습니다.");
      }
    });

  return (
    <Card size="sm" className="border-dashed">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <ClipboardCheckIcon className="size-4 text-brand" />
          주간 인사평가
          <span className="ml-auto inline-flex items-center gap-1 text-[11px] font-normal text-muted-foreground">
            <LockIcon className="size-3" />
            구성원에게 공개되지 않음
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent className="grid gap-3 text-sm">
        {evaluation ? (
          <>
            <div className="flex items-center gap-3">
              <span className="text-2xl font-bold tabular-nums">{evaluation.total?.toFixed(1) ?? "—"}</span>
              {grade && <span className={cn("rounded-full px-2 py-0.5 text-xs font-bold", grade.className)}>{grade.grade} · {grade.label}</span>}
              <span className="ml-auto text-xs text-muted-foreground">{evaluation.status === "final" ? "확정" : evaluation.aiModel ? "AI 초안" : "임시 저장"}</span>
            </div>
            <ul className="grid grid-cols-2 gap-x-4 gap-y-0.5 text-xs sm:grid-cols-4">
              {CRITERIA.map((c) => (
                <li key={c.key} className="flex justify-between gap-2">
                  <span className="text-muted-foreground">{c.label}</span>
                  <b className="font-semibold tabular-nums">{evaluation.scores[c.key] ?? "—"}</b>
                </li>
              ))}
            </ul>
            {evaluation.summary && <p className="line-clamp-3 text-xs text-muted-foreground">{evaluation.summary}</p>}
          </>
        ) : (
          <p className="text-xs text-muted-foreground">
            {reviewShared ? "아직 없습니다. AI로 만들어 보세요." : "리뷰를 공유하면 AI가 주간 인사평가 초안을 자동으로 만듭니다. 지금 바로 만들 수도 있습니다."}
          </p>
        )}
        <div className="flex flex-wrap gap-2">
          {evaluation?.status !== "final" && (
            <Button size="sm" variant="outline" onClick={run} disabled={!aiReady || pending}>
              {pending ? <Loader2Icon className="animate-spin" /> : evaluation ? <RefreshCwIcon /> : <SparklesIcon />}
              {evaluation ? "AI로 다시 만들기" : "AI로 만들기"}
            </Button>
          )}
          <Button size="sm" variant="ghost" asChild>
            <Link href={`/team/members/${memberId}?period=${week}#evaluation`}>편집 · 확정 →</Link>
          </Button>
        </div>
        {!aiReady && <p className="text-[11px] text-amber-900">OPENAI_API_KEY가 설정되지 않아 AI 평가를 만들 수 없습니다.</p>}
      </CardContent>
    </Card>
  );
}
