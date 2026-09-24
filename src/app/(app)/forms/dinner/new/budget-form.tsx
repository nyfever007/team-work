"use client";

import { useActionState, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2Icon } from "lucide-react";
import { toast } from "sonner";
import { createDinnerBudget, type DinnerFormState } from "@/lib/dinner/actions";
import { DINNER_LIMIT_PER_PERSON, DINNER_TITLE, dinnerPurpose, headcountNumber } from "@/lib/dinner/types";
import { RETENTIONS, RETENTION_LABEL } from "@/lib/general/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { cn } from "@/lib/utils";

type MemberInfo = { id: number; name: string; team: string; position: string; teamMates?: string[] };
const won = (n: number) => n.toLocaleString("ko-KR");

/** Default 인원/금액 from the member's team: "4명 (A, B, C, D)" and 4 × 1인당 한도. */
function teamDefaults(m: MemberInfo) {
  const names = m.teamMates?.length ? m.teamMates : [m.name];
  return { headcount: `${names.length}명 (${names.join(", ")})`, amount: won(names.length * DINNER_LIMIT_PER_PERSON) };
}

export function BudgetForm({ members, defaultMemberId, today }: { members: MemberInfo[]; defaultMemberId: number; today: string }) {
  const router = useRouter();
  const [state, action, pending] = useActionState<DinnerFormState, FormData>(createDinnerBudget, undefined);
  const v = state && !state.ok ? state.values : undefined;
  const [memberId, setMemberId] = useState(Number(v?.memberId) || defaultMemberId);
  const initialMember = members.find((m) => m.id === (Number(v?.memberId) || defaultMemberId)) ?? members[0];
  const [headcount, setHeadcount] = useState(v?.headcount ?? teamDefaults(initialMember).headcount);
  const [amount, setAmount] = useState(v?.amount ?? teamDefaults(initialMember).amount);
  // Once the user edits 인원/금액, switching 작성자 no longer overwrites them.
  const [touched, setTouched] = useState(!!v);
  const [payMethod, setPayMethod] = useState(v?.payMethod ?? "법인카드");
  const member = members.find((m) => m.id === memberId) ?? members[0];
  const people = headcountNumber(headcount);
  const max = people ? people * DINNER_LIMIT_PER_PERSON : null;
  const amountNum = Number(amount.replace(/[^\d]/g, "")) || 0;
  const over = max != null && amountNum > max;

  useEffect(() => {
    if (state?.ok) {
      toast.success(state.approved ? "품의서를 저장했습니다." : "회식비 전산품의를 올렸습니다. 승인되면 회식 후 청구품의를 올릴 수 있습니다.");
      router.push(`/forms/dinner/${state.id}`);
    } else if (state && !state.ok) toast.error(state.error);
  }, [state, router]);

  return (
    <form action={action} className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_300px]">
      <div className="grid content-start gap-5">
        {members.length > 1 ? (
          <div className="grid gap-1.5">
            <Label htmlFor="memberId">작성자</Label>
            <NativeSelect
              id="memberId"
              name="memberId"
              value={memberId}
              onChange={(e) => {
                const id = Number(e.target.value);
                setMemberId(id);
                const next = members.find((m) => m.id === id);
                if (next && !touched) {
                  const d = teamDefaults(next);
                  setHeadcount(d.headcount);
                  setAmount(d.amount);
                }
              }}
              className="w-full"
            >
              {members.map((m) => (
                <NativeSelectOption key={m.id} value={m.id}>{m.name} · {m.team} · {m.position}</NativeSelectOption>
              ))}
            </NativeSelect>
          </div>
        ) : (
          <input type="hidden" name="memberId" value={member.id} />
        )}
        <Fixed label="제목" value={DINNER_TITLE.budget} />
        <div className="grid gap-4 rounded-xl border p-4">
          <div className="text-xs font-medium text-muted-foreground">- 아래 -</div>
          <Fixed label="1. 목적" value={dinnerPurpose(member.team)} />
          <div className="grid gap-1.5">
            <Label htmlFor="headcount">2. 인원<span className="text-destructive">*</span></Label>
            <Input
              id="headcount"
              name="headcount"
              value={headcount}
              onChange={(e) => {
                setHeadcount(e.target.value);
                setTouched(true);
              }}
              maxLength={300}
              required
              placeholder="예: 4명 (김민수, 이서연, 박지훈, 최유진)"
            />
            <p className="flex flex-wrap items-center gap-1 text-xs text-muted-foreground">
              팀 구성원 전원으로 채워 두었습니다. 참석자에 맞게 고쳐 주세요.
              <button
                type="button"
                className="underline underline-offset-2 hover:text-foreground"
                onClick={() => {
                  const d = teamDefaults(member);
                  setHeadcount(d.headcount);
                  setAmount(d.amount);
                  setTouched(false);
                }}
              >
                팀 전원으로 되돌리기
              </button>
            </p>
          </div>
          <Fixed label="3. 1인당 한도" value={`${won(DINNER_LIMIT_PER_PERSON)}원`} />
          <div className="grid gap-1.5">
            <Label htmlFor="amount">4. 금액<span className="text-destructive">*</span></Label>
            <div className="relative">
              <Input
                id="amount"
                name="amount"
                inputMode="numeric"
                value={amount}
                onChange={(e) => {
                  const d = e.target.value.replace(/[^\d]/g, "");
                  setAmount(d ? won(Number(d)) : "");
                  setTouched(true);
                }}
                required
                placeholder="0"
                aria-invalid={over}
                className="pr-8 text-right tabular-nums"
              />
              <span className="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-sm text-muted-foreground">원</span>
            </div>
            <p className={cn("text-xs", over ? "font-medium text-destructive" : "text-muted-foreground")}>
              {max != null ? `${people}명 × ${won(DINNER_LIMIT_PER_PERSON)}원 = 최대 ${won(max)}원${over ? " · 한도를 넘었습니다" : ""}` : "인원에 숫자를 넣으면 한도가 계산됩니다."}
            </p>
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="payMethod">5. 법인카드 or 현금 수령인<span className="text-destructive">*</span></Label>
            <Input id="payMethod" name="payMethod" value={payMethod} onChange={(e) => setPayMethod(e.target.value)} maxLength={300} required />
            <div className="flex gap-1.5">
              {["법인카드", `현금 수령인 : ${member.name}`].map((opt) => (
                <button key={opt} type="button" onClick={() => setPayMethod(opt)} className="rounded-full border bg-card px-2.5 py-0.5 text-xs text-muted-foreground hover:bg-accent hover:text-accent-foreground">
                  {opt}
                </button>
              ))}
            </div>
          </div>
        </div>
        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={() => router.back()} disabled={pending}>취소</Button>
          <Button type="submit" disabled={pending || over}>
            {pending && <Loader2Icon className="animate-spin" />}
            품의 올리기
          </Button>
        </div>
      </div>
      <Aside member={member} today={today} defaultRetention={v?.retention} note="승인되면 회식 후 ‘회식비 청구품의’에서 시기와 지급계좌만 입력해 정산을 올립니다. 남은 금액은 다음날 다른 용도로 사용할 수 없습니다." />
    </form>
  );
}

