import { CircleAlertIcon, HourglassIcon, PencilIcon } from "lucide-react";
import { formatKoDate, formatTime, parseKey } from "@/lib/dates";
import type { MilestoneUpdate, MonthlyGoal, WeeklyItem } from "@/lib/db/schema";
import { TASK_STATUS_CLASS, TASK_STATUS_MARK } from "@/lib/tasks/types";
import { APPROVAL_BADGE, APPROVAL_LABEL, OVERDUE_BADGE, STATUS_LABEL, STATUS_STYLE, isOverdue, type MilestoneRow } from "@/lib/milestones/types";
import { ApprovalActions } from "@/components/approval-actions";
import { decideMilestone } from "@/lib/milestones/actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import { DeleteMilestoneButton } from "./delete-milestone-button";
import { MilestoneFormDialog } from "./milestone-form-dialog";
import { UpdateForm } from "./update-form";

type Props = {
  milestone: MilestoneRow;
  updates: MilestoneUpdate[];
  linkedWeekly: WeeklyItem[];
  linkedGoals: MonthlyGoal[];
  memberName: Map<number, string>;
  today: string;
  ownerName: string | null;
  canManage: boolean;
  canUpdate: boolean;
  canApprove: boolean;
  /** Name of the member/user who proposed it (for pending/rejected). */
  proposerName: string | null;
  teams: { id: number; name: string }[];
  allowedTeamIds: number[] | "all";
  members: { id: number; name: string; team: string }[];
  closeHref: string;
};

function dday(due: string, today: string) {
  const diff = Math.round((parseKey(due).getTime() - parseKey(today).getTime()) / 86_400_000);
  if (diff === 0) return "오늘 마감";
  return diff > 0 ? `D-${diff}` : `${-diff}일 지남`;
}

