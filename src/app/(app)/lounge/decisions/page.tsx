import type { Metadata } from "next";
import Link from "next/link";
import { PlusIcon } from "lucide-react";
import { requireUser } from "@/lib/auth/dal";
import { boardAccess, decisionPosts } from "@/lib/board/queries";
import { teamScope } from "@/lib/teams/scope";
import { DecisionStatusBadge } from "@/components/board/decision-status";
import { TeamSwitcher } from "@/components/team-picker";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "결정 기록" };

type SP = Record<string, string | string[] | undefined>;

export default async function DecisionsPage({ searchParams }: { searchParams: Promise<SP> }) {
  const user = await requireUser();
  const sp = await searchParams;
  const scope = teamScope(user, sp.team);
  const { teamId } = scope;
  if (teamId == null) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>팀에 속한 구성원만 볼 수 있습니다</CardTitle>
        </CardHeader>
      </Card>
    );
  }
  const access = boardAccess(user);
  const activeOnly = (Array.isArray(sp.status) ? sp.status[0] : sp.status) === "active";
  const rows = decisionPosts(teamId, activeOnly ? "active" : undefined);
  const team = scope.teams.find((t) => t.id === teamId);
  const teamQ = scope.isAdmin ? `team=${teamId}` : "";
  const href = (active: boolean) => {
    const q = [teamQ, active ? "status=active" : ""].filter(Boolean).join("&");
    return q ? `/lounge/decisions?${q}` : "/lounge/decisions";
  };
  const tab = (on: boolean) => cn("rounded-md px-2.5 py-1", on ? "bg-muted font-semibold" : "text-muted-foreground");

  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <h2 className="text-lg font-bold">결정 기록</h2>
          <span className="text-sm text-muted-foreground">{team?.name}</span>
          {scope.isAdmin && <TeamSwitcher teams={scope.teams} value={teamId} keep={["status"]} />}
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center rounded-lg border bg-card p-0.5 text-xs">
            <Link href={href(false)} className={tab(!activeOnly)}>
              전체
            </Link>
            <Link href={href(true)} className={tab(activeOnly)}>
              유효만
            </Link>
          </div>
          <Button asChild>
            <Link href={`/lounge/new?cat=decision${teamQ ? `&${teamQ}` : ""}`}>
              <PlusIcon />
              결정 기록 추가
            </Link>
          </Button>
        </div>
      </div>

      <div className="overflow-x-auto rounded-xl border bg-card shadow-xs">
        <table className="w-full min-w-[560px] text-sm">
          <thead className="border-b bg-muted/40 text-xs text-muted-foreground">
            <tr>
              <th className="w-28 px-4 py-2.5 text-left font-medium">결정일</th>
              <th className="px-3 py-2.5 text-left font-medium">제목</th>
              <th className="w-20 px-3 py-2.5 text-left font-medium">상태</th>
              <th className="w-28 px-4 py-2.5 text-left font-medium">작성자</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr>
                <td colSpan={4} className="px-4 py-10 text-center text-muted-foreground">
                  결정 기록이 없습니다.
                </td>
              </tr>
            )}
            {rows.map((p) => (
              <tr key={p.id} className={cn("border-b last:border-0", p.decisionStatus === "superseded" && "text-muted-foreground")}>
                <td className="px-4 py-2.5 tabular-nums">{p.decidedAt ?? "—"}</td>
                <td className="px-3 py-2.5">
                  <Link href={`/lounge/${p.id}`} className={cn("font-medium hover:underline", p.decisionStatus === "superseded" && "line-through decoration-muted-foreground/40")}>
                    {p.title}
                  </Link>
                </td>
                <td className="px-3 py-2.5">
                  <DecisionStatusBadge postId={p.id} status={p.decisionStatus ?? "active"} editable={access.canSetStatus(p)} />
                </td>
                <td className="px-4 py-2.5">{p.authorName}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
