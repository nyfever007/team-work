import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeftIcon } from "lucide-react";
import { requireUser } from "@/lib/auth/dal";
import { todayKey } from "@/lib/dates";
import { allMembers } from "@/lib/members/queries";
import { requestAccess } from "@/lib/requests/queries";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { BudgetForm } from "./budget-form";

export const metadata: Metadata = { title: "회식비 전산품의 작성" };

export default async function NewDinnerBudgetPage() {
  const user = await requireUser();
  const access = requestAccess(user);
  const everyone = allMembers(); // team → leader first → name
  const members = everyone.filter((m) => access.canCreateFor(m.id) && m.isLeader); // 회식비 품의는 팀장 명의로만
  if (members.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>구성원과 연결되지 않은 계정입니다</CardTitle>
          <CardDescription>구성원과 연결된 계정만 품의서를 작성할 수 있습니다.</CardDescription>
        </CardHeader>
      </Card>
    );
  }
  return (
    <div className="grid gap-4">
      <Link href="/forms/dinner" className="flex w-fit items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeftIcon className="size-4" />
        회식비 품의 목록
      </Link>
      <div>
        <h2 className="text-lg font-bold">회식비 전산품의 작성 <span className="text-sm font-normal text-muted-foreground">· 1단계</span></h2>
        <p className="text-sm text-muted-foreground">회식 전에 올립니다. 승인되면 회식 후 청구품의(2단계)로 정산합니다.</p>
      </div>
      <Card>
        <CardContent className="pt-6">
          <BudgetForm members={members.map((m) => ({ id: m.id, name: m.name, team: m.team, position: m.rank || m.position, teamMates: everyone.filter((x) => x.teamId === m.teamId).map((x) => x.name) }))} defaultMemberId={access.me?.id ?? members[0].id} today={todayKey()} />
        </CardContent>
      </Card>
    </div>
  );
}
