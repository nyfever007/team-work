import Link from "next/link";
import { ChevronLeftIcon, ChevronRightIcon } from "lucide-react";
import { periodLabel, shiftPeriod } from "@/lib/evaluations/types";
import { cn } from "@/lib/utils";

/** ‹ 2026년 3분기 › with links built by `href`; `max` = last selectable quarter, `min` = first (optional). */
export function QuarterNav({ quarter, current, max, min, href }: { quarter: string; current: string; max: string; min?: string; href: (q: string) => string }) {
  const prev = shiftPeriod(quarter, -1);
  const next = shiftPeriod(quarter, 1);
  const canPrev = !min || prev >= min;
  const canNext = next <= max;
  const arrow = "grid size-8 place-items-center rounded-full border bg-card text-muted-foreground hover:bg-muted";
  return (
    <nav className="flex items-center gap-1.5" aria-label="분기">
      {canPrev ? (
        <Link href={href(prev)} scroll={false} aria-label="이전 분기" className={arrow}>
          <ChevronLeftIcon className="size-4" />
        </Link>
      ) : (
        <span className={cn(arrow, "opacity-40")}>
          <ChevronLeftIcon className="size-4" />
        </span>
      )}
      <span className="min-w-32 text-center text-sm font-semibold">{periodLabel(quarter)}</span>
      {canNext ? (
        <Link href={href(next)} scroll={false} aria-label="다음 분기" className={arrow}>
          <ChevronRightIcon className="size-4" />
        </Link>
      ) : (
        <span className={cn(arrow, "opacity-40")}>
          <ChevronRightIcon className="size-4" />
        </span>
      )}
      {quarter !== current && (
        <Link href={href(current)} scroll={false} className="rounded-full border bg-card px-3 py-1 text-xs text-muted-foreground hover:bg-muted">
          이번 분기
        </Link>
      )}
    </nav>
  );
}
