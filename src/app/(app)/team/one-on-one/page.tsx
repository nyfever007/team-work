import type { Metadata } from "next";
import Link from "next/link";
import { AlertTriangleIcon } from "lucide-react";
import { requireUser } from "@/lib/auth/dal";
import { formatKoDate, parseKey, todayKey } from "@/lib/dates";
import { memberColorMap } from "@/lib/members/colors";
import { allMembers } from "@/lib/members/queries";
import { allOneOnOnesFor, oneOnOneSummary, openActionsFor } from "@/lib/one-on-one/queries";
import { openAIConfigured } from "@/lib/reports/openai";
import { reviewerContext } from "@/lib/reviews/queries";
import { teamScope } from "@/lib/teams/scope";
import { ActionList } from "@/components/one-on-one/action-list";
import { MeetingEditor } from "@/components/one-on-one/meeting-editor";
import { NewMeetingForm } from "@/components/one-on-one/new-meeting-form";
import { TeamSwitcher } from "@/components/team-picker";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "1:1" };

const STALE_DAYS = 30;
const daysBetween = (from: string, to: string) => Math.round((parseKey(to).getTime() - parseKey(from).getTime()) / 86_400_000);
const short = (key: string) => key.slice(5).replace("-", "/");

export default async function TeamOneOnOnePage({ searchParams }: PageProps<"/team/one-on-one">) {
  const user = await requireUser();
  const sp = await searchParams;
  const scope = teamScope(user, sp.team);

  if (scope.teamId == null || !scope.canLead(scope.teamId)) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>팀장과 관리자만 볼 수 있습니다</CardTitle>
          <CardDescription>1:1 기록은 내 업무 → 1:1에서 확인하세요.</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  const teamId = scope.teamId;
  const reviewer = reviewerContext(user);
  const members = allMembers().filter((m) => m.teamId === teamId && m.id !== scope.me?.id && reviewer.canReview(m));
  const summary = oneOnOneSummary(members.map((m) => m.id));
  const colors = memberColorMap(allMembers().map((m) => m.id));
  const today = todayKey();
  const aiReady = openAIConfigured();

  const requested = Number(sp.member);
  const selected = members.find((m) => m.id === requested);
  const href = (memberId?: number) => {
    const q = new URLSearchParams();
    if (scope.isAdmin) q.set("team", String(teamId));
    if (memberId) q.set("member", String(memberId));
    const s = q.toString();
    return `/team/one-on-one${s ? `?${s}` : ""}`;
  };

  const meetings = selected ? allOneOnOnesFor(selected.id) : [];
  const newestId = meetings[0]?.id;
  const carried = selected ? openActionsFor(selected.id).filter((a) => a.meetingId !== newestId) : [];
  const staleCount = members.filter((m) => {
    const last = summary.get(m.id)?.last;
    return !last || daysBetween(last, today) >= STALE_DAYS;
  }).length;

  return (
    <div className="grid gap-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold">1:1 미팅</h2>
          <p className="text-sm text-muted-foreground">
            구성원 {members.length}명{staleCount > 0 && ` · ${STALE_DAYS}일 이상 없음 ${staleCount}명`}
          </p>
        </div>
        {scope.isAdmin && <TeamSwitcher teams={scope.teams} value={teamId} />}
      </div>

      {members.length === 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>1:1 대상 구성원이 없습니다</CardTitle>
          </CardHeader>
        </Card>
      ) : (
        <div className="grid gap-6 lg:grid-cols-[280px_minmax(0,1fr)]">
          <nav aria-label="구성원" className="grid content-start gap-1">
            {members.map((m) => {
              const s = summary.get(m.id)!;
              const since = s.last ? daysBetween(s.last, today) : null;
              const stale = since == null || since >= STALE_DAYS;
              const active = m.id === selected?.id;
              return (
                <Link
                  key={m.id}
                  href={href(m.id)}
                  aria-current={active ? "page" : undefined}
                  className={cn("flex items-center gap-3 rounded-xl border px-3 py-2.5 transition-all", active ? "border-brand/40 bg-card shadow-sm ring-1 ring-brand/20" : "border-transparent hover:bg-card hover:shadow-xs")}
                >
                  <span className={cn("grid size-9 shrink-0 place-items-center rounded-full text-sm font-bold", colors.get(m.id)?.soft)}>{m.name.slice(-2)}</span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold">{m.name}</span>
                    <span className="block truncate text-xs text-muted-foreground tabular-nums">
                      {s.last ? `최근 ${short(s.last)} (${since}일 전)` : "기록 없음"}
                      {s.next && ` · 예정 ${short(s.next)}`}
                      {s.openActions > 0 && ` · 후속 ${s.openActions}`}
                    </span>
                  </span>
                  {stale && (
                    <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold text-amber-800">
                      <AlertTriangleIcon className="size-3" />
                      {STALE_DAYS}일+
                    </span>
                  )}
                </Link>
              );
            })}
          </nav>

          {!selected ? (
            <Card>
              <CardHeader>
                <CardTitle>구성원을 선택하세요</CardTitle>
                <CardDescription>{STALE_DAYS}일 이상 1:1이 없는 구성원은 표시됩니다.</CardDescription>
              </CardHeader>
            </Card>
          ) : (
            <div className="grid min-w-0 content-start gap-4">
              <Card>
                <CardHeader>
                  <CardTitle className="text-base font-bold">{selected.name}님과 새 1:1</CardTitle>
                </CardHeader>
                <CardContent>
                  <NewMeetingForm key={selected.id} memberId={selected.id} today={today} aiReady={aiReady} />
                </CardContent>
              </Card>

              {carried.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base font-bold">이월된 후속 조치</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ActionList actions={carried.map((a) => ({ id: a.id, title: a.title, owner: a.owner, done: false, meetingDate: a.meetingDate }))} toggle="all" />
                  </CardContent>
                </Card>
              )}

              {meetings.length === 0 ? (
                <p className="px-1 text-sm text-muted-foreground">아직 1:1 기록이 없습니다.</p>
              ) : (
                meetings.map((m, i) => (
                  <MeetingEditor
                    key={`${m.id}-${m.updatedAt.getTime()}`}
                    meeting={{ id: m.id, memberId: m.memberId, date: m.date, status: m.status, agenda: m.agenda, memberAgenda: m.memberAgenda, notes: m.notes, privateNotes: m.privateNotes, leaderName: m.leaderName }}
                    dateLabel={formatKoDate(m.date)}
                    actions={m.actions.map((a) => ({ id: a.id, title: a.title, owner: a.owner, done: a.doneAt != null }))}
                    aiReady={aiReady}
                    defaultOpen={i === 0 || m.status === "planned"}
                  />
                ))
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
