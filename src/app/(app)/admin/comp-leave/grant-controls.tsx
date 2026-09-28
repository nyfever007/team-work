"use client";

import { useActionState, useState, useTransition } from "react";
import { GiftIcon, Loader2Icon, PencilIcon, Trash2Icon } from "lucide-react";
import { toast } from "sonner";
import { deleteCompGrant, grantCompLeave, updateCompGrant, type CompGrantState } from "@/lib/leaves/comp-actions";
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
import { Textarea } from "@/components/ui/textarea";
import { DatePicker } from "@/components/date-picker";
import { cn } from "@/lib/utils";

type MemberOption = { id: number; name: string; team: string; teamId: number };
type GrantValues = { title: string; description: string; days: number; grantedOn: string };

function GrantFields({ values, today }: { values?: GrantValues; today: string }) {
  return (
    <>
      <div className="grid gap-1.5">
        <Label htmlFor="comp-title">보상휴가 제목<span className="ml-1 text-destructive">*</span></Label>
        <Input id="comp-title" name="title" defaultValue={values?.title} placeholder="예: 추석 연휴 서버 이전 대응" maxLength={100} required />
      </div>
      <div className="grid gap-1.5">
        <Label htmlFor="comp-description">설명</Label>
        <Textarea id="comp-description" name="description" defaultValue={values?.description} rows={3} maxLength={1000} placeholder="지급 사유, 사용 안내 등 (선택)" />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="grid gap-1.5">
          <Label htmlFor="comp-days">총 보상휴가 일수<span className="ml-1 text-destructive">*</span></Label>
          <Input id="comp-days" name="days" type="number" inputMode="decimal" min={0.5} max={365} step={0.5} defaultValue={values?.days ?? 1} required />
          <p className="text-xs text-muted-foreground">0.5일 단위로 입력합니다. 구성원마다 이 일수만큼 지급됩니다.</p>
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="comp-granted">지급일</Label>
          <DatePicker id="comp-granted" name="grantedOn" defaultValue={values?.grantedOn ?? today} />
        </div>
      </div>
    </>
  );
}

/** Grant form. Remounts after a successful grant so every field (and the member picks) resets. */
export function GrantCompLeaveForm({ members, today }: { members: MemberOption[]; today: string }) {
  const [round, setRound] = useState(0);
  return <GrantForm key={round} members={members} today={today} onDone={() => setRound((n) => n + 1)} />;
}

function GrantForm({ members, today, onDone }: { members: MemberOption[]; today: string; onDone: () => void }) {
  const [state, action, pending] = useActionState<CompGrantState, FormData>(async (prev, fd) => {
    const r = await grantCompLeave(prev, fd);
    if (r?.ok) {
      toast.success(r.message);
      onDone();
    }
    return r;
  }, undefined);
  const [picked, setPicked] = useState<Set<number>>(new Set());
  const teams = [...new Map(members.map((m) => [m.teamId, m.team])).entries()];
  const toggle = (ids: number[], on: boolean) =>
    setPicked((prev) => {
      const next = new Set(prev);
      for (const id of ids) {
        if (on) next.add(id);
        else next.delete(id);
      }
      return next;
    });

  return (
    <form action={action} className="grid gap-4">
      <GrantFields today={today} />
      <div className="grid gap-2">
        <div className="flex items-baseline justify-between gap-2">
          <Label>지급할 구성원<span className="ml-1 text-destructive">*</span></Label>
          <span className="text-xs text-muted-foreground tabular-nums">{picked.size}명 선택</span>
        </div>
        <div className="grid gap-3 rounded-lg border p-3">
          {teams.map(([teamId, team]) => {
            const ids = members.filter((m) => m.teamId === teamId).map((m) => m.id);
            const all = ids.every((id) => picked.has(id));
            return (
              <div key={teamId} className="grid gap-1.5">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-medium text-muted-foreground">{team}</span>
                  <button type="button" className="text-xs text-accent-foreground hover:underline" onClick={() => toggle(ids, !all)}>
                    {all ? "선택 해제" : "팀 전체 선택"}
                  </button>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {members
                    .filter((m) => m.teamId === teamId)
                    .map((m) => (
                      <label key={m.id} className={cn("flex cursor-pointer items-center gap-1.5 rounded-md border px-2.5 py-1 text-sm transition-colors hover:bg-muted", picked.has(m.id) && "border-primary bg-brand-soft hover:bg-brand-soft")}>
                        <input type="checkbox" name="memberIds" value={m.id} checked={picked.has(m.id)} onChange={(e) => toggle([m.id], e.target.checked)} className="accent-primary" />
                        {m.name}
                      </label>
                    ))}
                </div>
              </div>
            );
          })}
          {members.length === 0 && <p className="text-sm text-muted-foreground">등록된 구성원이 없습니다.</p>}
        </div>
      </div>
      {state && !state.ok && <p role="alert" className="text-sm text-destructive">{state.error}</p>}
      <div className="flex justify-end">
        <Button type="submit" disabled={pending || picked.size === 0}>
          {pending ? <Loader2Icon className="size-4 animate-spin" /> : <GiftIcon className="size-4" />}
          보상휴가 지급
        </Button>
      </div>
    </form>
  );
}

