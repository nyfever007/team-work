"use client";

import { useActionState, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ClockIcon, Loader2Icon } from "lucide-react";
import { toast } from "sonner";
import { createOvertimeRequest, type OvertimeFormState } from "@/lib/overtime/actions";
import { MAX_OVERTIME_HOURS, TIME_OPTIONS, formatHours, hoursBetween, isDateTime, overtimeLine } from "@/lib/overtime/types";
import { DatePicker } from "@/components/date-picker";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

type MemberInfo = { id: number; name: string; team: string; position: string; duty: string };

const EXAMPLE = `예) 개발본부 ○○○ 부사장님의 지시로
"○○ 외주용역" 발주를 위한 기능정의 작업을 수행하고자 합니다.
외주용역 발주를 위한 미팅이 차주 월요일 15시로 예정되어 있어
불가피하게 휴일근무를 신청합니다.`;

export function OvertimeForm({ members, defaultMemberId, defaultDate }: { members: MemberInfo[]; defaultMemberId: number; defaultDate: string }) {
  const router = useRouter();
  const [state, action, pending] = useActionState<OvertimeFormState, FormData>(createOvertimeRequest, undefined);
  const v = state && !state.ok ? state.values : undefined;
  const [memberId, setMemberId] = useState(Number(v?.memberId) || defaultMemberId);
  const [startDate, setStartDate] = useState(v?.startDate || defaultDate);
  const [startTime, setStartTime] = useState(v?.startTime || "19:00");
  const [endDate, setEndDate] = useState(v?.endDate || defaultDate);
  const [endTime, setEndTime] = useState(v?.endTime || "22:00");
  const member = members.find((m) => m.id === memberId) ?? members[0];

  const startAt = `${startDate}T${startTime}`;
  const endAt = `${endDate}T${endTime}`;
  const valid = isDateTime(startAt) && isDateTime(endAt);
  const hours = valid ? hoursBetween(startAt, endAt) : 0;
  const problem = !valid ? "날짜와 시간을 입력하세요." : hours <= 0 ? "종료 시각이 시작 시각보다 늦어야 합니다." : hours > MAX_OVERTIME_HOURS ? `한 번에 ${MAX_OVERTIME_HOURS}시간까지 신청할 수 있습니다.` : null;

  useEffect(() => {
    if (state?.ok) {
      toast.success(state.approved ? "신청서를 저장했습니다." : "시간외 근무를 신청했습니다. 팀장이 승인하면 인쇄할 수 있습니다.");
      router.push(`/forms/overtime/${state.id}`);
    } else if (state && !state.ok) toast.error(state.error);
  }, [state, router]);

  return (
    <form action={action} className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_300px]">
      <div className="grid content-start gap-5">
        {members.length > 1 ? (
          <div className="grid gap-1.5">
            <Label htmlFor="memberId">신청인</Label>
            <NativeSelect id="memberId" name="memberId" value={memberId} onChange={(e) => setMemberId(Number(e.target.value))} className="w-full">
              {members.map((m) => (
                <NativeSelectOption key={m.id} value={m.id}>
                  {m.name} · {m.team} · {m.position}
                </NativeSelectOption>
              ))}
            </NativeSelect>
          </div>
        ) : (
          <input type="hidden" name="memberId" value={member.id} />
        )}

        <fieldset className="grid gap-3">
          <legend className="mb-1.5 text-sm font-medium">시간외 근무일자 및 예상 근무 시간</legend>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="grid gap-1.5">
              <span className="text-xs text-muted-foreground">시작</span>
              <div className="flex gap-2">
                <DatePicker
                  name="startDate"
                  value={startDate}
                  onChange={(k) => {
                    setStartDate(k);
                    if (endDate < k) setEndDate(k);
                  }}
                  className="flex-1"
                />
                <NativeSelect name="startTime" value={startTime} onChange={(e) => setStartTime(e.target.value)} aria-label="시작 시각" className="w-28">
                  {TIME_OPTIONS.map((t) => (
                    <NativeSelectOption key={t} value={t}>{t}</NativeSelectOption>
                  ))}
                </NativeSelect>
              </div>
            </div>
            <div className="grid gap-1.5">
              <span className="text-xs text-muted-foreground">종료</span>
              <div className="flex gap-2">
                <DatePicker name="endDate" value={endDate} onChange={setEndDate} min={startDate} className="flex-1" />
                <NativeSelect name="endTime" value={endTime} onChange={(e) => setEndTime(e.target.value)} aria-label="종료 시각" className="w-28">
                  {TIME_OPTIONS.map((t) => (
                    <NativeSelectOption key={t} value={t}>{t}</NativeSelectOption>
                  ))}
                </NativeSelect>
              </div>
            </div>
          </div>
          <p className={cn("flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm", problem ? "bg-amber-50 text-amber-900" : "bg-brand-soft/60 text-accent-foreground")}>
            <ClockIcon className="size-4 shrink-0" />
            {problem ?? overtimeLine(startAt, endAt, hours)}
          </p>
        </fieldset>

        <div className="grid gap-1.5">
          <Label htmlFor="reason">
            시간외 근무 신청 사유 <span className="text-xs font-normal text-muted-foreground">· 자세히 기록</span>
          </Label>
          <Textarea id="reason" name="reason" rows={7} defaultValue={v?.reason ?? ""} maxLength={2000} required placeholder={EXAMPLE} />
          <p className="text-xs text-muted-foreground">누구의 지시로, 무엇을, 왜 근무시간 외에 해야 하는지 적어 주세요. 식대 등은 별도 품의로 진행합니다.</p>
        </div>

        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={() => router.back()} disabled={pending}>
            취소
          </Button>
          <Button type="submit" disabled={pending || !!problem}>
            {pending && <Loader2Icon className="animate-spin" />}
            신청하기
          </Button>
        </div>
      </div>

      <aside className="grid content-start gap-2 rounded-xl border bg-muted/30 p-4 text-sm">
        <div className="text-xs font-medium text-muted-foreground">신청인 (자동 입력)</div>
        <Row k="부서" v={member.team} />
        <Row k="직위" v={member.position} />
        <Row k="담당업무" v={member.duty} />
        <Row k="성명" v={member.name} />
        <div className="my-1 border-t" />
        <Row k="예상 근무 시간" v={problem ? "—" : formatHours(hours)} />
        <p className="mt-1 text-xs text-muted-foreground">신청일과 신청인 서명란은 인쇄물에 자동으로 들어갑니다. 시간외(휴일) 근무는 사전 승인이 원칙입니다.</p>
      </aside>
    </form>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex justify-between gap-3">
      <span className="text-muted-foreground">{k}</span>
      <span className="text-right font-medium">{v}</span>
    </div>
  );
}
