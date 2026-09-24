import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeftIcon } from "lucide-react";
import { requireUser } from "@/lib/auth/dal";
import { todayKey } from "@/lib/dates";
import { allMembers } from "@/lib/members/queries";
import { requestAccess } from "@/lib/requests/queries";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { TaxiForm } from "./taxi-form";

export const metadata: Metadata = { title: "택시비 지급 품의서 작성" };

export default async function NewTaxiPage() {
  const user = await requireUser();
  const access = requestAccess(user);
  const members = allMembers().filter((m) => access.canCreateFor(m.id));
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
      <Link href="/forms/taxi" className="flex w-fit items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeftIcon className="size-4" />
        택시비 지급 품의서 목록
      </Link>
      <div>
        <h2 className="text-lg font-bold">택시비 지급 품의서 작성</h2>
        <p className="text-sm text-muted-foreground">제목, 부서명, 작성 담당자는 자동으로 채워집니다. 팀장이 승인하면 회사 양식 그대로 인쇄할 수 있습니다.</p>
      </div>
      <Card>
        <CardContent className="pt-6">
          <TaxiForm members={members.map((m) => ({ id: m.id, name: m.name, team: m.team, position: m.rank || m.position }))} defaultMemberId={access.me?.id ?? members[0].id} today={todayKey()} />
        </CardContent>
      </Card>
    </div>
  );
}
