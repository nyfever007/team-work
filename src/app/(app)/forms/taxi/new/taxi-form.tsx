"use client";

import { useActionState, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2Icon } from "lucide-react";
import { toast } from "sonner";
import { RETENTIONS, RETENTION_LABEL } from "@/lib/general/types";
import { createTaxiRequest, type TaxiFormState } from "@/lib/taxi/actions";
import { TAXI_DEFAULT_ATTACHMENT, TAXI_DEFAULT_REASON, TAXI_TITLE, periodLine } from "@/lib/taxi/types";
import { DateRangePicker, type KeyRange } from "@/components/date-picker";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";

type MemberInfo = { id: number; name: string; team: string; position: string };

export function TaxiForm({ members, defaultMemberId, today }: { members: MemberInfo[]; defaultMemberId: number; today: string }) {
  const router = useRouter();
  const [state, action, pending] = useActionState<TaxiFormState, FormData>(createTaxiRequest, undefined);
  const v = state && !state.ok ? state.values : undefined;
  const [memberId, setMemberId] = useState(Number(v?.memberId) || defaultMemberId);
  const [range, setRange] = useState<KeyRange>({ start: v?.useStart || today.slice(0, 8) + "01", end: v?.useEnd || today });
  const [amount, setAmount] = useState(v?.amount ?? "");
  const member = members.find((m) => m.id === memberId) ?? members[0];

  useEffect(() => {
    if (state?.ok) {
      toast.success(state.approved ? "품의서를 저장했습니다." : "택시비 지급 품의를 올렸습니다. 팀장이 승인하면 인쇄할 수 있습니다.");
      router.push(`/forms/taxi/${state.id}`);
    } else if (state && !state.ok) toast.error(state.error);
  }, [state, router]);

  return (
    <form action={action} className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_300px]">
      <div className="grid content-start gap-5">
        {members.length > 1 ? (
          <div className="grid gap-1.5">
            <Label htmlFor="memberId">작성자</Label>
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

        <div className="grid gap-1">
          <span className="text-sm font-medium">제목</span>
          <p className="rounded-lg border bg-muted/40 px-3 py-2 text-sm">{TAXI_TITLE}</p>
        </div>

        <div className="grid gap-4 rounded-xl border p-4">
          <div className="text-xs font-medium text-muted-foreground">- 아래 -</div>
          <div className="grid gap-1.5">
            <Label htmlFor="reason">
              1. 지급 요청 사유<span className="text-destructive">*</span>
            </Label>
            <Textarea id="reason" name="reason" rows={2} defaultValue={v?.reason ?? TAXI_DEFAULT_REASON} maxLength={500} required />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="use-range">
              2. 이용 기간<span className="text-destructive">*</span>
            </Label>
            <DateRangePicker id="use-range" startName="useStart" endName="useEnd" value={range} onChange={setRange} max={today} />
            <p className="text-xs text-muted-foreground">인쇄물: {periodLine(range.start, range.end)}</p>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="grid gap-1.5">
              <span className="text-sm font-medium">3. 부서명</span>
              <p className="rounded-lg border bg-muted/40 px-3 py-2 text-sm">{member.team}</p>
            </div>
            <div className="grid gap-1.5">
              <span className="text-sm font-medium">4. 작성 담당자</span>
              <p className="rounded-lg border bg-muted/40 px-3 py-2 text-sm">
                {member.position} {member.name}
              </p>
            </div>
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="amount">
              5. 총 이용 금액<span className="text-destructive">*</span>
            </Label>
            <div className="relative">
              <Input
                id="amount"
                name="amount"
                inputMode="numeric"
                value={amount}
                onChange={(e) => {
                  const d = e.target.value.replace(/[^\d]/g, "");
                  setAmount(d ? Number(d).toLocaleString("ko-KR") : "");
                }}
                required
                placeholder="0"
                className="pr-8 text-right tabular-nums"
              />
              <span className="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-sm text-muted-foreground">원</span>
            </div>
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="account">6. 지급계좌</Label>
            <Input id="account" name="account" defaultValue={v?.account ?? ""} maxLength={500} placeholder="은행 / 계좌번호 / 예금주" />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="attachment">첨부</Label>
            <Input id="attachment" name="attachment" defaultValue={v?.attachment ?? TAXI_DEFAULT_ATTACHMENT} maxLength={500} />
          </div>
        </div>

        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={() => router.back()} disabled={pending}>
            취소
          </Button>
          <Button type="submit" disabled={pending || !amount}>
            {pending && <Loader2Icon className="animate-spin" />}
            품의 올리기
          </Button>
        </div>
      </div>

      <aside className="grid content-start gap-3 rounded-xl border bg-muted/30 p-4 text-sm">
        <div className="text-xs font-medium text-muted-foreground">자동 입력 항목</div>
        <Row k="소속" v={member.team} />
        <Row k="직위" v={member.position} />
        <Row k="성명" v={member.name} />
        <Row k="작성일자" v={today} />
        <Row k="수신" v="경영지원실" />
        <div className="grid gap-1.5">
          <Label htmlFor="retention" className="text-muted-foreground">보존기간</Label>
          <NativeSelect id="retention" name="retention" defaultValue={v?.retention || "3"} className="w-full">
            {RETENTIONS.map((r) => (
              <NativeSelectOption key={r} value={r}>{RETENTION_LABEL[r]}</NativeSelectOption>
            ))}
          </NativeSelect>
        </div>
        <p className="text-xs text-muted-foreground">택시비 이용 내역서와 영수증은 따로 첨부해 제출하세요. 승인되면 1차 결재 작성자란에 이름과 날짜가 표시됩니다.</p>
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
