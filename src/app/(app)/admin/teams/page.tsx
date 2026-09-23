import type { Metadata } from "next";
import { eq } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import { allMembers, allTeams } from "@/lib/members/queries";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { CreateTeamForm, TeamLeaderSelect, TeamRowButtons } from "./team-controls";

export const metadata: Metadata = { title: "팀 관리" };

export default function TeamsPage() {
  const teams = allTeams();
  const members = allMembers();
  const milestoneCounts = new Map<number, number>();
  for (const t of teams) {
    milestoneCounts.set(t.id, db.select({ id: schema.milestones.id }).from(schema.milestones).where(eq(schema.milestones.teamId, t.id)).all().length);
  }

  return (
    <div className="grid gap-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold">팀</h2>
          <p className="text-sm text-muted-foreground">팀을 만들고 팀장을 지정합니다. 팀장은 팀원의 한 일에 리뷰를 남기고 팀 마일스톤을 관리할 수 있습니다.</p>
        </div>
        <CreateTeamForm />
      </div>
      <div className="rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>팀</TableHead>
              <TableHead className="text-right">구성원</TableHead>
              <TableHead className="text-right">마일스톤</TableHead>
              <TableHead>팀장</TableHead>
              <TableHead className="w-40" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {teams.length === 0 && (
              <TableRow>
                <TableCell colSpan={5} className="h-20 text-center text-muted-foreground">
                  팀이 없습니다. 먼저 팀을 만드세요.
                </TableCell>
              </TableRow>
            )}
            {teams.map((t) => {
              const teamMembers = members.filter((m) => m.teamId === t.id);
              return (
                <TableRow key={t.id}>
                  <TableCell className="font-medium">{t.name}</TableCell>
                  <TableCell className="text-right tabular-nums">{teamMembers.length}</TableCell>
                  <TableCell className="text-right tabular-nums">{milestoneCounts.get(t.id) ?? 0}</TableCell>
                  <TableCell>
                    <TeamLeaderSelect teamId={t.id} leaderMemberId={t.leaderMemberId} members={teamMembers.map((m) => ({ id: m.id, name: m.name }))} />
                  </TableCell>
                  <TableCell>
                    <TeamRowButtons teamId={t.id} name={t.name} canDelete={teamMembers.length === 0 && (milestoneCounts.get(t.id) ?? 0) === 0} />
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
