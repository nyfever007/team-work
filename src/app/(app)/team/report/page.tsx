import type { Metadata } from "next";
import Link from "next/link";
import { ChevronLeftIcon, ChevronRightIcon } from "lucide-react";
import { requireUser } from "@/lib/auth/dal";
import { addDays, formatKoDate, isValidKey, todayKey, weekStartOf } from "@/lib/dates";
import { allTeams } from "@/lib/members/queries";
import { collectWeekSource, renderSource } from "@/lib/reports/data";
import { openAIConfigured, openAIModel } from "@/lib/reports/openai";
import { reportAccess, teamReportFor } from "@/lib/reports/queries";
import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ReportEditor } from "./report-editor";
import { TeamPicker } from "./team-picker";

export const metadata: Metadata = { title: "주간 보고서" };

export default async function ReportPage({ searchParams }: PageProps<"/team/report">) {
  const user = await requireUser();
  const sp = await searchParams;
  const access = reportAccess(user);
  const teams = allTeams().filter((t) => access.canRead(t.id));
  const today = todayKey();
  const thisWeek = weekStartOf(today);
  const weekStart = isValidKey(sp.week) ? weekStartOf(sp.week) : thisWeek;
  // Requested team if readable; otherwise own team, then the first readable one.
  const requested = Number(sp.team);
  const teamId = teams.some((t) => t.id === requested) ? requested : (access.myTeamId ?? teams[0]?.id ?? null);
  const team = teams.find((t) => t.id === teamId);

  if (!team) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>볼 수 있는 팀 보고서가 없습니다</CardTitle>
          <CardDescription>구성원과 연결된 계정만 소속 팀의 보고서를 볼 수 있습니다.</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  const canEdit = access.canEdit(team.id);
  const report = teamReportFor(team.id, weekStart);
  const href = (p: { week?: string; team?: number }) => `/team/report?team=${p.team ?? team.id}&week=${p.week ?? weekStart}`;

  if (!canEdit && report?.status !== "final") {
    return (
      <div className="grid gap-4">
        <Header team={team} teams={teams} weekStart={weekStart} thisWeek={thisWeek} href={href} isAdmin={access.isAdmin} />
        <Card>
          <CardHeader>
            <CardTitle>아직 확정된 보고서가 없습니다</CardTitle>
            <CardDescription>팀장이 이 주의 보고서를 확정하면 여기에 표시됩니다.</CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  const source = collectWeekSource(team.id, weekStart);
  const sourceText = source ? renderSource(source) : "";
  const recordCount = source ? source.members.reduce((n, m) => n + m.weeklyItems.length + m.doneTasks.length + m.extras.length + (m.result ? 1 : 0), 0) : 0;

  return (
    <div className="grid gap-4">
      <Header team={team} teams={teams} weekStart={weekStart} thisWeek={thisWeek} href={href} isAdmin={access.isAdmin} />
      <ReportEditor
        teamId={team.id}
        teamName={team.name}
        weekStart={weekStart}
        period={`${formatKoDate(weekStart)} ~ ${formatKoDate(addDays(weekStart, 6))}`}
        initialContent={report?.content ?? ""}
        initialStatus={report?.status ?? "draft"}
        meta={report ? { model: report.model, generatedAt: report.generatedAt?.getTime() ?? null, updatedAt: report.updatedAt.getTime(), updatedByName: report.updatedByName } : null}
        canEdit={canEdit}
        aiReady={openAIConfigured()}
        model={openAIModel()}
        sourceText={sourceText}
        recordCount={recordCount}
      />
    </div>
  );
}

function Header({ team, teams, weekStart, thisWeek, href, isAdmin }: { team: { id: number; name: string }; teams: { id: number; name: string }[]; weekStart: string; thisWeek: string; href: (p: { week?: string; team?: number }) => string; isAdmin: boolean }) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-3">
      <div>
        <h2 className="text-lg font-semibold">주간 팀 보고서</h2>
        <p className="text-sm text-muted-foreground">
          {team.name} · {formatKoDate(weekStart)} ~ {formatKoDate(addDays(weekStart, 6))}{weekStart === thisWeek && " · 이번 주"}
        </p>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        {(isAdmin || teams.length > 1) && <TeamPicker teams={teams} value={team.id} weekStart={weekStart} />}
        <div className="flex items-center gap-1">
          <Button variant="outline" size="icon" asChild aria-label="이전 주"><Link href={href({ week: addDays(weekStart, -7) })}><ChevronLeftIcon className="size-4" /></Link></Button>
          <Button variant="outline" size="sm" asChild><Link href={href({ week: thisWeek })}>이번 주</Link></Button>
          <Button variant="outline" size="icon" asChild aria-label="다음 주" disabled={weekStart >= thisWeek}><Link href={href({ week: addDays(weekStart, 7) })} aria-disabled={weekStart >= thisWeek}><ChevronRightIcon className="size-4" /></Link></Button>
        </div>
      </div>
    </div>
  );
}
