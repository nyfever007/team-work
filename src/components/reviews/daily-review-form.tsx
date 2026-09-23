"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { Loader2Icon, MessageSquareIcon } from "lucide-react";
import { toast } from "sonner";
import { saveDailyReview, type ReviewState } from "@/lib/reviews/actions";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

type Props = {
  memberId: number;
  memberName: string;
  date: string;
  /** The caller's existing comment for this member/day, if any. */
  existing?: string;
};

export function DailyReviewForm({ memberId, memberName, date, existing }: Props) {
  const [open, setOpen] = useState(Boolean(existing));
  const [state, action, pending] = useActionState(saveDailyReview.bind(null, memberId, date), undefined);
  const last = useRef<ReviewState>(undefined);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (!state || state === last.current) return;
    last.current = state;
    if (state.ok) toast.success(state.message);
    else toast.error(state.error);
  }, [state]);

  if (!open) {
    return (
      <Button type="button" variant="ghost" size="sm" className="h-7 px-2 text-xs text-muted-foreground" onClick={() => setOpen(true)}>
        <MessageSquareIcon className="size-3.5" />
        리뷰 남기기
      </Button>
    );
  }

  return (
    <form ref={formRef} action={action} className="grid gap-1.5 rounded-md border border-dashed p-2">
      <Textarea
        name="comment"
        rows={2}
        defaultValue={existing ?? ""}
        placeholder={`${memberName}님의 오늘 한 일에 대한 코멘트`}
        maxLength={2000}
        className="min-h-0 bg-background text-sm"
        aria-label={`${memberName} 리뷰`}
        onKeyDown={(e) => {
          if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
            e.preventDefault();
            formRef.current?.requestSubmit();
          }
        }}
      />
      <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
        <span>{existing ? "비우고 저장하면 삭제됩니다" : "⌘/Ctrl+Enter로 저장"}</span>
        <div className="flex gap-1">
          {!existing && (
            <Button type="button" variant="ghost" size="sm" className="h-7 px-2 text-xs" onClick={() => setOpen(false)} disabled={pending}>
              취소
            </Button>
          )}
          <Button type="submit" size="sm" className="h-7 px-2 text-xs" disabled={pending}>
            {pending && <Loader2Icon className="size-3.5 animate-spin" />}
            {existing ? "수정" : "저장"}
          </Button>
        </div>
      </div>
    </form>
  );
}
