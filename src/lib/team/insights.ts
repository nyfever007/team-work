import "server-only";
import { and, eq, inArray } from "drizzle-orm";
import { addDays, currentHourKST, todayKey, weekStartOf } from "@/lib/dates";
import { db, schema } from "@/lib/db";
import type { DailyReview, DailyTask, Leave, WeeklyItem } from "@/lib/db/schema";
import type { Member } from "@/lib/members/types";
import { milestonesInRange } from "@/lib/milestones/queries";
import { isOverdue, type MilestoneRow } from "@/lib/milestones/types";
import { weeklyItemsFor, weeklyItemsInRange } from "@/lib/plans/queries";
import { reviewsFor } from "@/lib/reviews/queries";
import { tasksFor } from "@/lib/tasks/queries";
import { isWorkingDay, loadHolidays } from "@/lib/workdays";

export type Attention = { key: "no_plan" | "no_week" | "overdue" | "milestone_overdue" | "no_review"; label: string; level: "warn" | "info" };

export type MemberInsight = {
  member: Member;
  leaveToday: Leave | null;
  tasksToday: DailyTask[];
  weekItems: WeeklyItem[];
  overdueItems: WeeklyItem[]; // from previous weeks, not done
  ownedMilestones: MilestoneRow[];
  lastReview: DailyReview | null;
  reviewedToday: boolean;
  /** The caller's own review text for today, if any (prefills the form). */
  myReviewToday: string | null;
  attention: Attention[];
};

export type TeamSummary = {
  members: number;
  onLeave: number;
  planned: number; // members with tasks today
  weekDone: number;
  weekTotal: number;
  overdue: number;
  milestones: { active: number; overdue: number; done: number };
};

export function buildInsights(members: Member[], reviewerId: number): { insights: MemberInsight[]; summary: TeamSummary; today: string; weekStart: string; working: boolean } {
  const today = todayKey();
  const hour = currentHourKST();
  const weekStart = weekStartOf(today);
  const holidays = loadHolidays(addDays(today, -35), addDays(today, 7));
  const working = isWorkingDay(today, holidays);
  const ids = members.map((m) => m.id);

  const tasksToday = tasksFor(ids, today, today);
  const weekItems = weeklyItemsFor(ids, weekStart);
  const pastItems = weeklyItemsInRange(ids, addDays(weekStart, -28), addDays(weekStart, -7)).filter((w) => w.status !== "done");
  const leaves = ids.length ? db.select().from(schema.leaves).where(and(inArray(schema.leaves.memberId, ids), eq(schema.leaves.date, today))).all() : [];
  const reviews = reviewsFor(ids, addDays(today, -30), today);
  const milestones = milestonesInRange(addDays(today, -365), addDays(today, 365));

  const insights: MemberInsight[] = members.map((m) => {
    const leaveToday = leaves.find((l) => l.memberId === m.id) ?? null;
    const myTasks = tasksToday.filter((t) => t.memberId === m.id);
    const myItems = weekItems.filter((w) => w.memberId === m.id);
    const overdueItems = pastItems.filter((w) => w.memberId === m.id);
    const owned = milestones.filter((ms) => ms.ownerId === m.id && ms.status !== "done");
    const myReviews = reviews.filter((r) => r.memberId === m.id);
    const lastReview = myReviews.at(-1) ?? null;
    const mine = myReviews.find((r) => r.date === today && r.reviewerId === reviewerId);
    const reviewedToday = !!mine;
    const myReviewToday = mine?.comment ?? null;
    const fullDayOff = leaveToday != null && !["half_am", "half_pm", "early_leave"].includes(leaveToday.type);

    const attention: Attention[] = [];
    if (working && !fullDayOff && hour >= 10 && myTasks.length === 0) attention.push({ key: "no_plan", label: "오늘 할 일 미작성", level: "warn" });
    if (myItems.length === 0) attention.push({ key: "no_week", label: "이번 주 항목 없음", level: "warn" });
    if (overdueItems.length > 0) attention.push({ key: "overdue", label: `지난 주 미완료 ${overdueItems.length}개`, level: "warn" });
    const lateMs = owned.filter((ms) => isOverdue(ms, today));
    if (lateMs.length > 0) attention.push({ key: "milestone_overdue", label: `담당 마일스톤 지연 ${lateMs.length}개`, level: "warn" });
    if (!lastReview || lastReview.date < addDays(today, -7)) attention.push({ key: "no_review", label: lastReview ? "리뷰 7일 이상 없음" : "리뷰 기록 없음", level: "info" });

    return { member: m, leaveToday, tasksToday: myTasks, weekItems: myItems, overdueItems, ownedMilestones: owned, lastReview, reviewedToday, myReviewToday, attention };
  });

  const summary: TeamSummary = {
    members: members.length,
    onLeave: leaves.length,
    planned: insights.filter((i) => i.tasksToday.length > 0).length,
    weekDone: weekItems.filter((w) => w.status === "done").length,
    weekTotal: weekItems.length,
    overdue: pastItems.length,
    milestones: {
      active: milestones.filter((ms) => ids.includes(ms.ownerId ?? -1) && ms.status !== "done" && ms.status !== "on_hold").length,
      overdue: milestones.filter((ms) => ids.includes(ms.ownerId ?? -1) && isOverdue(ms, today)).length,
      done: milestones.filter((ms) => ids.includes(ms.ownerId ?? -1) && ms.status === "done").length,
    },
  };

  return { insights, summary, today, weekStart, working };
}
