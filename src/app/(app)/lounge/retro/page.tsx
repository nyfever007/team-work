import type { Metadata } from "next";
import Link from "next/link";
import { EyeOffIcon, FlagIcon, MessageSquareIcon } from "lucide-react";
import { requireUser } from "@/lib/auth/dal";
import { formatTime } from "@/lib/dates";
import { openTryItems, retroMilestoneOptions, retrosForTeam } from "@/lib/retro/queries";
import { RETRO_STATUS_LABEL } from "@/lib/retro/types";
import { teamScope } from "@/lib/teams/scope";
import { CreateRetroDialog } from "@/components/retro/create-retro-dialog";
import { TryDoneButton } from "@/components/retro/try-done-button";
import { TeamSwitcher } from "@/components/team-picker";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "회고" };

type SP = Record<string, string | string[] | undefined>;

export default async function RetroListPage({ searchParams }: { searchParams: Promise<SP> }) {
  const user = await requireUser();
  const sp = await searchParams;
  const scope = teamScope(user, sp.team);
  const { teamId } = scope;

  if (teamId == null) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>팀에 속한 구성원만 회고를 볼 수 있습니다</CardTitle>
        </CardHeader>
      </Card>
    );
  }

  const team = scope.teams.find((t) => t.id === teamId);
  const canLead = scope.canLead(teamId);
  const myId = scope.me?.teamId === teamId ? scope.me.id : null;
  const retros = retrosForTeam(teamId);
  const tries = openTryItems(teamId);

  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <h2 className="text-lg font-bold">회고</h2>
          <span className="text-sm text-muted-foreground">{team?.name}</span>
          {scope.isAdmin && <TeamSwitcher teams={scope.teams} value={teamId} />}
        </div>
        {canLead && <CreateRetroDialog teamId={teamId} milestones={retroMilestoneOptions(teamId)} />}
      </div>

      {tries.length > 0 && (
        <Card size="sm">
          <CardHeader>
            <CardTitle className="text-sm font-semibold">
              진행 중인 Try <span className="text-xs font-normal text-muted-foreground tabular-nums">{tries.length}</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="grid gap-1.5">
              {tries.map((t) => {
                const canToggle = canLead || (myId != null && t.ownerMemberId === myId);
                return (
                  <li key={t.id} className="flex items-start gap-2 text-sm">
                    <TryDoneButton itemId={t.id} done={false} disabled={!canToggle} label={t.body.slice(0, 20)} />
                    <span className="min-w-0 flex-1 break-words">{t.body}</span>
                    <span className={cn("shrink-0 text-xs", t.ownerMemberId === myId && myId != null ? "font-semibold text-brand" : "text-muted-foreground")}>{t.ownerName ?? "담당 미정"}</span>
                    <Link href={`/lounge/retro/${t.retroId}`} className="hidden max-w-40 shrink-0 truncate text-xs text-muted-foreground hover:underline sm:block">
                      {t.retroTitle}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </CardContent>
        </Card>
      )}

      {retros.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center text-sm text-muted-foreground">아직 회고가 없습니다.</CardContent>
        </Card>
      ) : (
        <ul className="grid gap-2">
          {retros.map((r) => (
            <li key={r.id}>
              <Link href={`/lounge/retro/${r.id}`} className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-xl bg-card px-4 py-3 shadow-sm ring-1 ring-foreground/10 transition-colors hover:bg-brand-soft/40">
                <span className={cn("rounded-full px-2 py-0.5 text-[11px] font-semibold", r.status === "open" ? "bg-brand-soft text-brand" : "bg-muted text-muted-foreground")}>{RETRO_STATUS_LABEL[r.status]}</span>
                <span className="min-w-0 flex-1 truncate font-medium">{r.title}</span>
                {r.anonymous && <EyeOffIcon className="size-3.5 text-muted-foreground" aria-label="익명" />}
                {r.milestoneTitle && (
                  <span className="inline-flex max-w-48 items-center gap-1 truncate text-xs text-muted-foreground">
                    <FlagIcon className="size-3 shrink-0" />
                    {r.milestoneTitle}
                  </span>
                )}
                <span className="inline-flex items-center gap-1 text-xs text-muted-foreground tabular-nums">
                  <MessageSquareIcon className="size-3" />
                  {r.itemCount}
                </span>
                <span className="text-xs text-muted-foreground">
                  {r.createdByName} · {formatTime(r.createdAt)}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
