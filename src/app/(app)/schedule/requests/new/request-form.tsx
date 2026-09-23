"use client";

import { useActionState, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2Icon } from "lucide-react";
import { toast } from "sonner";
import { LEAVE_COST, LEAVE_LABEL, LEAVE_TYPES, REASON_REQUIRED_TYPES, SINGLE_DAY_TYPES, type LeaveType } from "@/lib/leaves/types";
import { formatDays, requestAnnualCost, requestDates, requestDays } from "@/lib/requests/calc";
import { createLeaveRequest, type RequestFormState } from "@/lib/requests/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

type MemberInfo = { id: number; name: string; team: string; position: string; totalDays: number; annualTotal: number; usedDays: number; sickUsed: number; sickAllowance: number; period: string; yearIndex: number };

type Props = {
  members: MemberInfo[];
  defaultMemberId: number;
  defaultDate: string;
  today: string;
  holidays: string[];
  delegates: { id: number; name: string; team: string; phone: string }[];
};

export function RequestForm({ members, defaultMemberId, defaultDate, today, holidays, delegates }: Props) {
  const router = useRouter();
  const [state, action, pending] = useActionState<RequestFormState, FormData>(createLeaveRequest, undefined);
  const v = state && !state.ok ? state.values : undefined;
  const [memberId, setMemberId] = useState(Number(v?.memberId) || defaultMemberId);
  const [type, setType] = useState<LeaveType>((v?.type as LeaveType) || "annual");
  const [start, setStart] = useState(v?.startDate || defaultDate);
  const [end, setEnd] = useState(v?.endDate || defaultDate);
  const [delegate, setDelegate] = useState(v?.delegate ?? "");
  const [contact, setContact] = useState(v?.contact ?? "");
  const member = members.find((m) => m.id === memberId) ?? members[0];
  const single = SINGLE_DAY_TYPES.includes(type);
  const holidaySet = useMemo(() => new Set(holidays), [holidays]);

  const calc = useMemo(() => {
    const e = single ? start : end < start ? start : end;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(start) || !/^\d{4}-\d{2}-\d{2}$/.test(e)) return null;
    const dates = requestDates(type, start, e, holidaySet);
    const days = requestDays(type, dates);
    const cost = requestAnnualCost(type, dates);
    const used = member.usedDays + cost;
    return { dates, days, cost, used, remaining: member.totalDays - used };
  }, [type, start, end, single, holidaySet, member]);

  useEffect(() => {
    if (state?.ok) {
      toast.success("품의서를 저장했습니다. 달력에 반영되었습니다.");
      router.push(`/schedule/requests/${state.id}`);
    }
  }, [state, router]);

  const reasonRequired = REASON_REQUIRED_TYPES.includes(type);
  const span = daysBetween(start, single ? start : end) + 1;

  return (
    <form action={action} className="grid gap-6 lg:grid-cols-[1fr_300px]">
      <div className="grid gap-4">
        {members.length > 1 ? (
          <div className="grid gap-1.5">
            <Label htmlFor="memberId">작성자</Label>
            <NativeSelect id="memberId" name="memberId" value={memberId} onChange={(e) => setMemberId(Number(e.target.value))} className="w-full">
              {members.map((m) => (<NativeSelectOption key={m.id} value={m.id}>{m.name} · {m.team} · {m.position}</NativeSelectOption>))}
            </NativeSelect>
          </div>
        ) : (
          <input type="hidden" name="memberId" value={member.id} />
        )}

        <div className="grid gap-1.5">
          <Label>구분</Label>
          <div role="radiogroup" aria-label="구분" className="flex flex-wrap gap-1.5">
            {LEAVE_TYPES.map((t) => (
              <button key={t} type="button" role="radio" aria-checked={type === t} onClick={() => setType(t)} className={cn("rounded-md border px-3 py-1.5 text-sm transition-colors hover:bg-muted", type === t && "border-primary bg-primary text-primary-foreground hover:bg-primary")}>{LEAVE_LABEL[t]}</button>
            ))}
          </div>
          <input type="hidden" name="type" value={type} />
          <p className="text-xs text-muted-foreground">
            {type === "early_leave" && "조퇴는 일수에 포함되지 않고 연차도 차감되지 않습니다. 사유를 기재하세요."}
            {(type === "half_am" || type === "half_pm") && "반차는 하루만 선택하며 연차 0.5일이 차감됩니다."}
            {type === "annual" && "연차는 근무일 기준으로 1일씩 차감됩니다. 주말과 휴무일은 자동 제외됩니다."}
            {["official", "petition", "compensatory", "sick", "maternity", "other"].includes(type) && "연차가 차감되지 않는 구분입니다. 사유를 상세히 기재하고 증빙서류를 함께 제출하세요."}
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="grid gap-1.5">
            <Label htmlFor="startDate">{single ? "신청일자" : "시작일"}</Label>
            <Input id="startDate" name="startDate" type="date" value={start} onChange={(e) => { setStart(e.target.value); if (end < e.target.value) setEnd(e.target.value); }} required />
          </div>
          {!single && (
            <div className="grid gap-1.5">
              <Label htmlFor="endDate">종료일</Label>
              <Input id="endDate" name="endDate" type="date" value={end} min={start} onChange={(e) => setEnd(e.target.value)} required />
            </div>
          )}
        </div>

        <div className="grid gap-1.5">
          <Label htmlFor="reason">사유{reasonRequired && <span className="ml-1 text-destructive">*</span>}</Label>
          <Textarea id="reason" name="reason" rows={4} defaultValue={v?.reason ?? ""} placeholder={reasonRequired ? "상세히 기재해 주세요." : "선택 사항"} maxLength={1000} required={reasonRequired} />
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="grid gap-1.5">
            <Label htmlFor="delegatePick">업무대행</Label>
            <NativeSelect
              id="delegatePick"
              value=""
              className="w-full"
              aria-label="업무대행 선택"
              onChange={(e) => {
                const d = delegates.find((x) => String(x.id) === e.target.value);
                if (!d) return;
                setDelegate(d.name);
                if (d.phone) setContact(d.phone);
              }}
            >
              <NativeSelectOption value="">구성원에서 선택…</NativeSelectOption>
              {delegates.filter((d) => d.id !== member.id).map((d) => (
                <NativeSelectOption key={d.id} value={d.id}>
                  {d.name} · {d.team}{d.phone ? ` · ${d.phone}` : ""}
                </NativeSelectOption>
              ))}
            </NativeSelect>
            <Input id="delegate" name="delegate" value={delegate} onChange={(e) => setDelegate(e.target.value)} placeholder="또는 이름 직접 입력" maxLength={100} aria-label="업무대행" />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="contact">연락처</Label>
            <Input id="contact" name="contact" value={contact} onChange={(e) => setContact(e.target.value)} placeholder="010-0000-0000" maxLength={100} inputMode="tel" />
            <p className="text-xs text-muted-foreground">업무대행자를 선택하면 등록된 전화번호가 자동으로 들어갑니다. 수정할 수 있습니다.</p>
          </div>
        </div>

        {state && !state.ok && <p role="alert" className="text-sm text-destructive">{state.error}</p>}

        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={() => router.back()} disabled={pending}>취소</Button>
          <Button type="submit" disabled={pending || !calc || calc.dates.length === 0 || (calc.cost > 0 && calc.remaining < 0) || (type === "sick" && member.sickUsed + calc.days > member.sickAllowance)}>
            {pending && <Loader2Icon className="size-4 animate-spin" />}
            저장
          </Button>
        </div>
      </div>

      <aside className="grid gap-3 self-start rounded-lg border bg-muted/30 p-4 text-sm">
        <div className="text-xs font-medium text-muted-foreground">자동 입력 항목</div>
        <Row k="소속" v={member.team} />
        <Row k="직위" v={member.position} />
        <Row k="성명" v={member.name} />
        <Row k="작성일자" v={today} />
        <div className="my-1 border-t" />
        <Row k="신청일수" v={calc ? `${formatDays(calc.days)}일` : "—"} />
        <Row k="연차 차감" v={calc ? `${formatDays(calc.cost)}일` : "—"} muted={!!calc && calc.cost === 0} />
        <Row k="잔여일수" v={calc ? `${formatDays(calc.remaining)}일 (${formatDays(calc.used)}일 / ${formatDays(member.totalDays)}일)` : "—"} warn={!!calc && calc.remaining < 0} />
        {type === "sick" && calc && (
          <Row k="병가 잔여" v={`${formatDays(member.sickAllowance - member.sickUsed - calc.days)}일 (${formatDays(member.sickUsed + calc.days)}일 / ${member.sickAllowance}일)`} warn={member.sickUsed + calc.days > member.sickAllowance} />
        )}
        <p className="text-xs text-muted-foreground">연차 연도(입사일 기준 {member.yearIndex}년차): {member.period}{member.totalDays < member.annualTotal && ` · 연간 ${formatDays(member.annualTotal)}일 중 ${formatDays(member.totalDays)}일 발생`}</p>
        {calc && calc.dates.length === 0 && <p className="text-xs text-destructive">선택한 기간에 근무일이 없습니다.</p>}
        {calc && calc.dates.length > 0 && !single && calc.dates.length < span && <p className="text-xs text-muted-foreground">주말·휴무일 {span - calc.dates.length}일은 제외됩니다.</p>}
        <p className="text-xs text-muted-foreground">잔여일수 = 현재 사용 가능한 연차 − (본 신청 포함 사용 연차). {LEAVE_COST[type] === 0 && "이 구분은 연차를 차감하지 않습니다."}</p>
      </aside>
    </form>
  );
}

function daysBetween(a: string, b: string) {
  const d = (new Date(`${b}T00:00:00Z`).getTime() - new Date(`${a}T00:00:00Z`).getTime()) / 86_400_000;
  return Number.isFinite(d) && d >= 0 ? Math.round(d) : 0;
}

function Row({ k, v, warn, muted }: { k: string; v: string; warn?: boolean; muted?: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <span className="text-muted-foreground">{k}</span>
      <span className={cn("text-right font-medium tabular-nums", warn && "text-destructive", muted && "font-normal text-muted-foreground")}>{v}</span>
    </div>
  );
}
