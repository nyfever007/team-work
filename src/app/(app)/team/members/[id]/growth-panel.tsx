import { SproutIcon } from "lucide-react";
import { currentPeriod, levelOf, periodOf, periodRange, shiftPeriod } from "@/lib/evaluations/types";
import { growthGoalsFor } from "@/lib/growth/queries";
import { GROWTH_STATUS_CLASS, GROWTH_STATUS_LABEL, isQuarterKey } from "@/lib/growth/types";
import { GrowthCommentForm } from "@/components/growth/comment-form";
import { QuarterNav } from "@/components/growth/quarter-nav";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

/**
 * Quarter shown: `?gq=` if valid, else the quarter of the evaluation `?period=` (week/month/quarter), else this quarter.
 * Leaders (canComment) write the 팀장 코멘트; goals themselves are edited by the member on /my/growth.
 */
export function growthQuarter(gq: unknown, period: string, today: string): string {
  const current = currentPeriod("quarter", today);
  const max = shiftPeriod(current, 1);
  if (isQuarterKey(gq) && gq <= max) return gq;
  const level = levelOf(period);
  if (level === "quarter") return period;
  if (level === "week" || level === "month") return periodOf(periodRange(period).start);
  return current;
}

export function GrowthPanel({ memberId, quarter, period, today, canComment }: { memberId: number; quarter: string; period: string; today: string; canComment: boolean }) {
  const current = currentPeriod("quarter", today);
  const goals = growthGoalsFor(memberId, [quarter]);
  return (
    <Card id="growth" className="scroll-mt-20">
      <CardHeader className="flex flex-wrap items-center gap-3">
        <CardTitle className="flex items-center gap-2 text-base font-bold">
          <SproutIcon className="size-4 text-brand" />
          성장 계획
        </CardTitle>
        <div className="ml-auto">
          <QuarterNav quarter={quarter} current={current} max={shiftPeriod(current, 1)} href={(q) => `/team/members/${memberId}?period=${period}&gq=${q}#growth`} />
        </div>
      </CardHeader>
      <CardContent className="grid gap-3">
        {goals.length === 0 && <p className="text-sm text-muted-foreground">이 분기의 성장 목표가 없습니다.</p>}
        {goals.map((g) => (
          <article key={g.id} className="grid gap-2 rounded-xl border p-4">
            <header className="flex flex-wrap items-center gap-2">
              <h3 className={cn("min-w-0 flex-1 text-sm font-semibold", g.status === "dropped" && "text-muted-foreground line-through")}>{g.title}</h3>
              <span className={cn("rounded-full px-2 py-0.5 text-[11px] font-semibold", GROWTH_STATUS_CLASS[g.status])}>{GROWTH_STATUS_LABEL[g.status]}</span>
            </header>
            {g.plan && <p className="text-sm whitespace-pre-wrap text-foreground/80">{g.plan}</p>}
            {g.reflection && (
              <p className="rounded-lg bg-muted/50 px-3 py-2 text-sm whitespace-pre-wrap">
                <span className="mr-1.5 text-xs font-medium text-muted-foreground">회고</span>
                {g.reflection}
              </p>
            )}
            <GrowthCommentForm key={`${g.id}:${g.leaderComment}`} goalId={g.id} comment={g.leaderComment} leaderName={g.leaderName} canEdit={canComment} />
          </article>
        ))}
      </CardContent>
    </Card>
  );
}
