import Link from "next/link";
import { CheckCircle2Icon, ChevronLeftIcon, ChevronRightIcon } from "lucide-react";
import { EVAL_LEVELS, LEVEL_LABEL, currentPeriod, levelOf, periodLabel, periodRange, shiftPeriod, type EvaluationStatus } from "@/lib/evaluations/types";
import { cn } from "@/lib/utils";

type Props = {
  memberId: number;
  period: string;
  today: string;
  /** Earliest selectable date (member's join date). */
  minDate: string;
  saved: { status: EvaluationStatus; total: number | null } | undefined;
};

/** 주간 · 월간 · 분기 · 연간 tabs + ‹ period › navigation. Future periods can't be opened. */
export function EvaluationNav({ memberId, period, today, minDate, saved }: Props) {
  const level = levelOf(period)!;
  const href = (p: string) => `/team/members/${memberId}?period=${p}#evaluation`;
  const prev = shiftPeriod(period, -1);
  const next = shiftPeriod(period, 1);
  const canPrev = periodRange(prev).end >= minDate;
  const canNext = periodRange(next).start <= today;
  const now = currentPeriod(level, today);
  const arrow = "grid size-8 place-items-center rounded-full border bg-card text-muted-foreground hover:bg-muted";
  return (
    <nav className="flex flex-wrap items-center gap-3" aria-label="평가 기간">
      <div className="flex rounded-full border bg-muted/50 p-0.5 text-sm">
        {EVAL_LEVELS.map((l) => (
          <Link key={l} href={href(currentPeriod(l, today))} scroll={false} aria-current={l === level ? "page" : undefined} className={cn("rounded-full px-3 py-1 transition-colors", l === level ? "bg-card font-semibold text-accent-foreground shadow-xs" : "text-muted-foreground hover:text-foreground")}>
            {LEVEL_LABEL[l]}
          </Link>
        ))}
      </div>
      <div className="flex items-center gap-1.5">
        {canPrev ? (
          <Link href={href(prev)} scroll={false} aria-label="이전" className={arrow}><ChevronLeftIcon className="size-4" /></Link>
        ) : (
          <span className={cn(arrow, "opacity-40")}><ChevronLeftIcon className="size-4" /></span>
        )}
        <span className="flex min-w-40 items-center justify-center gap-1.5 text-sm font-semibold">
          {periodLabel(period)}
          {saved?.status === "final" && <CheckCircle2Icon className="size-4 text-emerald-600" />}
          {saved?.total != null && <span className="text-xs font-normal text-muted-foreground tabular-nums">{saved.total.toFixed(1)}</span>}
        </span>
        {canNext ? (
          <Link href={href(next)} scroll={false} aria-label="다음" className={arrow}><ChevronRightIcon className="size-4" /></Link>
        ) : (
          <span className={cn(arrow, "opacity-40")}><ChevronRightIcon className="size-4" /></span>
        )}
        {period !== now && (
          <Link href={href(now)} scroll={false} className="rounded-full border bg-card px-3 py-1 text-xs text-muted-foreground hover:bg-muted">
            {level === "week" ? "이번 주" : level === "month" ? "이번 달" : level === "quarter" ? "이번 분기" : "올해"}
          </Link>
        )}
      </div>
    </nav>
  );
}
