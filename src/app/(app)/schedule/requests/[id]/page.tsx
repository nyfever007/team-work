import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { PrinterIcon } from "lucide-react";
import { requireUser } from "@/lib/auth/dal";
import { formatKoDate } from "@/lib/dates";
import { LEAVE_BADGE_CLASS, LEAVE_LABEL, REQUEST_STATUS_LABEL } from "@/lib/leaves/types";
import { memberById } from "@/lib/members/queries";
import { formatDays } from "@/lib/requests/calc";
import { requestAccess, requestById } from "@/lib/requests/queries";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { CancelRequestButton } from "./cancel-button";

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
            <Badge variant={req.status === "cancelled" ? "outline" : "secondary"}>{REQUEST_STATUS_LABEL[req.status]}</Badge>
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

      {req.status !== "cancelled" && access.canCancel(req) && (
        <div className="flex items-center justify-between gap-3 rounded-lg border px-4 py-3 text-sm">
          <span className="text-muted-foreground">품의서를 취소하면 달력에 반영된 휴가도 함께 삭제됩니다. 문서는 취소 상태로 남습니다.</span>
          <CancelRequestButton id={req.id} docNo={req.docNo} />
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
