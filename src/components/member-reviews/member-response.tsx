"use client";

import { useState, useTransition } from "react";
import { CheckCheckIcon, Loader2Icon, MessageCircleReplyIcon } from "lucide-react";
import { toast } from "sonner";
import { acknowledgeMemberReview, replyToMemberReview } from "@/lib/member-reviews/actions";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

type Props = { reviewId: number; acked: boolean; reply: string; reviewerName: string; showReply?: boolean };

/** Member side of a shared review: "확인했어요" and an optional reply to the leader. */
export function MemberResponse({ reviewId, acked, reply, reviewerName, showReply = true }: Props) {
  const [pending, start] = useTransition();
  const [open, setOpen] = useState(false);
  const [text, setText] = useState(reply);

  const run = (fn: () => Promise<{ ok: true; message: string } | { ok: false; error: string }>, after?: () => void) =>
    start(async () => {
      try {
        const r = await fn();
        if (r.ok) {
          toast.success(r.message);
          after?.();
        } else toast.error(r.error);
      } catch {
        toast.error("요청에 실패했습니다.");
      }
    });

  return (
    <div className="grid gap-2">
      {reply && !open && (
        <div className="rounded-xl bg-muted/60 px-3 py-2 text-sm">
          <div className="mb-0.5 text-xs font-medium text-muted-foreground">내 답글</div>
          <p className="whitespace-pre-wrap">{reply}</p>
        </div>
      )}
      {open ? (
        <form
          className="grid gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            run(() => replyToMemberReview(reviewId, text), () => setOpen(false));
          }}
        >
          <Textarea autoFocus value={text} onChange={(e) => setText(e.target.value)} rows={3} maxLength={2000} placeholder={`${reviewerName}님께 질문이나 의견을 남겨 주세요`} aria-label="답글" />
          <div className="flex justify-end gap-2">
            <Button type="button" variant="ghost" size="sm" onClick={() => { setText(reply); setOpen(false); }} disabled={pending}>
              취소
            </Button>
            <Button type="submit" size="sm" disabled={pending}>
              {pending && <Loader2Icon className="animate-spin" />}
              {reply ? "답글 수정" : "답글 남기기"}
            </Button>
          </div>
        </form>
      ) : (
        <div className="flex flex-wrap items-center gap-2">
          {acked ? (
            <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-700">
              <CheckCheckIcon className="size-4" />
              확인함
            </span>
          ) : (
            <Button size="sm" onClick={() => run(() => acknowledgeMemberReview(reviewId))} disabled={pending}>
              {pending ? <Loader2Icon className="animate-spin" /> : <CheckCheckIcon />}
              확인했어요
            </Button>
          )}
          {showReply && (
            <Button size="sm" variant="outline" onClick={() => setOpen(true)} disabled={pending}>
              <MessageCircleReplyIcon />
              {reply ? "답글 수정" : "답글"}
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
