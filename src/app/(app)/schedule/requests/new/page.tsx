import type { Metadata } from "next";
import Link from "next/link";
import { requireUser } from "@/lib/auth/dal";
import { addDays, isValidKey, todayKey } from "@/lib/dates";
import { allMembers } from "@/lib/members/queries";
import { teamScopedMembers } from "@/lib/members/access";
import { pendingUsage, requestAccess } from "@/lib/requests/queries";
import { leaveBalance } from "@/lib/leaves/balance";
import { loadHolidays } from "@/lib/workdays";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { RequestForm } from "./request-form";

export const metadata: Metadata = { title: "휴가 품의서 작성" };

export default async function NewRequestPage({ searchParams }: PageProps<"/schedule/requests/new">) {
  const user = await requireUser();
  const sp = await searchParams;
  const access = requestAccess(user);
  const today = todayKey();
  const date = isValidKey(sp.date) ? sp.date : today;
  const members = allMembers().filter((m) => access.canCreateFor(m.id));
  if (members.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>구성원과 연결되지 않은 계정입니다</CardTitle>
          <CardDescription><Link href="/admin/members" className="underline underline-offset-4">구성원 관리</Link>에서 계정을 구성원과 연결하면 품의서를 작성할 수 있습니다.</CardDescription>
        </CardHeader>
      </Card>
    );
  }
  const holidays = [...loadHolidays(addDays(today, -400), addDays(today, 400)).keys()];
  const memberInfo = members.map((m) => {
    const b = leaveBalance(m, date);
    const held = pendingUsage(m.id, b.period.start, b.period.end);
    return { pendingAnnual: held.annual, pendingSick: held.sick, id: m.id, name: m.name, team: m.team, position: m.rank || m.position, totalDays: b.annual.accrued, annualTotal: b.annual.total, usedDays: b.annual.used, sickUsed: b.sick.used, sickAllowance: b.sick.allowance, period: `${b.period.start} ~ ${b.period.end}`, yearIndex: b.period.yearIndex };
  });
  const defaultMemberId = access.me?.id ?? members[0].id;
  const delegates = teamScopedMembers(user).map((m) => ({ id: m.id, name: m.name, team: m.team, phone: m.phone }));

  return (
    <div className="grid gap-4">
      <div>
        <h2 className="text-lg font-semibold">휴가 품의서 작성</h2>
        <p className="text-sm text-muted-foreground">소속·직위·성명·신청일수·잔여일수는 자동으로 채워집니다. 제출하면 팀장이 승인한 뒤 달력에 반영되고 연차가 차감됩니다.</p>
      </div>
      <Card>
        <CardContent className="pt-6">
          <RequestForm members={memberInfo} defaultMemberId={defaultMemberId} defaultDate={date} today={today} holidays={holidays} delegates={delegates} />
        </CardContent>
      </Card>
    </div>
  );
}
