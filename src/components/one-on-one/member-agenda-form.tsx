"use client";

import { useState, useTransition } from "react";
import { Loader2Icon, SaveIcon } from "lucide-react";
import { toast } from "sonner";
import { updateMemberAgenda } from "@/lib/one-on-one/actions";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

export function MemberAgendaForm({ meetingId, initial }: { meetingId: number; initial: string }) {
  const [value, setValue] = useState(initial);
  const [saved, setSaved] = useState(initial);
  const [pending, start] = useTransition();
  const id = `oo-member-${meetingId}`;

  const save = () =>
    start(async () => {
      try {
        const r = await updateMemberAgenda(meetingId, value);
        if (!r.ok) return void toast.error(r.error);
        setSaved(value);
        toast.success(r.message);
      } catch {
        toast.error("저장에 실패했습니다.");
      }
    });

  return (
    <div className="grid gap-1.5">
      <Label htmlFor={id}>이야기하고 싶은 주제</Label>
      <Textarea id={id} rows={3} value={value} onChange={(e) => setValue(e.target.value)} />
      <div>
        <Button size="sm" onClick={save} disabled={pending || value === saved}>
          {pending ? <Loader2Icon className="animate-spin" /> : <SaveIcon />}
          저장
        </Button>
      </div>
    </div>
  );
}
