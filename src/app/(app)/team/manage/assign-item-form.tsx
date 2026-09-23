"use client";

import { useState, useTransition } from "react";
import { Loader2Icon, PlusIcon, XIcon } from "lucide-react";
import { toast } from "sonner";
import { assignWeeklyItem, deleteWeeklyItem } from "@/lib/plans/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";

export function AssignItemForm({ memberId, memberName, weekStart, milestones }: { memberId: number; memberName: string; weekStart: string; milestones: { id: number; title: string }[] }) {
  const [title, setTitle] = useState("");
  const [ms, setMs] = useState("");
  const [pending, start] = useTransition();
  return (
    <form
      className="grid gap-1.5"
      onSubmit={(e) => {
        e.preventDefault();
        const t = title.trim();
        if (!t) return;
        start(async () => {
          try {
            const r = await assignWeeklyItem(memberId, weekStart, t, ms ? Number(ms) : null);
            if (r.ok) {
              toast.success(`${memberName}님의 이번 주 항목으로 지정했습니다.`);
              setTitle("");
            } else toast.error(r.error);
          } catch {
            toast.error("지정에 실패했습니다.");
          }
        });
      }}
    >
      <div className="flex gap-1.5">
        <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder={`${memberName}님에게 지정할 항목`} maxLength={200} disabled={pending} className="h-8 text-sm" aria-label={`${memberName} 항목 지정`} />
        <Button type="submit" size="sm" className="h-8" disabled={pending || !title.trim()}>
          {pending ? <Loader2Icon className="size-3.5 animate-spin" /> : <PlusIcon className="size-3.5" />}
          지정
        </Button>
      </div>
      {milestones.length > 0 && (
        <NativeSelect size="sm" value={ms} onChange={(e) => setMs(e.target.value)} aria-label={`${memberName} 지정 항목 마일스톤`} className="w-fit">
          <NativeSelectOption value="">마일스톤 연결 안 함</NativeSelectOption>
          {milestones.map((m) => (<NativeSelectOption key={m.id} value={m.id}>{m.title}</NativeSelectOption>))}
        </NativeSelect>
      )}
    </form>
  );
}

export function RemoveAssignedButton({ id, title }: { id: number; title: string }) {
  const [pending, start] = useTransition();
  return (
    <button
      type="button"
      aria-label={`${title} 지정 취소`}
      title="지정 취소"
      disabled={pending}
      className="ml-auto shrink-0 rounded p-0.5 text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-50"
      onClick={() =>
        start(async () => {
          const r = await deleteWeeklyItem(id);
          if (r.ok) toast.success("지정을 취소했습니다.");
          else toast.error(r.error);
        })
      }
    >
      <XIcon className="size-3.5" />
    </button>
  );
}
