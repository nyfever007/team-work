"use client";

import { useActionState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Loader2Icon } from "lucide-react";
import { toast } from "sonner";
import { createDinnerSettle, type DinnerFormState } from "@/lib/dinner/actions";
import { DINNER_TITLE, dinnerPurpose } from "@/lib/dinner/types";
import { DatePicker } from "@/components/date-picker";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Aside, Fixed } from "../../new/budget-form";

type Budget = { id: number; docNo: string; headcount: string; limitPerPerson: number; amount: number; payMethod: string; retention: number };
type MemberInfo = { id: number; name: string; team: string; position: string };
const won = (n: number) => n.toLocaleString("ko-KR");

export function SettleForm({ budget, member, today }: { budget: Budget; member: MemberInfo; today: string }) {
  const router = useRouter();
  const [state, action, pending] = useActionState<DinnerFormState, FormData>(createDinnerSettle.bind(null, budget.id), undefined);
  const v = state && !state.ok ? state.values : undefined;

  useEffect(() => {
    if (state?.ok) {
      toast.success(state.approved ? "품의서를 저장했습니다." : "회식비 청구품의를 올렸습니다.");
      router.push(`/forms/dinner/${state.id}`);
    } else if (state && !state.ok) toast.error(state.error);
  }, [state, router]);

  return (
    <form action={action} className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_300px]">
      <div className="grid content-start gap-5">
        <Fixed label="제목" value={DINNER_TITLE.settle} />
        <div className="grid gap-4 rounded-xl border p-4">
          <div className="text-xs font-medium text-muted-foreground">- 아래 - · 전산품의 {budget.docNo}에서 가져온 내용</div>
          <Fixed label="1. 목적" value={dinnerPurpose(member.team)} />
          <div className="grid gap-1.5">
            <Label>2. 시기<span className="text-destructive">*</span> <span className="text-xs font-normal text-muted-foreground">· 회식한 날</span></Label>
            <DatePicker name="dinnerDate" defaultValue={v?.dinnerDate || today} max={today} />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Fixed label="3. 인원" value={budget.headcount} />
            <Fixed label="4. 1인당 한도" value={`${won(budget.limitPerPerson)}원`} />
            <Fixed label="5. 금액" value={`${won(budget.amount)} 원`} />
            <Fixed label="6. 법인카드 or 현금 수령인" value={budget.payMethod} />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="account">7. 지급계좌 <span className="text-xs font-normal text-muted-foreground">· 개인비용 사용 시</span></Label>
            <Input id="account" name="account" defaultValue={v?.account ?? ""} maxLength={300} placeholder="은행 / 계좌번호 / 예금주" />
          </div>
        </div>
        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={() => router.back()} disabled={pending}>취소</Button>
          <Button type="submit" disabled={pending}>
            {pending && <Loader2Icon className="animate-spin" />}
            청구품의 올리기
          </Button>
        </div>
      </div>
      <Aside member={member} today={today} defaultRetention={v?.retention || String(budget.retention)} note="회식 영수증 1부를 첨부해 제출하세요. 남은 금액은 영수증과 함께 반납합니다." />
    </form>
  );
}
