import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeftIcon } from "lucide-react";
import { requireUser } from "@/lib/auth/dal";
import { todayKey } from "@/lib/dates";
import { dinnerById, liveSettleOf } from "@/lib/dinner/queries";
import { memberById } from "@/lib/members/queries";
import { requestAccess } from "@/lib/requests/queries";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { SettleForm } from "./settle-form";

export const metadata: Metadata = { title: "회식비 청구품의 작성" };

export default async function SettlePage({ params }: PageProps<"/forms/dinner/[id]/settle">) {
  const user = await requireUser();
  const { id } = await params;
  const budget = dinnerById(Number(id));
  const access = requestAccess(user);
  if (!budget || budget.stage !== "budget" || !access.canCreateFor(budget.memberId)) notFound();
  const existing = liveSettleOf(budget.id);
  if (existing) redirect(`/forms/dinner/${existing.id}`);
  const member = memberById(budget.memberId);
  if (!member) notFound();

  return (
    <div className="grid gap-4">
      <Link href={`/forms/dinner/${budget.id}`} className="flex w-fit items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeftIcon className="size-4" />
        전산품의 {budget.docNo}
      </Link>
      <div>
        <h2 className="text-lg font-bold">회식비 청구품의 작성 <span className="text-sm font-normal text-muted-foreground">· 2단계 정산</span></h2>
        <p className="text-sm text-muted-foreground">승인된 전산품의 내용을 그대로 가져옵니다. 회식한 날(시기)과 지급계좌만 입력하세요.</p>
      </div>
      {budget.status !== "approved" ? (
        <Card>
          <CardHeader>
            <CardTitle>아직 승인되지 않은 전산품의입니다</CardTitle>
            <CardDescription>팀장이 전산품의를 승인하면 청구품의를 올릴 수 있습니다.</CardDescription>
          </CardHeader>
        </Card>
      ) : (
        <Card>
          <CardContent className="pt-6">
            <SettleForm
              budget={{ id: budget.id, docNo: budget.docNo, headcount: budget.headcount, limitPerPerson: budget.limitPerPerson, amount: budget.amount, payMethod: budget.payMethod, retention: budget.retention }}
              member={{ id: member.id, name: member.name, team: member.team, position: member.rank || member.position }}
              today={todayKey()}
            />
          </CardContent>
        </Card>
      )}
    </div>
  );
}
