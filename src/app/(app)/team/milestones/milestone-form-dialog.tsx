"use client";

import { useActionState, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { Loader2Icon } from "lucide-react";
import { toast } from "sonner";
import { createMilestone, updateMilestone, type MilestoneFormState } from "@/lib/milestones/actions";
import { MILESTONE_STATUSES, STATUS_LABEL, type MilestoneRow } from "@/lib/milestones/types";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import { DateRangePicker } from "@/components/date-picker";

type Props = {
  mode: "create" | "edit";
  milestone?: MilestoneRow;
  teams: { id: number; name: string }[];
  allowedTeamIds: number[] | "all";
  members: { id: number; name: string; team: string }[];
  trigger: ReactNode;
  /** Creator is not a leader: the milestone is created as a proposal awaiting approval. */
  proposal?: boolean;
};

export function MilestoneFormDialog({ mode, milestone, teams, allowedTeamIds, members, trigger, proposal }: Props) {
  const [open, setOpen] = useState(false);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{mode === "create" ? (proposal ? "마일스톤 제안" : "마일스톤 추가") : "마일스톤 수정"}</DialogTitle>
          <DialogDescription>
            {mode === "create" ? (proposal ? "팀의 목표와 기간을 제안합니다. 팀장이 승인하면 팀 일정에 반영됩니다." : "팀의 목표와 기간을 정합니다.") : `‘${milestone?.title}’ 정보를 수정합니다.`}
            {mode === "edit" && milestone?.approval === "rejected" && " 저장하면 다시 승인 요청됩니다."}
          </DialogDescription>
        </DialogHeader>
        {open && <Form mode={mode} proposal={proposal} milestone={milestone} teams={teams} allowedTeamIds={allowedTeamIds} members={members} onDone={() => setOpen(false)} />}
      </DialogContent>
    </Dialog>
  );
}

function Form({ mode, proposal, milestone, teams, allowedTeamIds, members, onDone }: Omit<Props, "trigger"> & { onDone: () => void }) {
  const router = useRouter();
  const base = mode === "edit" && milestone ? updateMilestone.bind(null, milestone.id) : createMilestone;
  const [state, action, pending] = useActionState(async (prev: MilestoneFormState, fd: FormData) => {
    const r = await base(prev, fd);
    if (r?.ok) {
      toast.success(r.message);
      onDone();
      if (mode === "create") router.push(`/team/milestones?m=${r.id}`, { scroll: false });
    }
    return r;
  }, undefined);

  const v = state && !state.ok && state.values ? state.values : undefined;
  const val = (k: string, fallback: string | number | null | undefined) => v?.[k] ?? (fallback == null ? "" : String(fallback));
  const teamOptions = allowedTeamIds === "all" ? teams : teams.filter((t) => allowedTeamIds.includes(t.id));
  const fixedTeam = mode === "create" && teamOptions.length === 1 ? teamOptions[0] : null;

  return (
    <form action={action} className="grid gap-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="grid gap-1.5">
          <Label htmlFor="team">팀</Label>
          {fixedTeam ? (
            <>
              <input type="hidden" name="teamId" value={fixedTeam.id} />
              <Input id="team" value={fixedTeam.name} disabled />
            </>
          ) : (
            <NativeSelect id="team" name="teamId" defaultValue={val("teamId", milestone?.teamId ?? teamOptions[0]?.id)} required className="w-full">
              {teamOptions.map((t) => (
                <NativeSelectOption key={t.id} value={t.id}>
                  {t.name}
                </NativeSelectOption>
              ))}
            </NativeSelect>
          )}
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="ownerId">담당자 (선택)</Label>
          <NativeSelect id="ownerId" name="ownerId" defaultValue={val("ownerId", milestone?.ownerId)} className="w-full">
            <NativeSelectOption value="">없음</NativeSelectOption>
            {members.map((m) => (
              <NativeSelectOption key={m.id} value={m.id}>
                {m.name} ({m.team})
              </NativeSelectOption>
            ))}
          </NativeSelect>
        </div>
      </div>
      <div className="grid gap-1.5">
        <Label htmlFor="title">제목</Label>
        <Input id="title" name="title" maxLength={100} placeholder="예: 결제 시스템 v2 출시" defaultValue={val("title", milestone?.title)} required />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="grid gap-1.5 sm:col-span-2">
          <Label htmlFor="period">기간 (시작일 ~ 마감일)</Label>
          <DateRangePicker id="period" startName="startDate" endName="dueDate" defaultValue={{ start: val("startDate", milestone?.startDate) || undefined, end: val("dueDate", milestone?.dueDate) || undefined }} />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="status">상태</Label>
          <NativeSelect id="status" name="status" defaultValue={val("status", milestone?.status ?? "planned")} className="w-full">
            {MILESTONE_STATUSES.map((s) => (
              <NativeSelectOption key={s} value={s}>
                {STATUS_LABEL[s]}
              </NativeSelectOption>
            ))}
          </NativeSelect>
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="progress">진행률 (%)</Label>
          <Input id="progress" name="progress" type="number" min={0} max={100} step={5} defaultValue={val("progress", milestone?.progress ?? 0)} required />
        </div>
      </div>
      <div className="grid gap-1.5">
        <Label htmlFor="description">설명 (선택)</Label>
        <Textarea id="description" name="description" rows={4} placeholder="목표, 범위, 완료 기준" defaultValue={val("description", milestone?.description)} />
      </div>
      {state && !state.ok && (
        <p role="alert" className="text-sm text-destructive">
          {state.error}
        </p>
      )}
      <DialogFooter>
        <Button type="button" variant="outline" onClick={onDone}>
          취소
        </Button>
        <Button type="submit" disabled={pending}>
          {pending && <Loader2Icon className="size-4 animate-spin" />}
          {mode === "create" ? (proposal ? "제안하기" : "추가") : "저장"}
        </Button>
      </DialogFooter>
    </form>
  );
}
