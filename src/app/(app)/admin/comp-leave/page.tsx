import type { Metadata } from "next";
import { todayKey } from "@/lib/dates";
import { compGrantsFor } from "@/lib/leaves/comp";
import { allMembers } from "@/lib/members/queries";
import { formatDays } from "@/lib/requests/calc";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { cn } from "@/lib/utils";
import { GrantCompLeaveForm, GrantRowButtons } from "./grant-controls";

export const metadata: Metadata = { title: "보상휴가" };

// Admin only: guarded by admin/layout.tsx; the actions call requireAdmin() themselves.
export default function CompLeavePage() {
  const today = todayKey();
  const members = allMembers();
  const byId = new Map(members.map((m) => [m.id, m]));
  const grants = compGrantsFor(members.map((m) => m.id));

  return (
    <div className="grid gap-6">
      <div>
        <h2 className="text-lg font-semibold">보상휴가</h2>
        <p className="text-sm text-muted-foreground">일반 휴가(연차)와 별도로 회사가 지급하는 휴가입니다. 구성원은 휴가 품의서에서 ‘보상휴가’를 고른 뒤 지급받은 항목을 선택해 사용하며, 연차 연도와 관계없이 남은 일수만큼 쓸 수 있습니다.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">보상휴가 지급</CardTitle>
          <CardDescription>같은 제목·설명·일수로 선택한 구성원 모두에게 지급합니다.</CardDescription>
        </CardHeader>
        <CardContent>
          <GrantCompLeaveForm members={members.map((m) => ({ id: m.id, name: m.name, team: m.team, teamId: m.teamId }))} today={today} />
        </CardContent>
      </Card>

      <div className="rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>구성원</TableHead>
              <TableHead>보상휴가</TableHead>
              <TableHead>지급일</TableHead>
              <TableHead className="text-right">지급</TableHead>
              <TableHead className="text-right">사용</TableHead>
              <TableHead className="text-right">승인 대기</TableHead>
              <TableHead className="text-right">잔여</TableHead>
              <TableHead className="w-24" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {grants.length === 0 && (
              <TableRow>
                <TableCell colSpan={8} className="h-20 text-center text-muted-foreground">
                  지급한 보상휴가가 없습니다.
                </TableCell>
              </TableRow>
            )}
            {grants.map((g) => {
              const m = byId.get(g.memberId);
              return (
                <TableRow key={g.id}>
                  <TableCell>
                    <span className="font-medium">{m?.name ?? "—"}</span> <span className="text-xs text-muted-foreground">{m?.team}</span>
                  </TableCell>
                  <TableCell className="max-w-80">
                    <div className="font-medium">{g.title}</div>
                    {g.description && <div className="line-clamp-2 whitespace-pre-wrap text-xs text-muted-foreground">{g.description}</div>}
                  </TableCell>
                  <TableCell className="tabular-nums text-muted-foreground">{g.grantedOn}</TableCell>
                  <TableCell className="text-right tabular-nums">{formatDays(g.days)}</TableCell>
                  <TableCell className="text-right tabular-nums text-muted-foreground">{formatDays(g.used)}</TableCell>
                  <TableCell className="text-right tabular-nums text-muted-foreground">{g.pending > 0 ? formatDays(g.pending) : "—"}</TableCell>
                  <TableCell className={cn("text-right font-medium tabular-nums", g.remaining <= 0 && "text-muted-foreground")}>{formatDays(g.remaining)}</TableCell>
                  <TableCell>
                    <GrantRowButtons id={g.id} memberName={m?.name ?? ""} values={{ title: g.title, description: g.description, days: g.days, grantedOn: g.grantedOn }} held={g.used + g.pending} today={today} />
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
