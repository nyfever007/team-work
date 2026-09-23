"use client";

import { useActionState, useEffect, useState } from "react";
import { defaultAnnualDays, describeAnnualRule, leaveYear } from "@/lib/leaves/policy";
import { Loader2Icon } from "lucide-react";
import { toast } from "sonner";
import type { Member, Team } from "@/lib/members/types";
import { createMember, updateMember, type MemberFormState } from "@/lib/members/actions";
import { Button } from "@/components/ui/button";
import { DialogClose, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";

type Props = {
  member?: Member;
  teams: Pick<Team, "id" | "name">[];
  onSaved: () => void;
};

export function MemberForm({ member, teams, onSaved }: Props) {
  const action = member ? updateMember.bind(null, member.id) : createMember;
  const [state, formAction, pending] = useActionState<MemberFormState, FormData>(action, undefined);

  useEffect(() => {
    if (state?.ok) {
      toast.success(member ? "구성원 정보를 수정했습니다." : "구성원을 추가했습니다.");
      onSaved();
    }
  }, [state, member, onSaved]);

  const values = state && !state.ok ? state.values : undefined;
  const [joined, setJoined] = useState<string>(String(values?.joinedAt ?? member?.joinedAt ?? ""));
  const [annualMode, setAnnualMode] = useState<"auto" | "override">(values ? (values.annualOverride == null ? "auto" : "override") : member?.annualOverride != null ? "override" : "auto");
  const today = new Date().toISOString().slice(0, 10);
  const preview = /^\d{4}-\d{2}-\d{2}$/.test(joined) && joined <= today ? leaveYear(joined, today) : null;
  const errors = state && !state.ok ? state.fieldErrors ?? {} : {};

  const field = (key: keyof NonNullable<typeof values>, fallback: string | number | undefined) =>
    values?.[key] ?? fallback ?? "";

  return (
    <form action={formAction} className="grid gap-4">
      <div className="grid gap-2">
        <Label htmlFor="teamId">팀</Label>
        <NativeSelect id="teamId" name="teamId" defaultValue={String(field("teamId", member?.teamId ?? teams[0]?.id))} required className="w-full">
          {teams.length === 0 && <NativeSelectOption value="">팀이 없습니다. 팀 관리에서 먼저 만드세요.</NativeSelectOption>}
          {teams.map((t) => (
            <NativeSelectOption key={t.id} value={t.id}>
              {t.name}
            </NativeSelectOption>
          ))}
        </NativeSelect>
        <FieldError message={errors.teamId} />
      </div>
      <div className="grid gap-2">
        <Label htmlFor="name">이름</Label>
        <Input id="name" name="name" defaultValue={field("name", member?.name)} required />
        <FieldError message={errors.name} />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="grid gap-2">
          <Label htmlFor="position">직책</Label>
          <Input id="position" name="position" placeholder="예: 백엔드 엔지니어" defaultValue={field("position", member?.position)} required />
          <FieldError message={errors.position} />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="rank">직급</Label>
          <Input id="rank" name="rank" placeholder="예: 대리" defaultValue={field("rank", member?.rank)} />
          <FieldError message={errors.rank} />
        </div>
      </div>
      <div className="grid gap-2">
        <Label htmlFor="email">이메일</Label>
        <Input id="email" name="email" type="email" placeholder="name@company.com" defaultValue={field("email", member?.email)} required />
        <p className="text-xs text-muted-foreground">로그인 아이디로 사용됩니다. 계정 연결 시 관리자는 초기 비밀번호만 정합니다.</p>
        <FieldError message={errors.email} />
      </div>
      <div className="grid gap-2">
        <Label htmlFor="phone">전화번호</Label>
        <Input id="phone" name="phone" type="tel" placeholder="010-0000-0000" defaultValue={field("phone", member?.phone)} />
        <p className="text-xs text-muted-foreground">휴가 품의서에서 업무대행자로 선택되면 연락처에 자동으로 들어갑니다.</p>
        <FieldError message={errors.phone} />
      </div>
      <div className="grid gap-2">
        <Label htmlFor="joinedAt">입사일</Label>
        <Input id="joinedAt" name="joinedAt" type="date" value={joined} onChange={(e) => setJoined(e.target.value)} required />
        <FieldError message={errors.joinedAt} />
      </div>
      <div className="grid gap-2 rounded-md border p-3">
        <Label>연차</Label>
        <input type="hidden" name="annualMode" value={annualMode} />
        <div role="radiogroup" aria-label="연차 설정" className="flex flex-wrap gap-1.5">
          <button type="button" role="radio" aria-checked={annualMode === "auto"} onClick={() => setAnnualMode("auto")} className={`rounded-md border px-3 py-1.5 text-sm ${annualMode === "auto" ? "border-primary bg-primary text-primary-foreground" : "hover:bg-muted"}`}>
            회사 기본 규칙
          </button>
          <button type="button" role="radio" aria-checked={annualMode === "override"} onClick={() => setAnnualMode("override")} className={`rounded-md border px-3 py-1.5 text-sm ${annualMode === "override" ? "border-primary bg-primary text-primary-foreground" : "hover:bg-muted"}`}>
            계약에 따라 직접 지정
          </button>
        </div>
        {annualMode === "auto" ? (
          <p className="text-xs text-muted-foreground">
            {preview
              ? `현재 ${preview.yearIndex}년차 → 연간 ${defaultAnnualDays(preview.yearIndex)}일 (${describeAnnualRule(preview.yearIndex)}). 연차 연도 ${preview.start} ~ ${preview.end}.`
              : "입사일을 입력하면 기본 규칙에 따른 연차가 표시됩니다."}{" "}
            규칙: 1년차 매월 1일(총 12일), 2~3년차 15일, 4년차부터 매년 +1일(최대 25일). 입사 기념일에 리셋됩니다.
          </p>
        ) : (
          <div className="grid gap-1.5">
            <Input id="annualOverride" name="annualOverride" type="number" step="0.5" min="0" inputMode="decimal" placeholder="예: 20" defaultValue={values?.annualOverride ?? member?.annualOverride ?? ""} aria-label="연차 일수 지정" required />
            <p className="text-xs text-muted-foreground">연차 연도(입사 기념일 ~ 다음 기념일 전날)마다 이 일수가 부여됩니다.</p>
            <FieldError message={errors.annualOverride} />
          </div>
        )}
      </div>
      {state && !state.ok && state.error && (
        <p role="alert" className="text-sm text-destructive">
          {state.error}
        </p>
      )}
      <DialogFooter>
        <DialogClose asChild>
          <Button type="button" variant="outline">
            취소
          </Button>
        </DialogClose>
        <Button type="submit" disabled={pending}>
          {pending && <Loader2Icon className="size-4 animate-spin" />}
          {member ? "저장" : "추가"}
        </Button>
      </DialogFooter>
    </form>
  );
}

function FieldError({ message }: { message?: string }) {
  if (!message) return null;
  return <p className="text-xs text-destructive">{message}</p>;
}
