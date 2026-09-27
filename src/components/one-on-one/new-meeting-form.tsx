"use client";

import { useState, useTransition } from "react";
import { Loader2Icon, PlusIcon } from "lucide-react";
import { toast } from "sonner";
import { createOneOnOne } from "@/lib/one-on-one/actions";
import { DatePicker } from "@/components/date-picker";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { AiAgendaButton, appendText } from "./ai-agenda-button";

export function NewMeetingForm({ memberId, today, aiReady }: { memberId: number; today: string; aiReady: boolean }) {
  const [date, setDate] = useState(today);
  const [agenda, setAgenda] = useState("");
  const [pending, start] = useTransition();

  const submit = () =>
    start(async () => {
      try {
        const r = await createOneOnOne(memberId, date, agenda);
        if (!r.ok) return void toast.error(r.error);
        setAgenda("");
        setDate(today);
        toast.success(r.message);
      } catch {
        toast.error("1:1 추가에 실패했습니다.");
      }
    });

  return (
    <div className="grid gap-3">
      <div className="grid gap-1.5 sm:max-w-56">
        <Label htmlFor="oo-new-date">날짜</Label>
        <DatePicker id="oo-new-date" value={date} onChange={setDate} />
      </div>
      <div className="grid gap-1.5">
        <div className="flex items-center justify-between gap-2">
          <Label htmlFor="oo-new-agenda">안건</Label>
          {aiReady && <AiAgendaButton memberId={memberId} onInsert={(t) => setAgenda((p) => appendText(p, t))} />}
        </div>
        <Textarea id="oo-new-agenda" rows={4} value={agenda} onChange={(e) => setAgenda(e.target.value)} placeholder="다룰 안건" />
      </div>
      <div>
        <Button onClick={submit} disabled={pending}>
          {pending ? <Loader2Icon className="animate-spin" /> : <PlusIcon />}
          1:1 추가
        </Button>
      </div>
    </div>
  );
}
