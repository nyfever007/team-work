"use client";

import { useTransition } from "react";
import { toast } from "sonner";
import { cancelLeaveRequest } from "@/lib/requests/actions";
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

export function CancelRequestButton({ id, docNo, approved }: { id: number; docNo: string; approved: boolean }) {
  const [pending, start] = useTransition();
  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button variant="outline" size="sm" className="text-destructive hover:text-destructive" disabled={pending}>품의서 취소</Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{docNo} 품의서를 취소할까요?</AlertDialogTitle>
          <AlertDialogDescription>{approved ? "달력의 휴가 항목이 삭제되고 연차가 복구됩니다. 취소된 문서는 목록에 남습니다." : "승인 요청을 철회합니다. 취소된 문서는 목록에 남습니다."}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={pending}>닫기</AlertDialogCancel>
          <AlertDialogAction
            variant="destructive"
            disabled={pending}
            onClick={(e) => {
              e.preventDefault();
              start(async () => {
                const r = await cancelLeaveRequest(id);
                if (r.ok) toast.success("품의서를 취소했습니다.");
                else toast.error(r.error ?? "취소에 실패했습니다.");
              });
            }}
          >
            취소하기
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
