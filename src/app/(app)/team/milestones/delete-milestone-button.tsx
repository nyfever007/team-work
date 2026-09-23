"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2Icon, Trash2Icon } from "lucide-react";
import { toast } from "sonner";
import { deleteMilestone } from "@/lib/milestones/actions";
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

export function DeleteMilestoneButton({ id, title, closeHref }: { id: number; title: string; closeHref: string }) {
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  const router = useRouter();

  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogTrigger asChild>
        <Button variant="outline" size="sm" className="text-destructive hover:text-destructive">
          <Trash2Icon className="size-3.5" />
          삭제
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>‘{title}’을(를) 삭제할까요?</AlertDialogTitle>
          <AlertDialogDescription>마일스톤과 현황 업데이트 이력이 모두 삭제되며 복구할 수 없습니다.</AlertDialogDescription>
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
                  const r = await deleteMilestone(id);
                  if (r.ok) {
                    toast.success("마일스톤을 삭제했습니다.");
                    setOpen(false);
                    router.push(closeHref, { scroll: false });
                  } else toast.error(r.error ?? "삭제에 실패했습니다.");
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
  );
}
