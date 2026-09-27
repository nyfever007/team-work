"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { BookmarkIcon, CopyIcon, FlaskConicalIcon, PinIcon, PinOffIcon, ThumbsUpIcon, Trash2Icon } from "lucide-react";
import { toast } from "sonner";
import { deletePost, togglePin, toggleReaction, type BoardResult } from "@/lib/board/actions";
import { REACTION_LABEL, type ReactionKind } from "@/lib/board/types";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

function useRun() {
  const [pending, start] = useTransition();
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
  return [pending, run] as const;
}

const ICON: Record<ReactionKind, typeof ThumbsUpIcon> = { helpful: ThumbsUpIcon, saved: BookmarkIcon, tried: FlaskConicalIcon };

/** Reaction toggles. `disabledReason` set → buttons show counts only. */
export function ReactionBar({ postId, kinds, counts, mine, disabledReason }: { postId: number; kinds: ReactionKind[]; counts: Record<ReactionKind, number>; mine: ReactionKind[]; disabledReason?: string }) {
  const [pending, run] = useRun();
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {kinds.map((k) => {
        const Icon = ICON[k];
        const on = mine.includes(k);
        return (
          <Button
            key={k}
            size="sm"
            variant="outline"
            aria-pressed={on}
            title={disabledReason}
            disabled={pending || !!disabledReason}
            onClick={() => run(() => toggleReaction(postId, k))}
            className={cn(on && "border-brand/40 bg-brand-soft text-accent-foreground hover:bg-brand-soft")}
          >
            <Icon className={cn(on && "fill-current")} />
            {REACTION_LABEL[k]}
            <span className="tabular-nums">{counts[k]}</span>
          </Button>
        );
      })}
      {disabledReason && <span className="text-xs text-muted-foreground">{disabledReason}</span>}
    </div>
  );
}

export function PinButton({ postId, pinned }: { postId: number; pinned: boolean }) {
  const [pending, run] = useRun();
  return (
    <Button size="sm" variant="outline" disabled={pending} onClick={() => run(() => togglePin(postId))}>
      {pinned ? <PinOffIcon /> : <PinIcon />}
      {pinned ? "고정 해제" : "고정"}
    </Button>
  );
}

export function DeletePostButton({ postId, title, redirectTo }: { postId: number; title: string; redirectTo: string }) {
  const router = useRouter();
  const [pending, run] = useRun();
  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button size="sm" variant="outline" className="text-destructive hover:text-destructive" disabled={pending}>
          <Trash2Icon />
          삭제
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>글을 삭제할까요?</AlertDialogTitle>
          <AlertDialogDescription>「{title}」과 댓글·반응이 모두 삭제됩니다.</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={pending}>닫기</AlertDialogCancel>
          <AlertDialogAction
            variant="destructive"
            disabled={pending}
            onClick={(e) => {
              e.preventDefault();
              run(() => deletePost(postId), () => router.push(redirectTo));
            }}
          >
            삭제
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

export function CopyButton({ text }: { text: string }) {
  return (
    <Button
      size="xs"
      variant="outline"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text);
          toast.success("복사했습니다.");
        } catch {
          toast.error("복사에 실패했습니다.");
        }
      }}
    >
      <CopyIcon />
      복사
    </Button>
  );
}
