import type { Metadata } from "next";
import Link from "next/link";
import { ChevronLeftIcon, ChevronRightIcon, PlusIcon } from "lucide-react";
import { requireUser } from "@/lib/auth/dal";
import { addDays, addMonths, daysInMonth, formatKoDate, formatKoMonth, isValidKey, isValidMonth, monthGrid, monthOf, todayKey, weekStartOf } from "@/lib/dates";
import { allMembers, allTeams } from "@/lib/members/queries";
import { milestoneAccess } from "@/lib/milestones/permissions";
import { milestoneById, milestoneUpdatesFor, milestonesInRange } from "@/lib/milestones/queries";
import { monthlyGoalsForMilestone, weeklyItemsForMilestone } from "@/lib/plans/queries";
import { STATUS_LABEL, STATUS_STYLE, type MilestoneStatus } from "@/lib/milestones/types";
import { loadHolidays } from "@/lib/workdays";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { DetailDialog } from "./detail-dialog";
import { MilestoneDetail } from "./milestone-detail";
import { MilestoneFormDialog } from "./milestone-form-dialog";
import { Gantt } from "./gantt";
import { MilestoneCalendar } from "./milestone-calendar";

export const metadata: Metadata = { title: "마일스톤" };

const BASE = "/team/milestones";

const DEFAULT_WEEKS = 12;
const DEFAULT_BACK_WEEKS = 3;

