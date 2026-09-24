import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeftIcon, ArrowRightIcon, CheckCircle2Icon, CircleAlertIcon, HourglassIcon, PrinterIcon, ReceiptIcon } from "lucide-react";
import { requireUser } from "@/lib/auth/dal";
import { formatKoDate, formatTime } from "@/lib/dates";
import { cancelDinnerRequest, decideDinnerRequest } from "@/lib/dinner/actions";
import { dinnerById, liveSettleOf } from "@/lib/dinner/queries";
import { DINNER_STAGE_LABEL, DINNER_TITLE, dinnerDateLine, dinnerPurpose } from "@/lib/dinner/types";
import { RETENTION_LABEL, isRetention } from "@/lib/general/types";
import { REQUEST_STATUS_CLASS, REQUEST_STATUS_LABEL } from "@/lib/leaves/types";
import { memberById } from "@/lib/members/queries";
import { requestAccess } from "@/lib/requests/queries";
import { ApprovalActions } from "@/components/approval-actions";
import { CancelRequestButton } from "@/components/cancel-request-button";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export const metadata: Metadata = { title: "회식비 품의" };

export default async function DinnerDetailPage({ params }: PageProps<"/forms/dinner/[id]">) {
  const user = await requireUser();
  const { id } = await params;
  const req = dinnerById(Number(id));
  if (!req) notFound();
  const access = requestAccess(user);
  const member = memberById(req.memberId);
  if (!member || !access.canView(member)) notFound();
  const parent = req.parentId != null ? dinnerById(req.parentId) : undefined;
  const settle = req.stage === "budget" ? liveSettleOf(req.id) : undefined;
  const canSettle = req.stage === "budget" && req.status === "approved" && !settle && access.canCreateFor(req.memberId);
  const won = (n: number) => n.toLocaleString("ko-KR");

  return (
    <div className="grid gap-4">
      <Link href="/forms/dinner" className="flex w-fit items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeftIcon className="size-4" />
        회식비 품의 목록
      </Link>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs font-semibold text-accent-foreground">{req.stage === "budget" ? "① " : "② "}{DINNER_STAGE_LABEL[req.stage]}</p>
          <h2 className="flex flex-wrap items-center gap-2 text-lg font-bold">
            {DINNER_TITLE[req.stage]}
            <Badge className={REQUEST_STATUS_CLASS[req.status]}>{REQUEST_STATUS_LABEL[req.status]}</Badge>
          </h2>
          <p className="text-sm text-muted-foreground">
            <span className="font-mono">{req.docNo}</span> · 작성일 {formatKoDate(req.writtenAt)} · {req.teamName} · {req.position} · {req.memberName}
          </p>
        </div>
        <Button asChild>
          <a href={`/print/dinner/${req.id}`} target="_blank" rel="noopener">
            <PrinterIcon />
            인쇄
          </a>
        </Button>
      </div>

      {req.status === "submitted" && (
        <div className="flex flex-wrap items-center gap-3 rounded-xl border border-brand/25 bg-brand-soft/70 px-4 py-3 text-sm">
          <HourglassIcon className="size-4 shrink-0 text-brand" />
          <b className="min-w-0 flex-1 font-semibold text-accent-foreground">팀장 승인 대기 중</b>
          {access.canApprove(req) && <ApprovalActions decide={decideDinnerRequest.bind(null, req.id)} title={`${req.memberName} ${DINNER_STAGE_LABEL[req.stage]}`} />}
        </div>
      )}
      {req.status === "rejected" && (
        <div className="flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-900">
          <CircleAlertIcon className="mt-0.5 size-4 shrink-0" />
          <span>
            <b className="font-semibold">{req.decidedByName ?? "팀장"}님이 반려했습니다</b> <span className="text-xs text-red-800/80">{formatTime(req.decidedAt)}</span>
            {req.decisionNote && <span className="block whitespace-pre-wrap">{req.decisionNote}</span>}
          </span>
        </div>
      )}
      {req.status === "approved" && req.decidedByName && (
        <div className="flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-2.5 text-sm text-emerald-900">
          <CheckCircle2Icon className="size-4 shrink-0" />
          {req.decidedByName}님이 승인했습니다 <span className="text-xs text-emerald-800/80">{formatTime(req.decidedAt)}</span>
        </div>
      )}

      {canSettle && (
        <div className="flex flex-wrap items-center gap-3 rounded-xl border border-brand/25 bg-gradient-to-r from-brand-soft to-card px-4 py-3 text-sm">
          <ReceiptIcon className="size-4 shrink-0 text-brand" />
          <span className="min-w-0 flex-1">
            <b className="font-semibold">회식을 마쳤다면 청구품의를 올려 정산하세요</b>
            <span className="block text-xs text-muted-foreground">이 품의 내용을 그대로 가져오고, 시기와 지급계좌만 입력합니다.</span>
          </span>
          <Button size="sm" asChild>
            <Link href={`/forms/dinner/${req.id}/settle`}>청구품의 작성</Link>
          </Button>
        </div>
      )}
      {settle && (
        <Link href={`/forms/dinner/${settle.id}`} className="flex items-center gap-2 rounded-xl border px-4 py-2.5 text-sm hover:bg-muted/50">
          <ReceiptIcon className="size-4 text-brand" />
          연결된 청구품의 <span className="font-mono">{settle.docNo}</span> · {REQUEST_STATUS_LABEL[settle.status]}
          <ArrowRightIcon className="ml-auto size-4 text-muted-foreground" />
        </Link>
      )}
      {parent && (
        <Link href={`/forms/dinner/${parent.id}`} className="flex items-center gap-2 rounded-xl border px-4 py-2.5 text-sm hover:bg-muted/50">
          <ArrowLeftIcon className="size-4 text-muted-foreground" />
          원 전산품의 <span className="font-mono">{parent.docNo}</span> · {formatKoDate(parent.writtenAt)} · {REQUEST_STATUS_LABEL[parent.status]}
        </Link>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">품의 내용</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 text-sm sm:grid-cols-2">
          <div className="sm:col-span-2">
            <Field k="목적">{dinnerPurpose(req.teamName)}</Field>
          </div>
          {req.stage === "settle" && <Field k="시기">{req.dinnerDate ? dinnerDateLine(req.dinnerDate) : "—"}</Field>}
          <Field k="인원">{req.headcount}</Field>
          <Field k="1인당 한도">{won(req.limitPerPerson)}원</Field>
          <Field k="금액"><b>{won(req.amount)} 원</b></Field>
          <Field k="법인카드 or 현금 수령인">{req.payMethod}</Field>
          {req.stage === "settle" && <Field k="지급계좌">{req.account || "—"}</Field>}
          <Field k="보존기간">{isRetention(req.retention) ? RETENTION_LABEL[req.retention] : "—"}</Field>
        </CardContent>
      </Card>

      {(req.status === "submitted" || req.status === "approved") && access.canCancel(req) && (
        <div className="flex items-center justify-between gap-3 rounded-lg border px-4 py-3 text-sm">
          <span className="text-muted-foreground">{req.stage === "budget" && settle ? "청구품의가 연결되어 있어 먼저 청구품의를 취소해야 합니다." : req.status === "submitted" ? "승인 전에 품의를 철회할 수 있습니다." : "승인된 품의를 취소합니다. 문서는 취소 상태로 남습니다."}</span>
          <CancelRequestButton cancel={cancelDinnerRequest.bind(null, req.id)} docNo={req.docNo} approved={req.status === "approved"} approvedText="승인된 품의를 취소합니다. 취소된 문서는 목록에 남습니다." />
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
