import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeftIcon, CheckCircle2Icon, CircleAlertIcon, HourglassIcon, PrinterIcon } from "lucide-react";
import { requireUser } from "@/lib/auth/dal";
import { formatKoDate, formatTime } from "@/lib/dates";
import { cancelTaxiRequest, decideTaxiRequest } from "@/lib/taxi/actions";
import { taxiById } from "@/lib/taxi/queries";
import { RETENTION_LABEL, isRetention } from "@/lib/general/types";
import { TAXI_TITLE, periodLine } from "@/lib/taxi/types";
import { REQUEST_STATUS_CLASS, REQUEST_STATUS_LABEL } from "@/lib/leaves/types";
import { memberById } from "@/lib/members/queries";
import { requestAccess } from "@/lib/requests/queries";
import { ApprovalActions } from "@/components/approval-actions";
import { CancelRequestButton } from "@/components/cancel-request-button";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export const metadata: Metadata = { title: "택시비 지급 품의서" };

export default async function TaxiDetailPage({ params }: PageProps<"/forms/taxi/[id]">) {
  const user = await requireUser();
  const { id } = await params;
  const req = taxiById(Number(id));
  if (!req) notFound();
  const access = requestAccess(user);
  const member = memberById(req.memberId);
  if (!member || !access.canView(member)) notFound();

  return (
    <div className="grid gap-4">
      <Link href="/forms/taxi" className="flex w-fit items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeftIcon className="size-4" />
        택시비 지급 품의서 목록
      </Link>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="flex flex-wrap items-center gap-2 text-lg font-bold">
            {TAXI_TITLE}
            <Badge className={REQUEST_STATUS_CLASS[req.status]}>{REQUEST_STATUS_LABEL[req.status]}</Badge>
          </h2>
          <p className="text-sm text-muted-foreground">
            <span className="font-mono">{req.docNo}</span> · 작성일 {formatKoDate(req.writtenAt)} · {req.teamName} · {req.position} · {req.memberName}
          </p>
        </div>
        <Button asChild>
          <a href={`/print/taxi/${req.id}`} target="_blank" rel="noopener">
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
          </span>
          {access.canApprove(req) && <ApprovalActions decide={decideTaxiRequest.bind(null, req.id)} title={`${req.memberName} 택시비 품의`} />}
        </div>
      )}
      {req.status === "rejected" && (
        <div className="flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-900">
          <CircleAlertIcon className="mt-0.5 size-4 shrink-0" />
          <span>
            <b className="font-semibold">{req.decidedByName ?? "팀장"}님이 반려했습니다</b> <span className="text-xs text-red-800/80">{formatTime(req.decidedAt)}</span>
            {req.decisionNote && <span className="block whitespace-pre-wrap">{req.decisionNote}</span>}
            <span className="mt-1 block text-xs text-red-800/80">내용을 고쳐 새 품의서로 다시 올려 주세요.</span>
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
          <CardTitle className="text-base">품의 내용</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 text-sm sm:grid-cols-2">
          <div className="sm:col-span-2">
            <Field k="지급 요청 사유"><span className="whitespace-pre-wrap">{req.reason}</span></Field>
          </div>
          <Field k="이용 기간">{periodLine(req.useStart, req.useEnd)}</Field>
          <Field k="총 이용 금액"><b>{req.amount.toLocaleString("ko-KR")} 원</b></Field>
          <Field k="부서명">{req.teamName}</Field>
          <Field k="작성 담당자">{req.position} {req.memberName}</Field>
          <Field k="지급계좌">{req.account || "—"}</Field>
          <Field k="보존기간">{isRetention(req.retention) ? RETENTION_LABEL[req.retention] : "—"}</Field>
          <div className="sm:col-span-2">
            <Field k="첨부">{req.attachment || "—"}</Field>
          </div>
        </CardContent>
      </Card>

      {(req.status === "submitted" || req.status === "approved") && access.canCancel(req) && (
        <div className="flex items-center justify-between gap-3 rounded-lg border px-4 py-3 text-sm">
          <span className="text-muted-foreground">{req.status === "submitted" ? "승인 전에 품의를 철회할 수 있습니다." : "승인된 품의를 취소합니다. 문서는 취소 상태로 남습니다."}</span>
          <CancelRequestButton cancel={cancelTaxiRequest.bind(null, req.id)} docNo={req.docNo} approved={req.status === "approved"} approvedText="승인된 품의를 취소합니다. 취소된 문서는 목록에 남습니다." />
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
