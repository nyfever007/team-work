"use client";

import { useState, useTransition } from "react";
import { ChevronDownIcon, Loader2Icon, LockIcon, PlusIcon, SaveIcon, Trash2Icon } from "lucide-react";
import { toast } from "sonner";
import { addOneOnOneAction, deleteOneOnOne, updateOneOnOne, type MeetingInput } from "@/lib/one-on-one/actions";
import { ACTION_OWNERS, ACTION_OWNER_LABEL, ONE_ON_ONE_STATUSES, ONE_ON_ONE_STATUS_LABEL, type ActionOwner } from "@/lib/one-on-one/types";
import { DatePicker } from "@/components/date-picker";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { ActionList, type ActionItem } from "./action-list";
import { AiAgendaButton, appendText } from "./ai-agenda-button";

type Props = {
  meeting: MeetingInput & { id: number; memberId: number; memberAgenda: string; leaderName: string };
  dateLabel: string;
  actions: ActionItem[];
  aiReady: boolean;
  defaultOpen: boolean;
};

const same = (a: MeetingInput, b: MeetingInput) => a.date === b.date && a.status === b.status && a.agenda === b.agenda && a.notes === b.notes && a.privateNotes === b.privateNotes;

export function MeetingEditor({ meeting, dateLabel, actions, aiReady, defaultOpen }: Props) {
  const initial: MeetingInput = { date: meeting.date, status: meeting.status, agenda: meeting.agenda, notes: meeting.notes, privateNotes: meeting.privateNotes };
  const [value, setValue] = useState<MeetingInput>(initial);
  const [saved, setSaved] = useState<MeetingInput>(initial);
  const [open, setOpen] = useState(defaultOpen);
  const [actionTitle, setActionTitle] = useState("");
  const [owner, setOwner] = useState<ActionOwner>("member");
  const [pending, start] = useTransition();
  const dirty = !same(value, saved);
  const set = <K extends keyof MeetingInput>(k: K, v: MeetingInput[K]) => setValue((p) => ({ ...p, [k]: v }));
  const id = `oo-${meeting.id}`;
  const openCount = actions.filter((a) => !a.done).length;

  const save = () =>
    start(async () => {
      try {
        const r = await updateOneOnOne(meeting.id, value);
        if (!r.ok) return void toast.error(r.error);
        setSaved(value);
        toast.success(r.message);
      } catch {
        toast.error("저장에 실패했습니다.");
      }
    });

  const remove = () =>
    start(async () => {
      try {
        const r = await deleteOneOnOne(meeting.id);
        if (!r.ok) return void toast.error(r.error);
        toast.success(r.message);
      } catch {
        toast.error("삭제에 실패했습니다.");
      }
    });

  const addAction = () =>
    start(async () => {
      try {
        const r = await addOneOnOneAction(meeting.id, actionTitle, owner);
        if (!r.ok) return void toast.error(r.error);
        setActionTitle("");
      } catch {
        toast.error("추가에 실패했습니다.");
      }
    });

  return (
    <Card className="min-w-0">
      <CardHeader>
        <button type="button" onClick={() => setOpen((o) => !o)} aria-expanded={open} className="flex w-full items-center gap-2 text-left">
          <span className="font-semibold">{dateLabel}</span>
          <Badge className={saved.status === "planned" ? "bg-brand-soft text-accent-foreground" : "bg-emerald-100 text-emerald-800"}>{ONE_ON_ONE_STATUS_LABEL[saved.status]}</Badge>
          {openCount > 0 && <span className="text-xs text-muted-foreground">후속 조치 {openCount}개 진행 중</span>}
          {dirty && (
            <Badge variant="outline" className="text-amber-700">
              저장되지 않음
            </Badge>
          )}
          <ChevronDownIcon className={cn("ml-auto size-4 text-muted-foreground transition-transform", open && "rotate-180")} />
        </button>
      </CardHeader>
      {open && (
        <CardContent className="grid gap-4">
          <div className="flex flex-wrap items-end gap-3">
            <div className="grid gap-1.5">
              <Label htmlFor={`${id}-date`}>날짜</Label>
              <DatePicker id={`${id}-date`} value={value.date} onChange={(k) => set("date", k)} className="w-44" />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor={`${id}-status`}>상태</Label>
              <NativeSelect id={`${id}-status`} value={value.status} onChange={(e) => set("status", e.target.value as MeetingInput["status"])}>
                {ONE_ON_ONE_STATUSES.map((s) => (
                  <NativeSelectOption key={s} value={s}>
                    {ONE_ON_ONE_STATUS_LABEL[s]}
                  </NativeSelectOption>
                ))}
              </NativeSelect>
            </div>
            <span className="ml-auto text-xs text-muted-foreground">진행 {meeting.leaderName}</span>
          </div>

          <div className="grid gap-1.5">
            <div className="flex items-center justify-between gap-2">
              <Label htmlFor={`${id}-agenda`}>안건</Label>
              {aiReady && value.status === "planned" && <AiAgendaButton memberId={meeting.memberId} onInsert={(t) => set("agenda", appendText(value.agenda, t))} />}
            </div>
            <Textarea id={`${id}-agenda`} rows={3} value={value.agenda} onChange={(e) => set("agenda", e.target.value)} />
          </div>

          <div className="grid gap-1.5">
            <span className="text-sm font-medium">구성원이 올린 주제</span>
            <p className={cn("rounded-lg border bg-muted/40 px-3 py-2 text-sm whitespace-pre-wrap", !meeting.memberAgenda && "text-muted-foreground")}>{meeting.memberAgenda || "없음"}</p>
          </div>

          <div className="grid gap-1.5">
            <Label htmlFor={`${id}-notes`}>논의·합의</Label>
            <Textarea id={`${id}-notes`} rows={4} value={value.notes} onChange={(e) => set("notes", e.target.value)} placeholder="구성원에게 공개됩니다" />
          </div>

          <div className="grid gap-1.5 rounded-lg border border-amber-200 bg-amber-50/60 p-3">
            <Label htmlFor={`${id}-private`} className="flex items-center gap-1.5 text-amber-900">
              <LockIcon className="size-3.5" />
              팀장 메모 · 팀장만 보기
            </Label>
            <Textarea id={`${id}-private`} rows={3} value={value.privateNotes} onChange={(e) => set("privateNotes", e.target.value)} className="bg-card" />
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Button onClick={save} disabled={pending || !dirty}>
              {pending ? <Loader2Icon className="animate-spin" /> : <SaveIcon />}
              저장
            </Button>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="ghost" className="ml-auto text-destructive" disabled={pending}>
                  <Trash2Icon />
                  삭제
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>1:1을 삭제할까요?</AlertDialogTitle>
                  <AlertDialogDescription>{dateLabel} 기록과 후속 조치가 모두 삭제됩니다.</AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>취소</AlertDialogCancel>
                  <AlertDialogAction variant="destructive" onClick={remove}>
                    삭제
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>

          <div className="grid gap-2 border-t pt-4">
            <span className="text-sm font-medium">후속 조치</span>
            <ActionList actions={actions} toggle="all" canDelete empty="아직 없습니다." />
            <form
              className="flex flex-wrap gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                addAction();
              }}
            >
              <Input value={actionTitle} onChange={(e) => setActionTitle(e.target.value)} placeholder="후속 조치" aria-label="후속 조치" maxLength={200} className="min-w-40 flex-1" />
              <NativeSelect aria-label="담당" value={owner} onChange={(e) => setOwner(e.target.value as ActionOwner)}>
                {ACTION_OWNERS.map((o) => (
                  <NativeSelectOption key={o} value={o}>
                    {ACTION_OWNER_LABEL[o]}
                  </NativeSelectOption>
                ))}
              </NativeSelect>
              <Button type="submit" variant="outline" disabled={pending || !actionTitle.trim()}>
                <PlusIcon />
                추가
              </Button>
            </form>
          </div>
        </CardContent>
      )}
    </Card>
  );
}