export function GrantRowButtons({ id, memberName, values, held, today }: { id: number; memberName: string; values: GrantValues; held: number; today: string }) {
  const [open, setOpen] = useState(false);
  const [deleting, startDelete] = useTransition();
  return (
    <div className="flex justify-end gap-1">
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger asChild>
          <Button variant="ghost" size="icon" aria-label={`${memberName} ${values.title} 수정`}>
            <PencilIcon className="size-4" />
          </Button>
        </DialogTrigger>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>보상휴가 수정</DialogTitle>
            <DialogDescription>{memberName}님에게 지급한 보상휴가입니다.{held > 0 && ` 사용·승인 대기 ${held}일보다 적게 줄일 수 없습니다.`}</DialogDescription>
          </DialogHeader>
          {open && <EditForm id={id} values={values} today={today} onDone={() => setOpen(false)} />}
        </DialogContent>
      </Dialog>
      <AlertDialog>
        <AlertDialogTrigger asChild>
          <Button variant="ghost" size="icon" aria-label={`${memberName} ${values.title} 삭제`} disabled={held > 0} title={held > 0 ? "사용했거나 승인 대기 중인 품의서가 있으면 삭제할 수 없습니다" : undefined}>
            <Trash2Icon className="size-4" />
          </Button>
        </AlertDialogTrigger>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>보상휴가를 삭제할까요?</AlertDialogTitle>
            <AlertDialogDescription>{memberName}님의 ‘{values.title}’ {values.days}일 지급이 취소됩니다.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>취소</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              disabled={deleting}
              onClick={(e) => {
                e.preventDefault();
                startDelete(async () => {
                  try {
                    const r = await deleteCompGrant(id);
                    if (r.ok) toast.success("보상휴가를 삭제했습니다.");
                    else toast.error(r.error ?? "삭제에 실패했습니다.");
                  } catch {
                    toast.error("삭제에 실패했습니다.");
                  }
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

function EditForm({ id, values, today, onDone }: { id: number; values: GrantValues; today: string; onDone: () => void }) {
  const [state, action, pending] = useActionState<CompGrantState, FormData>(async (prev, fd) => {
    const r = await updateCompGrant(id, prev, fd);
    if (r?.ok) {
      toast.success(r.message);
      onDone();
    }
    return r;
  }, undefined);
  return (
    <form action={action} className="grid gap-4">
      <GrantFields values={values} today={today} />
      {state && !state.ok && <p role="alert" className="text-sm text-destructive">{state.error}</p>}
      <DialogFooter>
        <Button type="button" variant="outline" onClick={onDone}>취소</Button>
        <Button type="submit" disabled={pending}>
          {pending && <Loader2Icon className="size-4 animate-spin" />}
          저장
        </Button>
      </DialogFooter>
    </form>
  );
}
