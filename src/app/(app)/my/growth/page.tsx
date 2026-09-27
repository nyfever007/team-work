import type { Metadata } from "next";
import { SproutIcon } from "lucide-react";
import { requireUser } from "@/lib/auth/dal";
import { todayKey } from "@/lib/dates";
import { currentPeriod, shiftPeriod } from "@/lib/evaluations/types";
import { growthGoalsFor } from "@/lib/growth/queries";
import { isQuarterKey } from "@/lib/growth/types";
import { GrowthGoals } from "@/components/growth/growth-goals";
import { QuarterNav } from "@/components/growth/quarter-nav";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export const metadata: Metadata = { title: "성장 계획" };

export default async function GrowthPage({ searchParams }: PageProps<"/my/growth">) {
  const user = await requireUser();
  const sp = await searchParams;
  if (user.memberId == null) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>구성원과 연결되지 않은 계정입니다</CardTitle>
          <CardDescription>구성원과 연결된 계정만 성장 계획을 쓸 수 있습니다.</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  const current = currentPeriod("quarter", todayKey());
  const max = shiftPeriod(current, 1);
  const quarter = isQuarterKey(sp.q) && sp.q <= max ? sp.q : current;
  const prev = shiftPeriod(quarter, -1);
  const rows = growthGoalsFor(user.memberId, [prev, quarter]);
  const goals = rows
    .filter((g) => g.quarter === quarter)
    .map((g) => ({ id: g.id, title: g.title, plan: g.plan, status: g.status, reflection: g.reflection, leaderComment: g.leaderComment, leaderName: g.leaderName }));
  const titles = new Set(goals.map((g) => g.title));
  const canImport = rows.some((g) => g.quarter === prev && (g.status === "planned" || g.status === "in_progress") && !titles.has(g.title));

  return (
    <div className="grid gap-6">
      <div className="flex flex-wrap items-center gap-3">
        <h2 className="flex items-center gap-2 text-lg font-bold">
          <SproutIcon className="size-5 text-brand" />
          성장 계획
        </h2>
        <div className="ml-auto">
          <QuarterNav quarter={quarter} current={current} max={max} href={(q) => `/my/growth?q=${q}`} />
        </div>
      </div>
      <GrowthGoals key={quarter} quarter={quarter} goals={goals} canImport={canImport} />
    </div>
  );
}
