"use client";

import { useActionState, useEffect, useRef } from "react";
import { Loader2Icon } from "lucide-react";
import { toast } from "sonner";
import { addMilestoneUpdate, type UpdateFormState } from "@/lib/milestones/actions";
import { MILESTONE_STATUSES, STATUS_LABEL, type MilestoneStatus } from "@/lib/milestones/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";

export function UpdateForm({ milestoneId, currentStatus, currentProgress }: { milestoneId: number; currentStatus: MilestoneStatus; currentProgress: number }) {
  const [state, action, pending] = useActionState(addMilestoneUpdate.bind(null, milestoneId), undefined);
  const formRef = useRef<HTMLFormElement>(null);
  const last = useRef<UpdateFormState>(undefined);

  useEffect(() => {
    if (!state || state === last.current) return;
    last.current = state;
    if (state.ok) {
      toast.success(state.message);
      formRef.current?.reset();
    } else toast.error(state.error);
  }, [state]);

  return (
    <form ref={formRef} action={action} className="grid gap-3 rounded-md bg-muted/40 p-3">
      <div className="grid gap-1.5">
        <Label htmlFor="note">현황</Label>
        <Textarea id="note" name="note" rows={3} placeholder="진행 상황, 이슈, 다음 단계를 짧게 적어 주세요." required className="bg-background" />
      </div>
      <div className="flex flex-wrap items-end gap-3">
        <div className="grid gap-1.5">
          <Label htmlFor="status">상태</Label>
          <NativeSelect id="status" name="status" defaultValue={currentStatus} className="bg-background">
            {MILESTONE_STATUSES.map((s) => (
              <NativeSelectOption key={s} value={s}>
                {STATUS_LABEL[s]}
              </NativeSelectOption>
            ))}
          </NativeSelect>
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="progress">진행률 (%)</Label>
          <Input id="progress" name="progress" type="number" min={0} max={100} step={5} defaultValue={currentProgress} className="w-24 bg-background" />
        </div>
        <Button type="submit" size="sm" disabled={pending} className="ml-auto">
          {pending && <Loader2Icon className="size-4 animate-spin" />}
          현황 남기기
        </Button>
      </div>
    </form>
  );
}
