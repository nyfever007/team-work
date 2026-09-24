import Link from "next/link";
import { FlagIcon, InboxIcon, PalmtreeIcon, SendIcon } from "lucide-react";
import type { LeaveRequest } from "@/lib/db/schema";
import { LEAVE_BADGE_CLASS, LEAVE_LABEL, REQUEST_STATUS_CLASS, REQUEST_STATUS_LABEL } from "@/lib/leaves/types";
import { decideMilestone } from "@/lib/milestones/actions";
import { APPROVAL_BADGE, APPROVAL_LABEL, type MilestoneRow } from "@/lib/milestones/types";
import { decideLeaveRequest } from "@/lib/requests/actions";
import { formatDays } from "@/lib/requests/calc";
import { ApprovalActions } from "@/components/approval-actions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

const short = (key: string) => key.slice(5).replace("-", "/");
const period = (a: string, b: string) => (a === b ? short(a) : `${short(a)} ~ ${short(b)}`);

/** Leader/admin: everything waiting for a decision (leave requests first — they are time-sensitive). */
export function ApprovalInbox({ leaves, milestones, proposerName }: { leaves: LeaveRequest[]; milestones: MilestoneRow[]; proposerName: Map<number, string> }) {
  const total = leaves.length + milestones.length;
  if (total === 0) return null;
  return (
    <section className="rounded-2xl border border-brand/25 bg-gradient-to-r from-brand-soft to-card p-4 shadow-xs sm:p-5">
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <span className="grid size-8 place-items-center rounded-lg bg-brand text-white shadow-sm shadow-brand/30">
          <InboxIcon className="size-4" />
        </span>
        <h2 className="text-base font-bold">
          승인 대기 <span className="text-brand tabular-nums">{total}</span>건
        </h2>
        <span className="text-sm text-muted-foreground">
          {[leaves.length && `휴가 품의 ${leaves.length}`, milestones.length && `마일스톤 ${milestones.length}`].filter(Boolean).join(" · ")}
        </span>
      </div>
      <ul className="grid gap-2">
        {leaves.map((r) => (
          <li key={`l${r.id}`} className="flex flex-wrap items-center gap-x-4 gap-y-2 rounded-xl border bg-card px-3 py-2.5">
            <Link href={`/schedule/requests/${r.id}`} className="group min-w-0 flex-1">
              <span className="flex items-center gap-1.5 font-semibold group-hover:underline">
                <PalmtreeIcon className="size-3.5 shrink-0 text-sky-600" />
                {r.memberName}
                <span className={cn("rounded px-1.5 py-0.5 text-[11px] font-medium", LEAVE_BADGE_CLASS[r.type])}>{LEAVE_LABEL[r.type]}</span>
                <span className="font-normal tabular-nums">
                  {period(r.startDate, r.endDate)} · {formatDays(r.days)}일
                </span>
              </span>
              <span className="block truncate text-xs text-muted-foreground">
                {r.teamName} · {r.docNo}
                {r.reason && ` · ${r.reason}`}
              </span>
            </Link>
            <ApprovalActions decide={decideLeaveRequest.bind(null, r.id)} title={`${r.memberName} ${LEAVE_LABEL[r.type]}`} />
          </li>
        ))}
        {milestones.map((m) => (
          <li key={`m${m.id}`} className="flex flex-wrap items-center gap-x-4 gap-y-2 rounded-xl border bg-card px-3 py-2.5">
            <Link href={`/team/milestones?m=${m.id}`} className="group min-w-0 flex-1">
              <span className="flex items-center gap-1.5 font-semibold group-hover:underline">
                <FlagIcon className="size-3.5 shrink-0 text-brand" />
                <span className="truncate">{m.title}</span>
              </span>
              <span className="block truncate text-xs text-muted-foreground">
                마일스톤 제안 · {m.team} · {period(m.startDate, m.dueDate)} · {m.createdBy != null ? proposerName.get(m.createdBy) ?? "알 수 없음" : "알 수 없음"}
              </span>
            </Link>
            <ApprovalActions decide={decideMilestone.bind(null, m.id)} title={m.title} />
          </li>
        ))}
      </ul>
    </section>
  );
}

/** Requester: own leave requests and milestone proposals that are not approved yet. */
export function MyRequests({ leaves, milestones }: { leaves: LeaveRequest[]; milestones: MilestoneRow[] }) {
  if (leaves.length + milestones.length === 0) return null;
  return (
    <Card size="sm">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <SendIcon className="size-4 text-brand" />내 승인 요청
        </CardTitle>
      </CardHeader>
      <CardContent>
        <ul className="grid gap-2.5 text-sm">
          {leaves.map((r) => (
            <li key={`l${r.id}`}>
              <Link href={`/schedule/requests/${r.id}`} className="flex items-start gap-2 hover:underline">
                <span className={cn("mt-0.5 shrink-0 rounded-full px-1.5 py-0.5 text-[10px] font-semibold", REQUEST_STATUS_CLASS[r.status])}>{REQUEST_STATUS_LABEL[r.status]}</span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-medium">
                    {LEAVE_LABEL[r.type]} · {period(r.startDate, r.endDate)}
                  </span>
                  {r.status === "rejected" && r.decisionNote && <span className="line-clamp-2 text-xs text-red-800">{r.decisionNote}</span>}
                </span>
              </Link>
            </li>
          ))}
          {milestones.map((m) => (
            <li key={`m${m.id}`}>
              <Link href={`/team/milestones?m=${m.id}`} className="flex items-start gap-2 hover:underline">
                <span className={cn("mt-0.5 shrink-0 rounded-full px-1.5 py-0.5 text-[10px] font-semibold", APPROVAL_BADGE[m.approval])}>{APPROVAL_LABEL[m.approval]}</span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-medium">마일스톤 · {m.title}</span>
                  {m.approval === "rejected" && m.approvalNote && <span className="line-clamp-2 text-xs text-red-800">{m.approvalNote}</span>}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}
