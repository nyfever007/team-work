import "server-only";
import { and, eq, inArray } from "drizzle-orm";
import { addDays, currentHourKST, todayKey, weekStartOf } from "@/lib/dates";
import { db, schema } from "@/lib/db";
import type { DailyTask, Leave } from "@/lib/db/schema";
import type { Member } from "@/lib/members/types";
import { milestonesInRange } from "@/lib/milestones/queries";
import { isOverdue, type MilestoneRow } from "@/lib/milestones/types";
import { tasksFor } from "@/lib/tasks/queries";
import { isWorkingDay, loadHolidays, weekInfo } from "@/lib/workdays";

export type Attention = { key: "no_plan" | "no_report" | "no_last_report" | "milestone_overdue"; label: string; level: "warn" | "info" };

export type MemberInsight = {
  member: Member;
  leaveToday: Leave | null;
  tasksToday: DailyTask[];
  /** This week's daily goals (Mon..today). */
  weekTasks: DailyTask[];
  /** This week's 주간 보고 text ("" when not written). */
  weeklyReport: string;
  /** Whether last week's 주간 보고 was written. */
  lastWeekReported: boolean;
  ownedMilestones: MilestoneRow[];
  attention: Attention[];
};

export type TeamSummary = {
  members: number;
  onLeave: number;
  planned: number; // members with tasks today
  /** This week's daily goals done / total across the team. */
  weekDone: number;
  weekTotal: number;
  /** Members who wrote this week's 주간 보고. */
  reported: number;
  milestones: { active: number; overdue: number; done: number };
};

export function buildInsights(members: Member[]): { insights: MemberInsight[]; summary: TeamSummary; today: string; weekStart: string; working: boolean } {
  const today = todayKey();
  const hour = currentHourKST();
  const weekStart = weekStartOf(today);
  const holidays = loadHolidays(addDays(today, -35), addDays(today, 7));
  const working = isWorkingDay(today, holidays);
  const ids = members.map((m) => m.id);

  const tasksToday = tasksFor(ids, today, today);
  const weekTasks = tasksFor(ids, weekStart, today);
  const reports = ids.length
    ? db.select().from(schema.weeklyReports).where(and(inArray(schema.weeklyReports.memberId, ids), inArray(schema.weeklyReports.weekStart, [weekStart, addDays(weekStart, -7)]))).all()
    : [];
  const reportOf = (memberId: number, week: string) => reports.find((r) => r.memberId === memberId && r.weekStart === week)?.result.trim() ?? "";
  // 주간 보고 is due from the week's last working day.
  const lastWorkingDay = weekInfo(weekStart, holidays).lastWorkingDay ?? addDays(weekStart, 4);
  const leaves = ids.length ? db.select().from(schema.leaves).where(and(inArray(schema.leaves.memberId, ids), eq(schema.leaves.date, today))).all() : [];
  const milestones = milestonesInRange(addDays(today, -365), addDays(today, 365));

  const insights: MemberInsight[] = members.map((m) => {
    const leaveToday = leaves.find((l) => l.memberId === m.id) ?? null;
    const myTasks = tasksToday.filter((t) => t.memberId === m.id);
    const myWeekTasks = weekTasks.filter((t) => t.memberId === m.id);
    const weeklyReport = reportOf(m.id, weekStart);
    const lastWeekReported = !!reportOf(m.id, addDays(weekStart, -7));
    const owned = milestones.filter((ms) => ms.ownerId === m.id && ms.status !== "done");
    const fullDayOff = leaveToday != null && !["half_am", "half_pm", "early_leave"].includes(leaveToday.type);

    const attention: Attention[] = [];
    if (working && !fullDayOff && hour >= 10 && myTasks.length === 0) attention.push({ key: "no_plan", label: "오늘 할 일 미작성", level: "warn" });
    if (today >= lastWorkingDay && !weeklyReport) attention.push({ key: "no_report", label: "주간 보고 미작성", level: "warn" });
    if (!lastWeekReported) attention.push({ key: "no_last_report", label: "지난주 주간 보고 없음", level: today < lastWorkingDay ? "warn" : "info" });
    const lateMs = owned.filter((ms) => isOverdue(ms, today));
    if (lateMs.length > 0) attention.push({ key: "milestone_overdue", label: `담당 마일스톤 지연 ${lateMs.length}개`, level: "warn" });

    return { member: m, leaveToday, tasksToday: myTasks, weekTasks: myWeekTasks, weeklyReport, lastWeekReported, ownedMilestones: owned, attention };
  });

  const summary: TeamSummary = {
    members: members.length,
    onLeave: leaves.length,
    planned: insights.filter((i) => i.tasksToday.length > 0).length,
    weekDone: weekTasks.filter((t) => t.status === "done").length,
    weekTotal: weekTasks.length,
    reported: insights.filter((i) => i.weeklyReport).length,
    milestones: {
      active: milestones.filter((ms) => ids.includes(ms.ownerId ?? -1) && ms.status !== "done" && ms.status !== "on_hold").length,
      overdue: milestones.filter((ms) => ids.includes(ms.ownerId ?? -1) && isOverdue(ms, today)).length,
      done: milestones.filter((ms) => ids.includes(ms.ownerId ?? -1) && ms.status === "done").length,
    },
  };

  return { insights, summary, today, weekStart, working };
}
