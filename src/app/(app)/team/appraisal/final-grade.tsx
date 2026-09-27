"use client";

import { useTransition } from "react";
import { toast } from "sonner";
import { setFinalGrade } from "@/lib/evaluations/actions";
import { GRADE_LETTERS, type Grade } from "@/lib/evaluations/types";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";

/** 최종 고과 picker (saved on change). */
export function FinalGradeSelect({ memberId, quarter, value, suggested }: { memberId: number; quarter: string; value: Grade | null; suggested: Grade | null }) {
  const [pending, start] = useTransition();
  return (
    <NativeSelect
      size="sm"
      value={value ?? ""}
      disabled={pending}
      aria-label="최종 고과"
      onChange={(e) => {
        const g = (e.target.value || null) as Grade | null;
        start(async () => {
          try {
            const r = await setFinalGrade(memberId, quarter, g);
            if (r.ok) toast.success(r.message);
            else toast.error(r.error);
          } catch {
            toast.error("저장에 실패했습니다.");
          }
        });
      }}
    >
      <NativeSelectOption value="">{suggested ? `미정 (제안 ${suggested})` : "미정"}</NativeSelectOption>
      {GRADE_LETTERS.map((g) => (
        <NativeSelectOption key={g} value={g}>{g}</NativeSelectOption>
      ))}
    </NativeSelect>
  );
}
