"use client";

import { useActionState, useEffect, useRef, useTransition } from "react";
import { Loader2Icon, Trash2Icon } from "lucide-react";
import { toast } from "sonner";
import { LEAVE_TYPES, type LeaveType } from "@/lib/leaves/types";
import { addHoliday, addLeave, deleteHoliday, deleteLeave, type LeaveFormState } from "@/lib/leaves/actions";
import { formatKoDate } from "@/lib/dates";
import { LEAVE_BADGE_CLASS } from "@/lib/leaves/types";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { Separator } from "@/components/ui/separator";
import Link from "next/link";
import { FileTextIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import type { CalendarHoliday, CalendarLeave, CalendarMember, Me } from "./calendar-grid";

type Props = {
  date: string | null;
  onClose: () => void;
  leaves: CalendarLeave[];
  holiday: CalendarHoliday | null;
  members: CalendarMember[];
  me: Me;
  leaveLabel: Record<LeaveType, string>;
};

export function DayDialog({ date, onClose, leaves, holiday, members, me, leaveLabel }: Props) {
  return (
    <Dialog open={date !== null} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-lg">
        {date && (
          <DayBody date={date} leaves={leaves} holiday={holiday} members={members} me={me} leaveLabel={leaveLabel} />
        )}
      </DialogContent>
    </Dialog>
  );
}

function useToastState(state: LeaveFormState) {
  const last = useRef<LeaveFormState>(undefined);
  useEffect(() => {
    if (!state || state === last.current) return;
    last.current = state;
    if (state.ok) toast.success(state.message);
    else toast.error(state.error);
  }, [state]);
}

function DayBody({ date, leaves, holiday, members, me, leaveLabel }: Omit<Props, "onClose"> & { date: string }) {
  const canAddLeave = me.isAdmin || me.memberId != null;
  const [leaveState, leaveAction, leavePending] = useActionState(addLeave, undefined);
  const [holidayState, holidayAction, holidayPending] = useActionState(addHoliday, undefined);
  useToastState(leaveState);
  useToastState(holidayState);
  const [deleting, startDelete] = useTransition();

  const remove = (fn: () => Promise<{ ok: boolean; error?: string }>) =>
    startDelete(async () => {
      const r = await fn();
      if (r.ok) toast.success("삭제했습니다.");
      else toast.error(r.error ?? "삭제에 실패했습니다.");
    });

  return (
    <>
      <DialogHeader>
        <DialogTitle>{formatKoDate(date)}</DialogTitle>
        <DialogDescription>
          {holiday ? `${holiday.name} · ` : ""}
          휴가 {leaves.length}건
        </DialogDescription>
      </DialogHeader>

      <div className="grid gap-2">
        {holiday && (
          <div className="flex items-center justify-between rounded-md bg-red-50 px-3 py-2 text-sm text-red-800">
            <span>{holiday.name}</span>
            {me.isAdmin && (
              <Button variant="ghost" size="icon" aria-label="휴무일 삭제" disabled={deleting} onClick={() => remove(() => deleteHoliday(holiday.id))}>
                <Trash2Icon className="size-4" />
              </Button>
            )}
          </div>
        )}
        {leaves.length === 0 && !holiday && <p className="text-sm text-muted-foreground">등록된 휴가가 없습니다.</p>}
        {leaves.map((l) => {
          const canDelete = me.isAdmin || me.memberId === l.memberId;
          return (
            <div key={l.id} className="flex items-center justify-between gap-2 rounded-md border px-3 py-2 text-sm">
              <div className="flex min-w-0 items-center gap-2">
                <span className="font-medium">{l.memberName}</span>
                <span className={cn("rounded px-1.5 py-0.5 text-xs font-medium", LEAVE_BADGE_CLASS[l.type])}>{leaveLabel[l.type]}</span>
                {l.note && <span className="truncate text-muted-foreground">{l.note}</span>}
              </div>
              {canDelete && (
                <Button variant="ghost" size="icon" aria-label={`${l.memberName} 휴가 삭제`} disabled={deleting} onClick={() => remove(() => deleteLeave(l.id))}>
                  <Trash2Icon className="size-4" />
                </Button>
              )}
            </div>
          );
        })}
      </div>

      {canAddLeave && (
        <>
          <Separator />
          <Button asChild variant="outline" className="justify-start">
            <Link href={`/schedule/requests/new?date=${date}`}>
              <FileTextIcon className="size-4" />
              이 날짜로 휴가 품의서 작성
            </Link>
          </Button>
        </>
      )}
      {me.isAdmin && (
        <>
          <Separator />
          <form action={leaveAction} className="grid gap-3">
            <div className="text-sm font-medium">빠른 등록 (관리자 · 품의서 없이 달력에만 기록)</div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="grid gap-1.5">
                <Label htmlFor="memberId">구성원</Label>
                {me.isAdmin ? (
                  <NativeSelect id="memberId" name="memberId" defaultValue={me.memberId ?? members[0]?.id} required className="w-full">
                    {members.map((m) => (
                      <NativeSelectOption key={m.id} value={m.id}>
                        {m.name} ({m.team})
                      </NativeSelectOption>
                    ))}
                  </NativeSelect>
                ) : (
                  <>
                    <input type="hidden" name="memberId" value={me.memberId ?? ""} />
                    <Input id="memberId" value={members.find((m) => m.id === me.memberId)?.name ?? ""} disabled />
                  </>
                )}
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="type">종류</Label>
                <NativeSelect id="type" name="type" defaultValue="annual" required className="w-full">
                  {LEAVE_TYPES.map((t) => (
                    <NativeSelectOption key={t} value={t}>
                      {leaveLabel[t]}
                    </NativeSelectOption>
                  ))}
                </NativeSelect>
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="start">시작일</Label>
                <Input id="start" name="start" type="date" defaultValue={date} required />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="end">종료일</Label>
                <Input id="end" name="end" type="date" defaultValue={date} required />
              </div>
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="note">메모 (선택)</Label>
              <Input id="note" name="note" placeholder="예: 가족 행사" maxLength={200} />
            </div>
            <p className="text-xs text-muted-foreground">여러 날을 선택하면 주말과 휴무일은 자동으로 제외됩니다.</p>
            <div className="flex justify-end">
              <Button type="submit" disabled={leavePending}>
                {leavePending && <Loader2Icon className="size-4 animate-spin" />}
                등록
              </Button>
            </div>
          </form>
        </>
      )}

      {me.isAdmin && !holiday && (
        <>
          <Separator />
          <form action={holidayAction} className="grid gap-3">
            <div className="text-sm font-medium">휴무일 등록 (관리자)</div>
            <input type="hidden" name="date" value={date} />
            <div className="flex gap-2">
              <Input name="name" placeholder="예: 창립기념일" maxLength={50} required />
              <Button type="submit" variant="outline" disabled={holidayPending}>
                {holidayPending && <Loader2Icon className="size-4 animate-spin" />}
                등록
              </Button>
            </div>
          </form>
        </>
      )}
    </>
  );
}
