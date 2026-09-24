import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeftIcon } from "lucide-react";
import { requireUser } from "@/lib/auth/dal";
import { budgetsAwaitingSettle } from "@/lib/dinner/queries";
import { allMembers } from "@/lib/members/queries";
import { requestAccess } from "@/lib/requests/queries";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { AwaitingSettle } from "../awaiting";

export const metadata: Metadata = { title: "회식비 청구품의" };

/** Entry for 회식비 청구품의: pick an approved 전산품의 (straight to the form when there's only one). */
export default async function DinnerClaimPage() {
  const user = await requireUser();
  const access = requestAccess(user);
  const rows = budgetsAwaitingSettle(allMembers().filter((m) => access.canCreateFor(m.id)).map((m) => m.id));
  if (rows.length === 1) redirect(`/forms/dinner/${rows[0].id}/settle`);
  return (
    <div className="grid gap-4">
      <Link href="/forms/dinner" className="flex w-fit items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeftIcon className="size-4" />
        회식비 품의 목록
      </Link>
      <div>
        <h2 className="text-lg font-bold">회식비 청구품의 <span className="text-sm font-normal text-muted-foreground">· 2단계 정산</span></h2>
        <p className="text-sm text-muted-foreground">승인된 회식비 전산품의를 골라 정산을 올립니다.</p>
      </div>
      {rows.length ? (
        <AwaitingSettle rows={rows} />
      ) : (
        <Card>
          <CardContent className="grid place-items-center gap-3 py-12 text-center">
            <p className="font-medium">청구할 수 있는 전산품의가 없습니다</p>
            <p className="text-sm text-muted-foreground">회식 전에 전산품의를 올리고 팀장 승인을 받으면 여기서 청구할 수 있습니다.</p>
            <Button asChild>
              <Link href="/forms/dinner/new">전산품의 작성</Link>
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
