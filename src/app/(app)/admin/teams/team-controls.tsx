"use client";

import { useActionState, useEffect, useRef, useState, useTransition } from "react";
import { Loader2Icon, PencilIcon, PlusIcon, Trash2Icon } from "lucide-react";
import { toast } from "sonner";
import { createTeam, deleteTeam, renameTeam, setTeamLeader, type TeamState } from "@/lib/teams/actions";
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
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";

function useToast(state: TeamState, onOk?: () => void) {
  const last = useRef<TeamState>(undefined);
  useEffect(() => {
    if (!state || state === last.current) return;
    last.current = state;
    if (state.ok) {
      toast.success(state.message);
      onOk?.();
    } else toast.error(state.error);
  }, [state, onOk]);
}

export function CreateTeamForm() {
  const [state, action, pending] = useActionState(createTeam, undefined);
  const ref = useRef<HTMLFormElement>(null);
  useToast(state, () => ref.current?.reset());
  return (
    <form ref={ref} action={action} className="flex items-end gap-2">
      <div className="grid gap-1.5">
        <Label htmlFor="new-team">새 팀</Label>
        <Input id="new-team" name="name" placeholder="예: 플랫폼팀" maxLength={50} required className="w-48" />
      </div>
      <Button type="submit" disabled={pending}>
        {pending ? <Loader2Icon className="size-4 animate-spin" /> : <PlusIcon className="size-4" />}
        팀 만들기
      </Button>
    </form>
  );
}

export function TeamLeaderSelect({ teamId, leaderMemberId, members }: { teamId: number; leaderMemberId: number | null; members: { id: number; name: string }[] }) {
  const [pending, start] = useTransition();
  return (
    <div className="flex items-center gap-2">
      <NativeSelect
        aria-label="팀장"
        value={leaderMemberId ?? ""}
        disabled={pending || members.length === 0}
        onChange={(e) => {
          const v = e.target.value ? Number(e.target.value) : null;
          start(async () => {
            const r = await setTeamLeader(teamId, v);
            if (r.ok) toast.success(v ? "팀장을 지정했습니다." : "팀장 지정을 해제했습니다.");
            else toast.error(r.error ?? "실패했습니다.");
          });
        }}
      >
        <NativeSelectOption value="">{members.length === 0 ? "구성원 없음" : "팀장 없음"}</NativeSelectOption>
        {members.map((m) => (
          <NativeSelectOption key={m.id} value={m.id}>
            {m.name}
          </NativeSelectOption>
        ))}
      </NativeSelect>
      {pending && <Loader2Icon className="size-4 animate-spin text-muted-foreground" />}
    </div>
  );
}

export function TeamRowButtons({ teamId, name, canDelete }: { teamId: number; name: string; canDelete: boolean }) {
  const [open, setOpen] = useState(false);
  const [state, action, pending] = useActionState(renameTeam.bind(null, teamId), undefined);
  useToast(state, () => setOpen(false));
  const [deleting, startDelete] = useTransition();

  return (
    <div className="flex justify-end gap-1">
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger asChild>
          <Button variant="ghost" size="icon" aria-label={`${name} 이름 변경`}>
            <PencilIcon className="size-4" />
          </Button>
        </DialogTrigger>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>팀 이름 변경</DialogTitle>
            <DialogDescription>‘{name}’의 새 이름을 입력하세요.</DialogDescription>
          </DialogHeader>
          {open && (
            <form action={action} className="grid gap-3">
              <Input name="name" defaultValue={name} maxLength={50} required autoFocus aria-label="팀 이름" />
              {state && !state.ok && <p className="text-sm text-destructive">{state.error}</p>}
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                  취소
                </Button>
                <Button type="submit" disabled={pending}>
                  {pending && <Loader2Icon className="size-4 animate-spin" />}
                  저장
                </Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>
      <AlertDialog>
        <AlertDialogTrigger asChild>
          <Button variant="ghost" size="icon" aria-label={`${name} 삭제`} disabled={!canDelete} title={canDelete ? undefined : "구성원이나 마일스톤이 있는 팀은 삭제할 수 없습니다"}>
            <Trash2Icon className="size-4" />
          </Button>
        </AlertDialogTrigger>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>‘{name}’ 팀을 삭제할까요?</AlertDialogTitle>
            <AlertDialogDescription>비어 있는 팀만 삭제됩니다.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>취소</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              disabled={deleting}
              onClick={(e) => {
                e.preventDefault();
                startDelete(async () => {
                  const r = await deleteTeam(teamId);
                  if (r.ok) toast.success("팀을 삭제했습니다.");
                  else toast.error(r.error ?? "삭제에 실패했습니다.");
                });
              }}
            >
              삭제
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

