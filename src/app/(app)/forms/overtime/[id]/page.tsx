import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeftIcon, CheckCircle2Icon, CircleAlertIcon, HourglassIcon, PrinterIcon } from "lucide-react";
import { requireUser } from "@/lib/auth/dal";
import { formatKoDate, formatTime } from "@/lib/dates";
import { REQUEST_STATUS_CLASS, REQUEST_STATUS_LABEL } from "@/lib/leaves/types";
import { memberById } from "@/lib/members/queries";
import { cancelOvertimeRequest, decideOvertimeRequest } from "@/lib/overtime/actions";
import { overtimeById } from "@/lib/overtime/queries";
import { formatHours, overtimeLine } from "@/lib/overtime/types";
import { requestAccess } from "@/lib/requests/queries";
import { ApprovalActions } from "@/components/approval-actions";
import { CancelRequestButton } from "@/components/cancel-request-button";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export const metadata: Metadata = { title: "시간외 근무신청서" };

export default async function OvertimeDetailPage({ params }: PageProps<"/forms/overtime/[id]">) {
  const user = await requireUser();
  const { id } = await params;
  const req = overtimeById(Number(id));
  if (!req) notFound();
  const access = requestAccess(user);
  const member = memberById(req.memberId);
  if (!member || !access.canView(member)) notFound();
  const canApprove = access.canApprove(req);

  return (
    <div className="grid gap-4">
      <Link href="/forms/overtime" className="flex w-fit items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeftIcon className="size-4" />
        시간외 근무신청서 목록
      </Link>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="flex flex-wrap items-center gap-2 text-lg font-bold">
            시간외(휴일) 근무신청서 <span className="font-mono text-sm font-normal text-muted-foreground">{req.docNo}</span>
            <Badge className={REQUEST_STATUS_CLASS[req.status]}>{REQUEST_STATUS_LABEL[req.status]}</Badge>
          </h2>
          <p className="text-sm text-muted-foreground">
            신청일 {formatKoDate(req.writtenAt)} · {req.teamName} · {req.position} · {req.memberName}
          </p>
        </div>
        <Button asChild>
          <a href={`/print/overtime/${req.id}`} target="_blank" rel="noopener">
            <PrinterIcon />
            인쇄
          </a>
        </Button>
      </div>

      {req.status === "submitted" && (
        <div className="flex flex-wrap items-center gap-3 rounded-xl border border-brand/25 bg-brand-soft/70 px-4 py-3 text-sm">
          <HourglassIcon className="size-4 shrink-0 text-brand" />
          <span className="min-w-0 flex-1">
            <b className="font-semibold text-accent-foreground">팀장 승인 대기 중</b>
            <span className="block text-xs text-muted-foreground">시간외(휴일) 근무는 사전 승인이 원칙입니다.</span>
          </span>
          {canApprove && <ApprovalActions decide={decideOvertimeRequest.bind(null, req.id)} title={`${req.memberName} 시간외 근무`} />}
        </div>
      )}
      {req.status === "rejected" && (
        <div className="flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-900">
          <CircleAlertIcon className="mt-0.5 size-4 shrink-0" />
          <span>
            <b className="font-semibold">{req.decidedByName ?? "팀장"}님이 반려했습니다</b> <span className="text-xs text-red-800/80">{formatTime(req.decidedAt)}</span>
            {req.decisionNote && <span className="block whitespace-pre-wrap">{req.decisionNote}</span>}
            <span className="mt-1 block text-xs text-red-800/80">내용을 고쳐 새 신청서로 다시 신청해 주세요.</span>
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
        <CardHeader>
          <CardTitle className="text-base">신청 내용</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 text-sm sm:grid-cols-2">
          <Field k="부서">{req.teamName}</Field>
          <Field k="직위">{req.position}</Field>
          <Field k="담당업무">{req.duty}</Field>
          <Field k="성명">{req.memberName}</Field>
          <div className="sm:col-span-2">
            <Field k="시간외 근무일자 및 예상 근무 시간">{overtimeLine(req.startAt, req.endAt, req.hours)}</Field>
          </div>
          <div className="sm:col-span-2">
            <Field k="시간외 근무 신청 사유">
              <span className="whitespace-pre-wrap">{req.reason}</span>
            </Field>
          </div>
          <Field k="예상 근무 시간">{formatHours(req.hours)}</Field>
        </CardContent>
      </Card>

      {(req.status === "submitted" || req.status === "approved") && access.canCancel(req) && (
        <div className="flex items-center justify-between gap-3 rounded-lg border px-4 py-3 text-sm">
          <span className="text-muted-foreground">{req.status === "submitted" ? "승인 전에 신청을 철회할 수 있습니다." : "승인된 신청을 취소합니다. 문서는 취소 상태로 남습니다."} </span>
          <CancelRequestButton cancel={cancelOvertimeRequest.bind(null, req.id)} docNo={req.docNo} approved={req.status === "approved"} approvedText="승인된 시간외 근무 신청을 취소합니다. 취소된 문서는 목록에 남습니다." />
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
