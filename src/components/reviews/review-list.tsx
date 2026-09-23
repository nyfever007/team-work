import { MessageSquareIcon } from "lucide-react";
import { formatTime } from "@/lib/dates";
import type { DailyReview } from "@/lib/db/schema";
import { cn } from "@/lib/utils";

export function ReviewList({ reviews, className, emptyText }: { reviews: DailyReview[]; className?: string; emptyText?: string }) {
  if (reviews.length === 0) return emptyText ? <p className={cn("text-xs text-muted-foreground", className)}>{emptyText}</p> : null;
  return (
    <ul className={cn("grid gap-1.5", className)}>
      {reviews.map((r) => (
        <li key={r.id} className="rounded-md bg-amber-50 px-2.5 py-2 text-sm text-amber-950">
          <div className="mb-0.5 flex items-center gap-1.5 text-xs text-amber-800">
            <MessageSquareIcon className="size-3.5" />
            <span className="font-medium">{r.reviewerName}</span>
            <span>팀장 리뷰</span>
            <span className="ml-auto">{formatTime(r.updatedAt)}</span>
          </div>
          <p className="whitespace-pre-wrap">{r.comment}</p>
        </li>
      ))}
    </ul>
  );
}
