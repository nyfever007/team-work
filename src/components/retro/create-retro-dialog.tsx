"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2Icon, PlusIcon } from "lucide-react";
import { toast } from "sonner";
import { createRetro } from "@/lib/retro/actions";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";

type Props = { teamId: number; milestones: { id: number; title: string }[] };

export function CreateRetroDialog({ teamId, milestones }: Props) {
  const [open, setOpen] = useState(false);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm">
          <PlusIcon />
          회고 만들기
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>회고 만들기</DialogTitle>
          <DialogDescription>Keep · Problem · Try로 팀 회고를 진행합니다.</DialogDescription>
        </DialogHeader>
        {/* Mounted only while open so the form resets each time. */}
        {open && <CreateRetroForm teamId={teamId} milestones={milestones} onCancel={() => setOpen(false)} />}
      </DialogContent>
    </Dialog>
  );
}

function CreateRetroForm({ teamId, milestones, onCancel }: Props & { onCancel: () => void }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [title, setTitle] = useState("");
  const [milestoneId, setMilestoneId] = useState("");
  const [anonymous, setAnonymous] = useState(true);

  return (
    <form
      className="grid gap-4"
      onSubmit={(e) => {
        e.preventDefault();
        start(async () => {
          try {
            const r = await createRetro(teamId, { title, milestoneId: milestoneId ? Number(milestoneId) : null, anonymous });
            if (r.ok) {
              toast.success(r.message);
              router.push(`/lounge/retro/${r.id}`);
            } else toast.error(r.error);
          } catch {
            toast.error("회고를 만들지 못했습니다.");
          }
        });
      }}
    >
      <div className="grid gap-1.5">
        <Label htmlFor="retro-title">제목</Label>
        <Input id="retro-title" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={100} placeholder="예: 9월 스프린트 회고" autoFocus required />
      </div>
      <div className="grid gap-1.5">
        <Label htmlFor="retro-milestone">마일스톤 (선택)</Label>
        <NativeSelect id="retro-milestone" value={milestoneId} onChange={(e) => setMilestoneId(e.target.value)}>
          <NativeSelectOption value="">연결 안 함</NativeSelectOption>
          {milestones.map((m) => (
            <NativeSelectOption key={m.id} value={m.id}>
              {m.title}
            </NativeSelectOption>
          ))}
        </NativeSelect>
      </div>
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" className="size-4 accent-brand" checked={anonymous} onChange={(e) => setAnonymous(e.target.checked)} />
        익명으로 진행 (작성자 이름 숨김)
      </label>
      <DialogFooter>
        <Button type="button" variant="outline" onClick={onCancel} disabled={pending}>
          취소
        </Button>
        <Button type="submit" disabled={pending || !title.trim()}>
          {pending && <Loader2Icon className="animate-spin" />}
          만들기
        </Button>
      </DialogFooter>
    </form>
  );
}
