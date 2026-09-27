"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2Icon, LockIcon, LockOpenIcon, Trash2Icon } from "lucide-react";
import { toast } from "sonner";
import { deleteRetro, setRetroStatus } from "@/lib/retro/actions";
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

/** Leader/admin: close/reopen and delete. */
export function RetroControls({ retroId, title, open, listHref }: { retroId: number; title: string; open: boolean; listHref: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [confirm, setConfirm] = useState(false);

  const toggle = () =>
    start(async () => {
      try {
        const r = await setRetroStatus(retroId, open ? "closed" : "open");
        if (r.ok) toast.success(r.message);
        else toast.error(r.error);
      } catch {
        toast.error("상태를 바꾸지 못했습니다.");
      }
    });

  return (
    <div className="flex items-center gap-1.5">
      <Button size="sm" variant="outline" onClick={toggle} disabled={pending}>
        {open ? <LockIcon /> : <LockOpenIcon />}
        {open ? "마감" : "다시 열기"}
      </Button>
      <AlertDialog open={confirm} onOpenChange={setConfirm}>
        <AlertDialogTrigger asChild>
          <Button size="sm" variant="outline" className="text-destructive hover:text-destructive" disabled={pending}>
            <Trash2Icon />
            삭제
          </Button>
        </AlertDialogTrigger>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>‘{title}’을(를) 삭제할까요?</AlertDialogTitle>
            <AlertDialogDescription>항목, 투표, Try 담당·완료 기록이 모두 삭제되며 복구할 수 없습니다.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={pending}>취소</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              disabled={pending}
              onClick={(e) => {
                e.preventDefault();
                start(async () => {
                  try {
                    const r = await deleteRetro(retroId);
                    if (r.ok) {
                      toast.success(r.message);
                      setConfirm(false);
                      router.push(listHref);
                    } else toast.error(r.error);
                  } catch {
                    toast.error("삭제에 실패했습니다.");
                  }
                });
              }}
            >
              {pending && <Loader2Icon className="size-4 animate-spin" />}
              삭제
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
