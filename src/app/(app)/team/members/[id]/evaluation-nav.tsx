import Link from "next/link";
import { CheckCircle2Icon, ChevronLeftIcon, ChevronRightIcon, SigmaIcon } from "lucide-react";
import { QUARTERS, periodRange, quarterKey, type EvaluationStatus } from "@/lib/evaluations/types";
import { cn } from "@/lib/utils";

type Props = {
  memberId: number;
  year: number;
  /** Selected quarter key, or null when the yearly average is shown. */
  period: string | null;
  minYear: number;
  maxYear: number;
  today: string;
  saved: Map<string, { status: EvaluationStatus; total: number | null }>;
};

/** Year switcher + Q1–Q4 + 연평균 tabs. Quarters that haven't started are disabled. */
export function EvaluationNav({ memberId, year, period, minYear, maxYear, today, saved }: Props) {
  const href = (p: string) => `/team/members/${memberId}?period=${p}#evaluation`;
  const tab = "flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm transition-colors";
  return (
    <nav className="flex flex-wrap items-center gap-2" aria-label="평가 기간">
      <div className="mr-1 flex items-center gap-0.5 rounded-full border bg-card px-1 py-0.5">
        {year > minYear ? (
          <Link href={href(quarterKey(year - 1, 4))} scroll={false} aria-label="이전 연도" className="rounded-full p-1 text-muted-foreground hover:bg-muted">
            <ChevronLeftIcon className="size-4" />
          </Link>
        ) : (
          <span className="p-1 text-muted-foreground/40"><ChevronLeftIcon className="size-4" /></span>
        )}
        <span className="px-1.5 text-sm font-bold tabular-nums">{year}년</span>
        {year < maxYear ? (
          <Link href={href(quarterKey(year + 1, 1))} scroll={false} aria-label="다음 연도" className="rounded-full p-1 text-muted-foreground hover:bg-muted">
            <ChevronRightIcon className="size-4" />
          </Link>
        ) : (
          <span className="p-1 text-muted-foreground/40"><ChevronRightIcon className="size-4" /></span>
        )}
      </div>
      {QUARTERS.map((q) => {
        const key = quarterKey(year, q);
        const s = saved.get(key);
        const future = periodRange(key).start > today;
        const active = key === period;
        if (future) {
          return (
            <span key={key} className={cn(tab, "cursor-not-allowed border-dashed text-muted-foreground/50")} title="아직 시작하지 않은 분기">
              {q}분기
            </span>
          );
        }
        return (
          <Link key={key} href={href(key)} scroll={false} aria-current={active ? "page" : undefined} className={cn(tab, active ? "border-brand/40 bg-accent font-semibold text-accent-foreground" : "bg-card text-muted-foreground hover:bg-muted")}>
            {q}분기
            {s?.status === "final" && <CheckCircle2Icon className="size-3.5 text-emerald-600" />}
            {s?.total != null && <span className="text-xs tabular-nums">{s.total.toFixed(1)}</span>}
          </Link>
        );
      })}
      <Link href={href(String(year))} scroll={false} aria-current={period === null ? "page" : undefined} className={cn(tab, period === null ? "border-brand/40 bg-accent font-semibold text-accent-foreground" : "bg-card text-muted-foreground hover:bg-muted")}>
        <SigmaIcon className="size-3.5" />
        연평균
      </Link>
    </nav>
  );
}
