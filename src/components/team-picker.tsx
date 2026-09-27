"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";

/** Admin-only team switcher for team-scoped pages: rewrites `?team=` on the current path (other params are dropped except `keep`). */
export function TeamSwitcher({ teams, value, keep = [] }: { teams: { id: number; name: string }[]; value: number; keep?: string[] }) {
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();
  if (teams.length < 2) return null;
  return (
    <NativeSelect
      aria-label="팀 선택"
      size="sm"
      value={value}
      onChange={(e) => {
        const q = new URLSearchParams({ team: e.target.value });
        for (const k of keep) {
          const v = sp.get(k);
          if (v) q.set(k, v);
        }
        router.push(`${pathname}?${q}`);
      }}
    >
      {teams.map((t) => (
        <NativeSelectOption key={t.id} value={t.id}>
          {t.name}
        </NativeSelectOption>
      ))}
    </NativeSelect>
  );
}