export function Fixed({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid gap-1">
      <span className="text-sm font-medium">{label}</span>
      <p className="rounded-lg border bg-muted/40 px-3 py-2 text-sm">{value}</p>
    </div>
  );
}

export function Aside({ member, today, defaultRetention, note }: { member: MemberInfo; today: string; defaultRetention?: string; note: string }) {
  return (
    <aside className="grid content-start gap-3 rounded-xl border bg-muted/30 p-4 text-sm">
      <div className="text-xs font-medium text-muted-foreground">자동 입력 항목</div>
      {[["소속", member.team], ["직위", member.position], ["성명", member.name], ["작성일자", today], ["수신", "경영지원실"]].map(([k, val]) => (
        <div key={k} className="flex justify-between gap-3">
          <span className="text-muted-foreground">{k}</span>
          <span className="text-right font-medium">{val}</span>
        </div>
      ))}
      <div className="grid gap-1.5">
        <Label htmlFor="retention" className="text-muted-foreground">보존기간</Label>
        <NativeSelect id="retention" name="retention" defaultValue={defaultRetention || "3"} className="w-full">
          {RETENTIONS.map((r) => (
            <NativeSelectOption key={r} value={r}>{RETENTION_LABEL[r]}</NativeSelectOption>
          ))}
        </NativeSelect>
      </div>
      <p className="text-xs text-muted-foreground">{note}</p>
    </aside>
  );
}
