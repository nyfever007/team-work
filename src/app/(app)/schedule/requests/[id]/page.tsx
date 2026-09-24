import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CheckCircle2Icon, CircleAlertIcon, HourglassIcon, PrinterIcon } from "lucide-react";
import { requireUser } from "@/lib/auth/dal";
import { formatKoDate, formatTime } from "@/lib/dates";
import { LEAVE_BADGE_CLASS, LEAVE_LABEL, REQUEST_STATUS_CLASS, REQUEST_STATUS_LABEL } from "@/lib/leaves/types";
import { decideLeaveRequest } from "@/lib/requests/actions";
import { ApprovalActions } from "@/components/approval-actions";
import { memberById } from "@/lib/members/queries";
import { formatDays } from "@/lib/requests/calc";
import { requestAccess, requestById } from "@/lib/requests/queries";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { CancelRequestButton } from "@/components/cancel-request-button";
import { cancelLeaveRequest } from "@/lib/requests/actions";

export const metadata: Metadata = { title: "휴가 품의서" };

export default async function RequestDetailPage({ params }: PageProps<"/schedule/requests/[id]">) {
  const user = await requireUser();
  const { id } = await params;
  const req = requestById(Number(id));
  if (!req) notFound();
  const access = requestAccess(user);
  const member = memberById(req.memberId);
  if (!member || !access.canView(member)) notFound();

  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2 text-lg font-semibold">
            휴가 품의서 <span className="font-mono text-sm text-muted-foreground">{req.docNo}</span>
            <Badge className={REQUEST_STATUS_CLASS[req.status]}>{REQUEST_STATUS_LABEL[req.status]}</Badge>
          </h2>
          <p className="text-sm text-muted-foreground">작성일 {formatKoDate(req.writtenAt)} · {req.teamName} · {req.position} · {req.memberName}</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" asChild><Link href="/schedule/requests">목록</Link></Button>
          <Button asChild>
            <a href={`/print/leave-request/${req.id}`} target="_blank" rel="noopener">
              <PrinterIcon className="size-4" />
              인쇄
            </a>
          </Button>
        </div>
      </div>

      {req.status === "submitted" && (
        <div className="flex flex-wrap items-center gap-3 rounded-xl border border-brand/25 bg-brand-soft/70 px-4 py-3 text-sm">
          <HourglassIcon className="size-4 shrink-0 text-brand" />
          <span className="min-w-0 flex-1">
            <b className="font-semibold text-accent-foreground">팀장 승인 대기 중</b>
            <span className="block text-xs text-muted-foreground">{access.canApprove(req) ? "승인하면 달력에 반영되고 연차가 차감됩니다." : "승인되면 달력에 반영되고 연차가 차감됩니다."}</span>
          </span>
          {access.canApprove(req) && <ApprovalActions decide={decideLeaveRequest.bind(null, req.id)} title={`${req.memberName} ${LEAVE_LABEL[req.type]}`} />}
        </div>
      )}
      {req.status === "rejected" && (
        <div className="flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-900">
          <CircleAlertIcon className="mt-0.5 size-4 shrink-0" />
          <span>
            <b className="font-semibold">{req.decidedByName ?? "팀장"}님이 반려했습니다</b> <span className="text-xs text-red-800/80">{formatTime(req.decidedAt)}</span>
            {req.decisionNote && <span className="block whitespace-pre-wrap">{req.decisionNote}</span>}
            <span className="mt-1 block text-xs text-red-800/80">내용을 고쳐 새 품의서로 다시 신청해 주세요.</span>
          </span>
        </div>
      )}
      {req.status === "approved" && req.decidedByName && (
        <div className="flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-2.5 text-sm text-emerald-900">
          <CheckCircle2Icon className="size-4 shrink-0" />
          {req.decidedByName}님이 승인했습니다 <span className="text-xs text-emerald-800/80">{formatTime(req.decidedAt)}</span>
        </div>
      )}

      <Card>
        <CardHeader><CardTitle className="text-base">신청 내용</CardTitle></CardHeader>
        <CardContent className="grid gap-3 text-sm sm:grid-cols-2">
          <Field k="구분"><span className={cn("rounded px-1.5 py-0.5 text-xs font-medium", LEAVE_BADGE_CLASS[req.type])}>{LEAVE_LABEL[req.type]}</span></Field>
          <Field k="신청일자">{formatKoDate(req.startDate)}{req.endDate !== req.startDate && ` ~ ${formatKoDate(req.endDate)}`}</Field>
          <Field k="신청일수">{formatDays(req.days)}일</Field>
          <Field k="잔여일수">{formatDays(req.remainingDays)}일 <span className="text-muted-foreground">(사용 {formatDays(req.usedDays)}일 / 총 {formatDays(req.totalDays)}일)</span></Field>
          <Field k="업무대행">{req.delegate || "—"}</Field>
          <Field k="연락처">{req.contact || "—"}</Field>
          <div className="sm:col-span-2"><Field k="사유"><span className="whitespace-pre-wrap">{req.reason || "—"}</span></Field></div>
        </CardContent>
      </Card>

      {(req.status === "submitted" || req.status === "approved") && access.canCancel(req) && (
        <div className="flex items-center justify-between gap-3 rounded-lg border px-4 py-3 text-sm">
          <span className="text-muted-foreground">{req.status === "submitted" ? "승인 전에 신청을 철회할 수 있습니다. 문서는 취소 상태로 남습니다." : "품의서를 취소하면 달력에 반영된 휴가도 함께 삭제됩니다. 문서는 취소 상태로 남습니다."}</span>
          <CancelRequestButton cancel={cancelLeaveRequest.bind(null, req.id)} docNo={req.docNo} approved={req.status === "approved"} />
        </div>
      )}
    </div>
  );
}

function Field({ k, children }: { k: string; children: React.ReactNode }) {
  return (
    <div className="grid gap-0.5">
      <div className="text-xs text-muted-foreground">{k}</div>
      <div>{children}</div>
    </div>
  );
}
