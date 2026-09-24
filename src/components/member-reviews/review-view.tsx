import { ArrowRightCircleIcon, SparklesIcon, TargetIcon, ThumbsUpIcon, TrendingUpIcon } from "lucide-react";
import { RATING_CLASS, RATING_LABEL, actionLines, isRating } from "@/lib/member-reviews/types";
import { cn } from "@/lib/utils";

type ReviewLike = { rating: number | null; summary: string; strengths: string; improvements: string; nextActions: string };

export function RatingBadge({ rating, className }: { rating: number | null; className?: string }) {
  if (!isRating(rating)) return null;
  return (
    <span className={cn("inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold", RATING_CLASS[rating], className)}>
      <SparklesIcon className="size-3" />
      {RATING_LABEL[rating]}
    </span>
  );
}

function Lines({ text }: { text: string }) {
  const lines = text.split("\n").map((l) => l.trim()).filter(Boolean);
  if (lines.every((l) => /^[-*•]\s/.test(l))) {
    return (
      <ul className="grid gap-1">
        {lines.map((l, i) => (
          <li key={i} className="flex gap-2">
            <span className="mt-2 size-1 shrink-0 rounded-full bg-current opacity-50" />
            <span>{l.replace(/^[-*•]\s*/, "")}</span>
          </li>
        ))}
      </ul>
    );
  }
  return <p className="whitespace-pre-wrap">{text}</p>;
}

/** Read-only rendering of a weekly review's sections. `compact` hides strengths/improvements. */
export function ReviewView({ review, compact = false }: { review: ReviewLike; compact?: boolean }) {
  const actions = actionLines(review.nextActions);
  return (
    <div className="grid gap-4 text-sm leading-relaxed">
      {review.summary && <p className={cn("whitespace-pre-wrap text-foreground", compact && "line-clamp-3")}>{review.summary}</p>}
      {!compact && (review.strengths || review.improvements) && (
        <div className="grid gap-3 sm:grid-cols-2">
          {review.strengths && (
            <section className="rounded-xl bg-emerald-50/70 p-3 text-emerald-950">
              <h4 className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold text-emerald-800">
                <ThumbsUpIcon className="size-3.5" />
                잘한 점
              </h4>
              <Lines text={review.strengths} />
            </section>
          )}
          {review.improvements && (
            <section className="rounded-xl bg-amber-50/80 p-3 text-amber-950">
              <h4 className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold text-amber-800">
                <TrendingUpIcon className="size-3.5" />
                보완할 점
              </h4>
              <Lines text={review.improvements} />
            </section>
          )}
        </div>
      )}
      {actions.length > 0 && (
        <section className="rounded-xl border border-brand/15 bg-brand-soft/60 p-3">
          <h4 className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold text-accent-foreground">
            <TargetIcon className="size-3.5" />
            다음 주에 해 주세요
          </h4>
          <ul className="grid gap-1">
            {(compact ? actions.slice(0, 3) : actions).map((a, i) => (
              <li key={i} className="flex items-start gap-2">
                <ArrowRightCircleIcon className="mt-0.5 size-3.5 shrink-0 text-brand" />
                <span>{a}</span>
              </li>
            ))}
            {compact && actions.length > 3 && <li className="pl-5.5 text-xs text-muted-foreground">외 {actions.length - 3}개</li>}
          </ul>
        </section>
      )}
    </div>
  );
}
