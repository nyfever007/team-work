"use client";

import { useRouter } from "next/navigation";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";

export function TeamPicker({ teams, value, weekStart }: { teams: { id: number; name: string }[]; value: number; weekStart: string }) {
  const router = useRouter();
  return (
    <NativeSelect aria-label="팀 선택" value={value} onChange={(e) => router.push(`/team/report?team=${e.target.value}&week=${weekStart}`)}>
      {teams.map((t) => (
        <NativeSelectOption key={t.id} value={t.id}>
          {t.name}
        </NativeSelectOption>
      ))}
    </NativeSelect>
  );
}
