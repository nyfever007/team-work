"use client";

import { useActionState, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2Icon } from "lucide-react";
import { toast } from "sonner";
import { createGeneralRequest, type GeneralFormState } from "@/lib/general/actions";
import { CURRENCIES, CURRENCY_INFO, RETENTIONS, RETENTION_LABEL, VAT_LABEL, VAT_MODES, amountLine, isCurrency, parseAmount, type Currency, type VatMode } from "@/lib/general/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";

type MemberInfo = { id: number; name: string; team: string; position: string };

/** Keep digits and (for currencies with decimals) one dot with up to N decimals; group thousands with commas. */
function formatTyping(text: string, currency: Currency): string {
  const d = CURRENCY_INFO[currency].decimals;
  const clean = text.replace(/[^\d.]/g, "");
  const [intRaw, ...rest] = clean.split(".");
  const int = intRaw.replace(/^0+(?=\d)/, "");
  const grouped = int ? Number(int).toLocaleString("en-US") : rest.length ? "0" : "";
  if (!d || rest.length === 0) return grouped;
  return `${grouped}.${rest.join("").slice(0, d)}`;
}

export function GeneralForm({ members, defaultMemberId, today }: { members: MemberInfo[]; defaultMemberId: number; today: string }) {
  const router = useRouter();
  const [state, action, pending] = useActionState<GeneralFormState, FormData>(createGeneralRequest, undefined);
  const v = state && !state.ok ? state.values : undefined;
  const [memberId, setMemberId] = useState(Number(v?.memberId) || defaultMemberId);
  const [amount, setAmount] = useState(v?.amount ?? "");
  const [currency, setCurrency] = useState<Currency>(isCurrency(v?.currency) ? v.currency : "KRW");
  const [vat, setVat] = useState<VatMode>((v?.vat as VatMode) || "included");
  const member = members.find((m) => m.id === memberId) ?? members[0];
  const parsed = parseAmount(amount, currency);
  const amountMinor = parsed != null && Number.isFinite(parsed) ? parsed : null;

  useEffect(() => {
    if (state?.ok) {
      toast.success(state.approved ? "품의서를 저장했습니다." : "품의서를 올렸습니다. 팀장이 승인하면 인쇄할 수 있습니다.");
      router.push(`/forms/general/${state.id}`);
    } else if (state && !state.ok) toast.error(state.error);
  }, [state, router]);

  return (
    <form action={action} className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_300px]">
      <div className="grid content-start gap-5">
        {members.length > 1 ? (
          <Field id="memberId" label="작성자">
            <NativeSelect id="memberId" name="memberId" value={memberId} onChange={(e) => setMemberId(Number(e.target.value))} className="w-full">
              {members.map((m) => (
                <NativeSelectOption key={m.id} value={m.id}>
                  {m.name} · {m.team} · {m.position}
                </NativeSelectOption>
              ))}
            </NativeSelect>
          </Field>
        ) : (
          <input type="hidden" name="memberId" value={member.id} />
        )}

        <Field id="title" label="제목" required>
          <Input id="title" name="title" defaultValue={v?.title ?? ""} maxLength={120} required placeholder="예: 2026년 하반기 디자인 외주 용역 계약 품의" />
        </Field>

        <div className="grid gap-4 rounded-xl border p-4">
          <div className="text-xs font-medium text-muted-foreground">- 아래 -</div>
          <Field id="purpose" label="1. 목적" required>
            <Textarea id="purpose" name="purpose" rows={2} defaultValue={v?.purpose ?? ""} maxLength={500} required placeholder="무엇을 위해 필요한지" />
          </Field>
          <Field id="vendor" label="2. 거래처">
            <Input id="vendor" name="vendor" defaultValue={v?.vendor ?? ""} maxLength={500} placeholder="업체명 (사업자번호)" />
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field id="period" label="3. 기간" hint="용역일 때 · 비우면 인쇄물에서 빠집니다">
              <Input id="period" name="period" defaultValue={v?.period ?? ""} maxLength={500} placeholder="예: 2026.10.01 ~ 2026.12.31 / 계약일로부터 3개월" />
            </Field>
            <Field id="timing" label="4. 시기" hint="지급일자 · 비우면 빠집니다">
              <Input id="timing" name="timing" defaultValue={v?.timing ?? ""} maxLength={500} placeholder="예: 2026.10.15 / 검수 완료 후 30일 이내" />
            </Field>
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="amount">5. 금액</Label>
            <div className="flex flex-wrap gap-2">
              <NativeSelect
                name="currency"
                value={currency}
                onChange={(e) => {
                  const next = e.target.value as Currency;
                  setCurrency(next);
                  setAmount((a) => formatTyping(a, next));
                }}
                aria-label="통화"
                className="w-32"
              >
                {CURRENCIES.map((c) => (
                  <NativeSelectOption key={c} value={c}>{CURRENCY_INFO[c].label}</NativeSelectOption>
                ))}
              </NativeSelect>
              <div className="relative min-w-40 flex-1">
                <Input
                  id="amount"
                  name="amount"
                  inputMode="decimal"
                  value={amount}
                  onChange={(e) => setAmount(formatTyping(e.target.value, currency))}
                  placeholder={CURRENCY_INFO[currency].decimals ? "0.00" : "0"}
                  className="pr-12 text-right tabular-nums"
                />
                <span className="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-sm text-muted-foreground">{currency === "KRW" ? "원" : currency}</span>
              </div>
              <NativeSelect name="vat" value={vat} onChange={(e) => setVat(e.target.value as VatMode)} aria-label="VAT 포함 여부" className="w-36">
                {VAT_MODES.map((m) => (
                  <NativeSelectOption key={m} value={m}>{VAT_LABEL[m]}</NativeSelectOption>
                ))}
              </NativeSelect>
            </div>
          </div>
          <Field id="account" label="6. 지급계좌">
            <Input id="account" name="account" defaultValue={v?.account ?? ""} maxLength={500} placeholder="은행 / 계좌번호 / 예금주" />
          </Field>
          <Field id="extra" label="추가 내용" hint="양식에 없는 항목이 필요하면 적어 주세요">
            <Textarea id="extra" name="extra" rows={4} defaultValue={v?.extra ?? ""} maxLength={3000} placeholder={"예) 7. 계약 조건 : 선금 30%, 잔금 70%\n예) 8. 비교 견적 : A사 1,200,000원 / B사 1,350,000원"} />
          </Field>
          <Field id="attachment" label="첨부">
            <Input id="attachment" name="attachment" defaultValue={v?.attachment ?? ""} maxLength={500} placeholder="예: 견적서 1부, 사업자등록증 사본 1부" />
          </Field>
        </div>

        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={() => router.back()} disabled={pending}>
            취소
          </Button>
          <Button type="submit" disabled={pending}>
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
        <div className="grid gap-1.5">
          <Label htmlFor="retention" className="text-muted-foreground">보존기간</Label>
          <NativeSelect id="retention" name="retention" defaultValue={v?.retention || "3"} className="w-full">
            {RETENTIONS.map((r) => (
              <NativeSelectOption key={r} value={r}>{RETENTION_LABEL[r]}</NativeSelectOption>
            ))}
          </NativeSelect>
        </div>
        <div className="border-t pt-2">
          <Row k="금액" v={amountLine(amountMinor, currency, vat) || "—"} />
        </div>
        <p className="text-xs text-muted-foreground">문서번호·작성일자·작성자 정보는 인쇄물에 자동으로 들어갑니다. 승인되면 1차 결재 작성자란에 이름과 날짜가 표시됩니다.</p>
      </aside>
    </form>
  );
}

function Field({ id, label, hint, required, children }: { id: string; label: string; hint?: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div className="grid gap-1.5">
      <Label htmlFor={id}>
        {label}
        {required && <span className="text-destructive">*</span>}
        {hint && <span className="text-xs font-normal text-muted-foreground">· {hint}</span>}
      </Label>
      {children}
    </div>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex justify-between gap-3">
      <span className="text-muted-foreground">{k}</span>
      <span className="text-right font-medium tabular-nums">{v}</span>
    </div>
  );
}