export function MilestoneDetail({ milestone: m, updates, linkedWeekly, linkedGoals, memberName, today, ownerName, canManage, canUpdate, canApprove, proposerName, teams, allowedTeamIds, members, closeHref }: Props) {
  const style = STATUS_STYLE[m.status];
  const overdue = isOverdue(m, today);
  const totalDays = Math.round((parseKey(m.dueDate).getTime() - parseKey(m.startDate).getTime()) / 86_400_000) + 1;

  return (
    <div className="grid gap-4">
      <DialogHeader>
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="secondary">{m.team}</Badge>
          {m.approval !== "approved" && <Badge className={APPROVAL_BADGE[m.approval]}>{APPROVAL_LABEL[m.approval]}</Badge>}
          <Badge className={style.badge}>{STATUS_LABEL[m.status]}</Badge>
          {overdue && m.approval === "approved" && <Badge className={OVERDUE_BADGE}>지연</Badge>}
        </div>
        <DialogTitle className="text-xl">{m.title}</DialogTitle>
        <DialogDescription>
          {formatKoDate(m.startDate)} ~ {formatKoDate(m.dueDate)} · {totalDays}일 · {m.status === "done" ? "완료" : dday(m.dueDate, today)}
          {ownerName && ` · 담당 ${ownerName}`}
        </DialogDescription>
      </DialogHeader>

      {m.approval === "pending" && (
        <div className="flex flex-wrap items-center gap-3 rounded-xl border border-brand/25 bg-brand-soft/70 px-3 py-2.5 text-sm">
          <HourglassIcon className="size-4 shrink-0 text-brand" />
          <span className="min-w-0 flex-1">
            <b className="font-semibold text-accent-foreground">{proposerName ?? "구성원"}님의 제안</b>
            <span className="block text-xs text-muted-foreground">{canApprove ? "내용을 확인하고 승인하면 팀 일정과 주간 항목 연결에 반영됩니다." : "팀장이 승인하면 팀 일정에 반영됩니다."}</span>
          </span>
          {canApprove && <ApprovalActions decide={decideMilestone.bind(null, m.id)} title={m.title} />}
        </div>
      )}
      {m.approval === "rejected" && (
        <div className="flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 px-3 py-2.5 text-sm text-red-900">
          <CircleAlertIcon className="mt-0.5 size-4 shrink-0" />
          <span className="min-w-0 flex-1">
            <b className="font-semibold">{m.approvalByName ?? "팀장"}님이 반려했습니다</b>
            {m.approvalNote && <span className="block whitespace-pre-wrap">{m.approvalNote}</span>}
            {canManage && !canApprove && <span className="mt-1 block text-xs text-red-800/80">‘수정’에서 내용을 고쳐 저장하면 다시 승인 요청됩니다.</span>}
          </span>
          {canApprove && <ApprovalActions decide={decideMilestone.bind(null, m.id)} title={m.title} />}
        </div>
      )}

      <div className="grid gap-1.5">
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">진행률</span>
          <span className="font-medium tabular-nums">{m.progress}%</span>
        </div>
        <div className="h-2.5 overflow-hidden rounded-full bg-muted">
          <div className={cn("h-full rounded-full", style.fill.replace("/70", "").replace("/60", ""))} style={{ width: `${m.progress}%` }} />
        </div>
      </div>

      {m.description ? (
        <p className="whitespace-pre-wrap text-sm leading-relaxed">{m.description}</p>
      ) : (
        <p className="text-sm text-muted-foreground">설명이 없습니다.</p>
      )}

      {canManage && (
        <div className="flex justify-end gap-2">
          <MilestoneFormDialog
            mode="edit"
            milestone={m}
            teams={teams}
            allowedTeamIds={allowedTeamIds}
            members={members}
            trigger={
              <Button variant="outline" size="sm">
                <PencilIcon className="size-3.5" />
                수정
              </Button>
            }
          />
          <DeleteMilestoneButton id={m.id} title={m.title} closeHref={closeHref} />
        </div>
      )}

      <Separator />

      <div className="grid gap-2">
        <h3 className="text-sm font-semibold">
          참여 현황 <span className="font-normal text-muted-foreground">주간 항목 {linkedWeekly.filter((w) => w.status === "done").length}/{linkedWeekly.length} · 월간 목표 {linkedGoals.length}</span>
        </h3>
        {linkedWeekly.length === 0 && linkedGoals.length === 0 ? (
          <p className="text-xs text-muted-foreground">아직 연결된 개인 항목이 없습니다. 구성원이 내 업무 › 이번 주/이번 달에서 이 마일스톤에 항목을 연결하면 여기에 모입니다.</p>
        ) : (
          <div className="grid gap-2 sm:grid-cols-2">
            {[...new Set([...linkedWeekly.map((w) => w.memberId), ...linkedGoals.map((g) => g.memberId)])].map((memberId) => {
              const items = linkedWeekly.filter((w) => w.memberId === memberId);
              const goals = linkedGoals.filter((g) => g.memberId === memberId);
              return (
                <div key={memberId} className="rounded-md border px-2.5 py-2 text-xs">
                  <div className="mb-1 flex items-center justify-between">
                    <span className="font-medium">{memberName.get(memberId) ?? "?"}</span>
                    <span className="text-muted-foreground tabular-nums">{items.filter((w) => w.status === "done").length}/{items.length}</span>
                  </div>
                  {goals.map((g) => (
                    <div key={`g${g.id}`} className="truncate text-sky-900">◎ {g.month.slice(5)}월 목표 · {g.title}</div>
                  ))}
                  {items.map((w) => (
                    <div key={w.id} className="flex items-start gap-1 truncate">
                      <span className={cn("shrink-0", TASK_STATUS_CLASS[w.status])}>{TASK_STATUS_MARK[w.status]}</span>
                      <span className={cn("truncate", w.status === "done" && "text-muted-foreground line-through")}>{w.weekStart.slice(5).replace("-", "/")}주 · {w.title}</span>
                    </div>
                  ))}
                </div>
              );
            })}
          </div>
        )}
      </div>

      <Separator />

      <div className="grid gap-3">
        <h3 className="text-sm font-semibold">현황 업데이트 {updates.length > 0 && <span className="font-normal text-muted-foreground">{updates.length}건</span>}</h3>
        {canUpdate ? (
          <UpdateForm milestoneId={m.id} currentStatus={m.status} currentProgress={m.progress} />
        ) : (
          <p className="text-xs text-muted-foreground">{m.approval !== "approved" ? "승인된 뒤에 현황을 남길 수 있습니다." : "이 팀 구성원만 현황을 남길 수 있습니다."}</p>
        )}
        <ol className="grid gap-2">
          {updates.map((u) => (
            <li key={u.id} className="rounded-md border px-3 py-2 text-sm">
              <div className="mb-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                <span className="font-medium text-foreground">{u.authorName}</span>
                <span>{formatTime(u.createdAt)}</span>
                <Badge className={cn("h-4 px-1 text-[10px]", STATUS_STYLE[u.status].badge)}>{STATUS_LABEL[u.status]}</Badge>
                <span className="tabular-nums">{u.progress}%</span>
              </div>
              <p className="whitespace-pre-wrap">{u.note}</p>
            </li>
          ))}
        </ol>
      </div>
    </div>
  );
}