export default async function MilestonesPage({ searchParams }: PageProps<"/team/milestones">) {
  const user = await requireUser();
  const sp = await searchParams;
  const today = todayKey();

  const weeks = Math.min(26, Math.max(4, Number(sp.weeks) || DEFAULT_WEEKS));
  const from = isValidKey(sp.from) ? weekStartOf(sp.from) : addDays(weekStartOf(today), -7 * DEFAULT_BACK_WEEKS);
  const to = addDays(from, weeks * 7 - 1);
  const hideDone = sp.hide === "done";
  const view = sp.view === "calendar" ? "calendar" : "timeline";
  const month = isValidMonth(sp.month) ? sp.month : monthOf(today);
  const selectedId = Number(sp.m);

  const base = new URLSearchParams();
  if (from !== addDays(weekStartOf(today), -7 * DEFAULT_BACK_WEEKS)) base.set("from", from);
  if (weeks !== DEFAULT_WEEKS) base.set("weeks", String(weeks));
  if (hideDone) base.set("hide", "done");
  if (view === "calendar") base.set("view", "calendar");
  if (view === "calendar" && month !== monthOf(today)) base.set("month", month);
  const href = (overrides: Record<string, string | null>) => {
    const p = new URLSearchParams(base);
    for (const [k, v] of Object.entries(overrides)) {
      if (v === null) p.delete(k);
      else p.set(k, v);
    }
    const q = p.toString();
    return q ? `${BASE}?${q}` : BASE;
  };

  const access = milestoneAccess(user);
  const members = allMembers();
  const teams = allTeams().map((t) => ({ id: t.id, name: t.name }));
  const memberName = new Map(members.map((m) => [m.id, m.name]));
  const grid = monthGrid(month);
  const calFrom = grid[0][0];
  const calTo = grid[grid.length - 1][6];
  const rangeFrom = view === "calendar" ? calFrom : from;
  const rangeTo = view === "calendar" ? calTo : to;
  const holidays = loadHolidays(rangeFrom, rangeTo);

  const all = milestonesInRange(rangeFrom, rangeTo);
  const visible = hideDone ? all.filter((m) => m.status !== "done") : all;
  const counts = all.reduce<Record<MilestoneStatus, number>>(
    (acc, m) => ((acc[m.status] += 1), acc),
    { planned: 0, in_progress: 0, done: 0, on_hold: 0 },
  );

  const selected = Number.isInteger(selectedId) && selectedId > 0 ? milestoneById(selectedId) : undefined;
  const updates = selected ? milestoneUpdatesFor(selected.id) : [];
  const linkedWeekly = selected ? weeklyItemsForMilestone(selected.id) : [];
  const linkedGoals = selected ? monthlyGoalsForMilestone(selected.id) : [];

  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold">마일스톤 {view === "calendar" ? "달력" : "타임라인"}</h2>
          <p className="text-sm text-muted-foreground">
            {view === "calendar" ? `${formatKoMonth(month)} · 이달 마일스톤 ${all.filter((m) => m.startDate <= daysInMonth(month).at(-1)! && m.dueDate >= daysInMonth(month)[0]).length}개` : `${formatKoDate(from)} ~ ${formatKoDate(to)} · ${weeks}주`} · 바를 클릭하면 현황을 볼 수 있습니다.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-1">
          <div className="mr-1 flex rounded-md border p-0.5 text-sm">
            <Button variant={view === "timeline" ? "secondary" : "ghost"} size="sm" className="h-7" asChild>
              <Link href={href({ view: null, month: null })}>타임라인</Link>
            </Button>
            <Button variant={view === "calendar" ? "secondary" : "ghost"} size="sm" className="h-7" asChild>
              <Link href={href({ view: "calendar", from: null, weeks: null })}>달력</Link>
            </Button>
          </div>
          {view === "calendar" ? (
            <>
              <Button variant="outline" size="icon" asChild aria-label="이전 달">
                <Link href={href({ month: addMonths(month, -1) })}><ChevronLeftIcon className="size-4" /></Link>
              </Button>
              <Button variant="outline" size="sm" asChild>
                <Link href={href({ month: null })}>이번 달</Link>
              </Button>
              <Button variant="outline" size="icon" asChild aria-label="다음 달">
                <Link href={href({ month: addMonths(month, 1) })}><ChevronRightIcon className="size-4" /></Link>
              </Button>
            </>
          ) : (
            <>
              <Button variant="outline" size="icon" asChild aria-label="이전 4주">
                <Link href={href({ from: addDays(from, -28) })}>
                  <ChevronLeftIcon className="size-4" />
                </Link>
              </Button>
              <Button variant="outline" size="sm" asChild>
                <Link href={href({ from: null })}>오늘</Link>
              </Button>
              <Button variant="outline" size="icon" asChild aria-label="다음 4주">
                <Link href={href({ from: addDays(from, 28) })}>
                  <ChevronRightIcon className="size-4" />
                </Link>
              </Button>
              <Button variant="outline" size="sm" asChild>
                <Link href={href({ weeks: weeks === DEFAULT_WEEKS ? "24" : null })}>{weeks === DEFAULT_WEEKS ? "24주 보기" : "12주 보기"}</Link>
              </Button>
            </>
          )}
          <Button variant="outline" size="sm" asChild>
            <Link href={href({ hide: hideDone ? null : "done" })}>{hideDone ? "완료 보이기" : "완료 숨기기"}</Link>
          </Button>
          {(access.teamIds === "all" || access.teamIds.length > 0) && (
            <MilestoneFormDialog
              mode="create"
              teams={teams}
              allowedTeamIds={access.teamIds}
              members={members.map((m) => ({ id: m.id, name: m.name, team: m.team }))}
              trigger={
                <Button>
                  <PlusIcon className="size-4" />
                  마일스톤 추가
                </Button>
              }
            />
          )}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2 text-xs">
        {(Object.keys(STATUS_LABEL) as MilestoneStatus[]).map((s) => (
          <span key={s} className={cn("inline-flex items-center gap-1 rounded px-1.5 py-0.5 font-medium", STATUS_STYLE[s].badge)}>
            <span className={cn("size-2 rounded-full", STATUS_STYLE[s].dot)} />
            {STATUS_LABEL[s]} {counts[s]}
          </span>
        ))}
        <span className="rounded bg-red-100 px-1.5 py-0.5 font-medium text-red-800">지연 = 마감 지남</span>
      </div>

      {view === "calendar" ? (
        <MilestoneCalendar month={month} today={today} holidays={holidays} milestones={visible} hrefFor={(id) => href({ m: String(id) })} />
      ) : (
        <Gantt from={from} weeks={weeks} today={today} holidays={holidays} milestones={visible} memberName={memberName} hrefFor={(id) => href({ m: String(id) })} />
      )}

      <DetailDialog open={!!selected} closeHref={href({ m: null })}>
        {selected && (
          <MilestoneDetail
            milestone={selected}
            updates={updates}
            linkedWeekly={linkedWeekly}
            linkedGoals={linkedGoals}
            memberName={memberName}
            today={today}
            ownerName={selected.ownerId != null ? memberName.get(selected.ownerId) ?? null : null}
            canManage={access.canManage(selected)}
            canUpdate={access.canUpdate(selected)}
            teams={teams}
            allowedTeamIds={access.teamIds}
            members={members.map((m) => ({ id: m.id, name: m.name, team: m.team }))}
            closeHref={href({ m: null })}
          />
        )}
      </DetailDialog>
    </div>
  );
}
