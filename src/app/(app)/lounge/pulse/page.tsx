import type { Metadata } from "next";
import { LockIcon } from "lucide-react";
import { requireUser } from "@/lib/auth/dal";
import { todayKey, weekStartOf } from "@/lib/dates";
import { lastWeeks, myPulse, pulseComments, pulseTrend, teamSize } from "@/lib/pulse/queries";
import { teamScope } from "@/lib/teams/scope";
import { PulseForm } from "@/components/pulse/pulse-form";
import { PulseTrend } from "@/components/pulse/pulse-trend";
import { TeamSwitcher } from "@/components/team-picker";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export const metadata: Metadata = { title: "펄스 체크" };

type SP = Record<string, string | string[] | undefined>;

const TREND_WEEKS = 8;

export default async function PulsePage({ searchParams }: { searchParams: Promise<SP> }) {
  const user = await requireUser();
  const sp = await searchParams;
  const scope = teamScope(user, sp.team);
  const { teamId, me } = scope;
  const week = weekStartOf(todayKey());
  const team = teamId != null ? scope.teams.find((t) => t.id === teamId) : undefined;
  const mine = me ? myPulse(me.id, week) : null;

  const weeks = lastWeeks(week, TREND_WEEKS);
  const canRead = teamId != null && scope.canRead(teamId);
  const trend = canRead ? pulseTrend(teamId, weeks) : [];
  const size = canRead ? teamSize(teamId) : 0;
  const comments = canRead && scope.canLead(teamId) ? pulseComments(teamId, weeks).reverse() : null;

  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap items-center gap-3">
        <h2 className="text-lg font-bold">펄스 체크</h2>
        {team && <span className="text-sm text-muted-foreground">{team.name}</span>}
        {scope.isAdmin && teamId != null && <TeamSwitcher teams={scope.teams} value={teamId} />}
      </div>

      {me && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base font-semibold">이번 주 체크</CardTitle>
            <CardDescription>{mine ? "제출 완료 · 이번 주 안에는 바꿀 수 있습니다." : "업무량과 기분을 골라 주세요."}</CardDescription>
          </CardHeader>
          <CardContent>
            <PulseForm initial={mine} />
          </CardContent>
        </Card>
      )}

      {canRead ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base font-semibold">팀 결과 · 최근 {TREND_WEEKS}주</CardTitle>
          </CardHeader>
          <CardContent>
            <PulseTrend rows={trend} teamSize={size} currentWeek={week} />
          </CardContent>
        </Card>
      ) : (
        !me && (
          <Card>
            <CardHeader>
              <CardTitle>팀에 속한 구성원만 펄스 체크를 쓸 수 있습니다</CardTitle>
            </CardHeader>
          </Card>
        )
      )}

      {comments && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-1.5 text-base font-semibold">
              <LockIcon className="size-4 text-muted-foreground" />
              코멘트
            </CardTitle>
            <CardDescription>팀장·관리자만 봅니다. 응답이 충분한 주만, 작성자 없이 가나다순으로 보입니다.</CardDescription>
          </CardHeader>
          <CardContent>
            {comments.length === 0 ? (
              <p className="text-sm text-muted-foreground">표시할 코멘트가 없습니다.</p>
            ) : (
              <div className="grid gap-4">
                {comments.map((w) => (
                  <div key={w.weekStart} className="grid gap-1.5">
                    <h3 className="text-xs font-semibold text-muted-foreground">{w.weekStart} 주</h3>
                    <ul className="grid gap-1">
                      {w.comments.map((c, i) => (
                        <li key={i} className="rounded-md bg-muted/50 px-3 py-2 text-sm break-words whitespace-pre-wrap">
                          {c}
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
