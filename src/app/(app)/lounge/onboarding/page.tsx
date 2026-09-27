import type { Metadata } from "next";
import Link from "next/link";
import { FileTextIcon, ListChecksIcon } from "lucide-react";
import { requireUser } from "@/lib/auth/dal";
import { todayKey } from "@/lib/dates";
import { ONBOARDING_WINDOW_DAYS, isNewcomer, newcomerProgress, onboardingChecksOf, onboardingItemsFor, teamPostOptions } from "@/lib/onboarding/queries";
import { teamScope } from "@/lib/teams/scope";
import { ChecklistManager } from "@/components/onboarding/checklist-manager";
import { NewcomerChecklist } from "@/components/onboarding/newcomer-checklist";
import { ProgressBar } from "@/components/motion";
import { TeamSwitcher } from "@/components/team-picker";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export const metadata: Metadata = { title: "온보딩" };

const short = (key: string) => key.slice(5).replace("-", "/");

export default async function OnboardingPage({ searchParams }: PageProps<"/lounge/onboarding">) {
  const user = await requireUser();
  const sp = await searchParams;
  const scope = teamScope(user, sp.team);
  const teamId = scope.teamId;

  if (teamId == null) {
    return <p className="text-sm text-muted-foreground">소속 팀이 없습니다.</p>;
  }

  const today = todayKey();
  const items = onboardingItemsFor(teamId);
  const canLead = scope.canLead(teamId);
  const me = scope.me;
  const newcomer = !!me && me.teamId === teamId && isNewcomer(me.joinedAt, today);
  const progress = canLead ? newcomerProgress(teamId, items.map((i) => i.id)) : [];

  return (
    <div className="grid gap-6">
      <div className="flex flex-wrap items-center gap-3">
        <h2 className="flex items-center gap-2 text-lg font-bold">
          <ListChecksIcon className="size-5 text-brand" />
          온보딩
        </h2>
        <span className="text-sm text-muted-foreground">입사 {ONBOARDING_WINDOW_DAYS}일 이내 구성원의 체크리스트</span>
        {scope.isAdmin && (
          <div className="ml-auto">
            <TeamSwitcher teams={scope.teams.map((t) => ({ id: t.id, name: t.name }))} value={teamId} />
          </div>
        )}
      </div>

      {newcomer && me && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base font-bold">내 온보딩</CardTitle>
            <CardDescription>입사 {me.joinedAt}</CardDescription>
          </CardHeader>
          <CardContent>
            <NewcomerChecklist items={items} checks={onboardingChecksOf(me.id, items.map((i) => i.id))} today={today} />
          </CardContent>
        </Card>
      )}

      {canLead && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base font-bold">신규 입사자 진행 현황</CardTitle>
          </CardHeader>
          <CardContent className="overflow-x-auto p-0">
            {progress.length === 0 ? (
              <p className="px-4 pb-4 text-sm text-muted-foreground">온보딩 기간인 구성원이 없습니다.</p>
            ) : (
              <table className="w-full min-w-[480px] text-sm">
                <thead className="border-y bg-muted/40 text-xs text-muted-foreground">
                  <tr>
                    <th className="px-4 py-2 text-left font-medium">이름</th>
                    <th className="px-3 py-2 text-left font-medium">입사일</th>
                    <th className="px-3 py-2 text-left font-medium">진행</th>
                    <th className="px-4 py-2 text-left font-medium">최근 체크</th>
                  </tr>
                </thead>
                <tbody>
                  {progress.map((p) => (
                    <tr key={p.id} className="border-b last:border-b-0">
                      <td className="px-4 py-2.5 font-medium">{p.name}</td>
                      <td className="px-3 py-2.5 tabular-nums">{p.joinedAt}</td>
                      <td className="px-3 py-2.5">
                        <div className="flex items-center gap-2">
                          <ProgressBar value={p.total ? p.done / p.total : 0} className="w-24" />
                          <span className="text-xs tabular-nums">
                            {p.done}/{p.total}
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-2.5 text-muted-foreground tabular-nums">{p.lastChecked ? short(p.lastChecked) : "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </CardContent>
        </Card>
      )}

      {canLead ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base font-bold">체크리스트 관리</CardTitle>
          </CardHeader>
          <CardContent>
            <ChecklistManager teamId={teamId} items={items} posts={teamPostOptions(teamId)} />
          </CardContent>
        </Card>
      ) : (
        !newcomer && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base font-bold">팀 온보딩 체크리스트</CardTitle>
            </CardHeader>
            <CardContent>
              {items.length === 0 ? (
                <p className="text-sm text-muted-foreground">등록된 항목이 없습니다.</p>
              ) : (
                <ol className="grid gap-2">
                  {items.map((it, i) => (
                    <li key={it.id} className="flex items-start gap-3 rounded-lg border px-3 py-2.5">
                      <span className="mt-0.5 grid size-6 shrink-0 place-items-center rounded-full bg-brand-soft text-xs font-semibold text-accent-foreground tabular-nums">{i + 1}</span>
                      <div className="grid min-w-0 flex-1 gap-1">
                        <span className="text-sm font-medium">{it.title}</span>
                        {it.description && <p className="text-xs whitespace-pre-wrap text-muted-foreground">{it.description}</p>}
                        {it.postId != null && (
                          <Link href={`/lounge/${it.postId}`} className="inline-flex w-fit items-center gap-1 text-xs text-accent-foreground hover:underline">
                            <FileTextIcon className="size-3" />
                            {it.postTitle}
                          </Link>
                        )}
                      </div>
                    </li>
                  ))}
                </ol>
              )}
            </CardContent>
          </Card>
        )
      )}
    </div>
  );
}
