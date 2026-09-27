"use client";

import { useState, useTransition } from "react";
import { CheckCircle2Icon, Loader2Icon, Trash2Icon, XIcon } from "lucide-react";
import { toast } from "sonner";
import { acceptComment, addComment, deleteComment, type BoardResult } from "@/lib/board/actions";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

export type CommentView = {
  id: number;
  body: string;
  authorName: string;
  time: string;
  canDelete: boolean;
  /** Written by the post author (never acceptable). */
  byPostAuthor: boolean;
};

type Props = {
  postId: number;
  comments: CommentView[];
  isQuestion: boolean;
  acceptedId: number | null;
  canAccept: boolean;
  canComment: boolean;
};

export function Comments({ postId, comments, isQuestion, acceptedId, canAccept, canComment }: Props) {
  const [pending, start] = useTransition();
  const [body, setBody] = useState("");

  const run = (fn: () => Promise<BoardResult>, after?: () => void) =>
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

  // Accepted answer first.
  const ordered = acceptedId != null ? [...comments].sort((a, b) => Number(b.id === acceptedId) - Number(a.id === acceptedId)) : comments;

  return (
    <div className="grid gap-3">
      <h3 className="text-sm font-semibold">
        댓글 <span className="text-muted-foreground tabular-nums">{comments.length}</span>
      </h3>
      {ordered.length > 0 && (
        <ul className="grid gap-2">
          {ordered.map((c) => {
            const accepted = c.id === acceptedId;
            return (
              <li key={c.id} className={cn("grid gap-1.5 rounded-lg border px-3 py-2.5", accepted && "border-emerald-300 bg-emerald-50/60")}>
                <div className="flex flex-wrap items-center gap-2 text-xs">
                  <span className="font-semibold text-foreground">{c.authorName}</span>
                  <span className="text-muted-foreground tabular-nums">{c.time}</span>
                  {accepted && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 font-semibold text-emerald-800">
                      <CheckCircle2Icon className="size-3" />
                      채택
                    </span>
                  )}
                  <span className="ml-auto flex items-center gap-1">
                    {isQuestion && canAccept && !c.byPostAuthor && (
                      <Button size="xs" variant={accepted ? "ghost" : "outline"} disabled={pending} onClick={() => run(() => acceptComment(postId, accepted ? null : c.id))}>
                        {accepted ? <XIcon /> : <CheckCircle2Icon />}
                        {accepted ? "채택 취소" : "채택"}
                      </Button>
                    )}
                    {c.canDelete && (
                      <Button size="icon-xs" variant="ghost" aria-label="댓글 삭제" disabled={pending} onClick={() => run(() => deleteComment(c.id))}>
                        <Trash2Icon />
                      </Button>
                    )}
                  </span>
                </div>
                <p className="text-sm whitespace-pre-wrap break-words">{c.body}</p>
              </li>
            );
          })}
        </ul>
      )}
      {canComment && (
        <form
          className="grid gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            run(() => addComment(postId, body), () => setBody(""));
          }}
        >
          <Textarea value={body} onChange={(e) => setBody(e.target.value)} rows={3} maxLength={2000} placeholder={isQuestion ? "답변 남기기" : "댓글 남기기"} aria-label="댓글" />
          <div className="flex justify-end">
            <Button type="submit" size="sm" disabled={pending || !body.trim()}>
              {pending && <Loader2Icon className="animate-spin" />}
              등록
            </Button>
          </div>
        </form>
      )}
    </div>
  );
}
