"use client";

import { useState, useTransition } from "react";
import { MessageSquareQuoteIcon, PencilIcon } from "lucide-react";
import { toast } from "sonner";
import { commentGrowthGoal } from "@/lib/growth/actions";
import { GROWTH_TEXT_MAX } from "@/lib/growth/types";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

/** Leader's comment on one growth goal: shows the saved comment, edit inline. */
export function GrowthCommentForm({ goalId, comment, leaderName, canEdit }: { goalId: number; comment: string; leaderName: string | null; canEdit: boolean }) {
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState(comment);
  const [pending, start] = useTransition();

  const save = () =>
    start(async () => {
      try {
        const r = await commentGrowthGoal(goalId, text);
        if (r.ok) {
          toast.success(r.message);
          setEditing(false);
        } else toast.error(r.error);
      } catch {
        toast.error("요청에 실패했습니다.");
      }
    });

  if (editing) {
    return (
      <div className="grid gap-1.5">
        <Textarea value={text} onChange={(e) => setText(e.target.value)} maxLength={GROWTH_TEXT_MAX} rows={2} placeholder="팀장 코멘트 (구성원에게 보입니다)" aria-label="팀장 코멘트" autoFocus />
        <div className="flex justify-end gap-1.5">
          <Button
            size="xs"
            variant="ghost"
            disabled={pending}
            onClick={() => {
              setText(comment);
              setEditing(false);
            }}
          >
            취소
          </Button>
          <Button size="xs" disabled={pending} onClick={save}>
            저장
          </Button>
        </div>
      </div>
    );
  }

  if (!comment) {
    return canEdit ? (
      <Button size="xs" variant="outline" className="w-fit" onClick={() => setEditing(true)}>
        <MessageSquareQuoteIcon />
        코멘트 쓰기
      </Button>
    ) : null;
  }

  return (
    <div className="flex gap-1.5 rounded-lg bg-brand-soft/60 px-3 py-2 text-sm">
      <MessageSquareQuoteIcon className="mt-0.5 size-4 shrink-0 text-brand" />
      <span className="grid min-w-0 flex-1 gap-0.5">
        <span className="whitespace-pre-wrap">{comment}</span>
        {leaderName && <span className="text-xs text-muted-foreground">{leaderName}</span>}
      </span>
      {canEdit && (
        <Button size="icon-xs" variant="ghost" aria-label="코멘트 수정" onClick={() => setEditing(true)}>
          <PencilIcon />
        </Button>
      )}
    </div>
  );
}
