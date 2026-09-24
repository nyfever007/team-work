import "server-only";
import { and, eq, gte, lte } from "drizzle-orm";
import { addDays, formatKoDate, todayKey } from "@/lib/dates";
import { db, schema } from "@/lib/db";
import type { DailyReview, DailyTask, Leave, MemberReview, WeeklyItem } from "@/lib/db/schema";
import { LEAVE_LABEL } from "@/lib/leaves/types";
import type { Member } from "@/lib/members/types";
import { milestonesInRange } from "@/lib/milestones/queries";
import { STATUS_LABEL, isOverdue, type MilestoneRow } from "@/lib/milestones/types";
import { weeklyItemsFor } from "@/lib/plans/queries";
import { reviewsFor } from "@/lib/reviews/queries";
import { tasksFor } from "@/lib/tasks/queries";
import { TASK_STATUS_LABEL } from "@/lib/tasks/types";
import { isWorkingDay, loadHolidays } from "@/lib/workdays";
import { actionLines } from "./types";
import { memberReviewFor } from "./queries";

const PARTIAL_LEAVES = new Set(["half_am", "half_pm", "early_leave"]);

export type MemberWeekStats = {
  /** Working days so far this week the member was expected to work (full-day leave excluded). */
  workDays: number;
  /** Of those, days with at least one goal written. */
  plannedDays: number;
  /** Days with an end-of-day wrap-up (a status change or "추가로 한 일"). */
  wrapDays: number;
  tasksTotal: number;
  tasksDone: number;
  itemsTotal: number;
  itemsDone: number;
  assignedTotal: number;
  assignedDone: number;
};

export type MemberWeek = {
  member: Member;
  weekStart: string;
  weekEnd: string;
  period: string;
  days: string[]; // working days up to today
  items: WeeklyItem[];
  tasks: DailyTask[];
  extras: { date: string; text: string }[];
  result: string;
  leaves: Leave[];
  dailyReviews: DailyReview[];
  prevReview: MemberReview | undefined;
  milestones: (MilestoneRow & { overdue: boolean })[];
  stats: MemberWeekStats;
};

/** Everything a leader (and the AI) needs to evaluate one member's week. */
export function collectMemberWeek(member: Member, weekStart: string): MemberWeek {
  const today = todayKey();
  const weekEnd = addDays(weekStart, 6);
  const holidays = loadHolidays(weekStart, weekEnd);
  const id = member.id;

  const items = weeklyItemsFor([id], weekStart);
  const tasks = tasksFor([id], weekStart, weekEnd);
  const logs = db.select().from(schema.dailyLogs).where(and(eq(schema.dailyLogs.memberId, id), gte(schema.dailyLogs.date, weekStart), lte(schema.dailyLogs.date, weekEnd))).all();
  const report = db.select().from(schema.weeklyReports).where(and(eq(schema.weeklyReports.memberId, id), eq(schema.weeklyReports.weekStart, weekStart))).get();
  const leaves = db.select().from(schema.leaves).where(and(eq(schema.leaves.memberId, id), gte(schema.leaves.date, weekStart), lte(schema.leaves.date, weekEnd))).all();
  const dailyReviews = reviewsFor([id], weekStart, weekEnd);
  const prevReview = memberReviewFor(id, addDays(weekStart, -7));

  const linkedMs = new Set(items.map((w) => w.milestoneId).filter((v): v is number => v != null));
  const milestones = milestonesInRange(addDays(weekStart, -180), addDays(weekEnd, 180))
    .filter((ms) => linkedMs.has(ms.id) || (ms.ownerId === id && (ms.status !== "done" || ms.dueDate >= weekStart)))
    .map((ms) => ({ ...ms, overdue: isOverdue(ms, weekEnd < today ? weekEnd : today) }));

  const leaveOn = new Map(leaves.map((l) => [l.date, l]));
  const days: string[] = [];
  for (let d = weekStart; d <= weekEnd && d <= today; d = addDays(d, 1)) if (isWorkingDay(d, holidays)) days.push(d);
  const workDays = days.filter((d) => {
    const l = leaveOn.get(d);
    return !l || PARTIAL_LEAVES.has(l.type);
  });
  const extras = logs.filter((l) => l.done.trim()).map((l) => ({ date: l.date, text: l.done.trim() }));
  const tasksOn = (d: string) => tasks.filter((t) => t.date === d);
  const assigned = items.filter((w) => w.assignedBy != null);

  const stats: MemberWeekStats = {
    workDays: workDays.length,
    plannedDays: workDays.filter((d) => tasksOn(d).length > 0).length,
    wrapDays: workDays.filter((d) => tasksOn(d).some((t) => t.status !== "todo" || t.reviewedAt) || extras.some((e) => e.date === d)).length,
    tasksTotal: tasks.length,
    tasksDone: tasks.filter((t) => t.status === "done").length,
    itemsTotal: items.length,
    itemsDone: items.filter((w) => w.status === "done").length,
    assignedTotal: assigned.length,
    assignedDone: assigned.filter((w) => w.status === "done").length,
  };

  return {
    member,
    weekStart,
    weekEnd,
    period: `${formatKoDate(weekStart)} ~ ${formatKoDate(weekEnd)}`,
    days,
    items,
    tasks,
    extras,
    result: report?.result.trim() ?? "",
    leaves,
    dailyReviews,
    prevReview: prevReview?.status === "shared" ? prevReview : undefined,
    milestones,
    stats,
  };
}

export function hasRecords(w: MemberWeek) {
  return w.items.length > 0 || w.tasks.length > 0 || w.extras.length > 0 || !!w.result;
}

/** Plain-text rendering, used as the AI user message and shown to the leader as "참고 자료". */
export function renderMemberWeek(w: MemberWeek): string {
  const { member: m, stats: s } = w;
  const pct = (a: number, b: number) => (b ? `${Math.round((a / b) * 100)}%` : "—");
  const lines: string[] = [];
  lines.push(`구성원: ${m.name} (${m.team} · ${m.position}${m.rank ? ` · ${m.rank}` : ""})`);
  lines.push(`기간: ${w.period}`);
  lines.push(`기록 습관: 근무일 ${s.workDays}일 중 목표 작성 ${s.plannedDays}일, 퇴근 정리 ${s.wrapDays}일`);
  lines.push(`일일 목표 완료율: ${s.tasksDone}/${s.tasksTotal} (${pct(s.tasksDone, s.tasksTotal)}) · 주간 항목 완료: ${s.itemsDone}/${s.itemsTotal}${s.assignedTotal ? ` · 팀장 지정 항목 완료: ${s.assignedDone}/${s.assignedTotal}` : ""}`);
  if (w.leaves.length) lines.push(`휴가: ${w.leaves.map((l) => `${l.date.slice(5)} ${LEAVE_LABEL[l.type]}`).join(", ")}`);
  lines.push("");

  if (w.prevReview) {
    const prev = actionLines(w.prevReview.nextActions);
    if (prev.length) {
      lines.push("## 지난주 리뷰에서 요청한 할 일 (이행 여부 확인)");
      for (const a of prev) lines.push(`- ${a}`);
      lines.push("");
    }
  }

  lines.push("## 이번 주 항목");
  if (w.items.length === 0) lines.push("(없음)");
  for (const it of w.items) {
    const ms = it.milestoneId != null ? w.milestones.find((x) => x.id === it.milestoneId)?.title : undefined;
    lines.push(`- [${TASK_STATUS_LABEL[it.status]}] ${it.title}${ms ? ` (마일스톤: ${ms})` : ""}${it.assignedBy != null ? " (팀장 지정)" : ""}`);
  }
  lines.push("");

  lines.push("## 일별 목표와 결과");
  for (const d of w.days) {
    const ts = w.tasks.filter((t) => t.date === d);
    const extra = w.extras.find((e) => e.date === d);
    const leave = w.leaves.find((l) => l.date === d);
    lines.push(`### ${formatKoDate(d)}${leave ? ` · ${LEAVE_LABEL[leave.type]}` : ""}`);
    if (ts.length === 0 && !extra) lines.push("(기록 없음)");
    for (const t of ts) lines.push(`- [${TASK_STATUS_LABEL[t.status]}] ${t.title}`);
    if (extra) lines.push(`- 추가로 한 일: ${extra.text.replace(/\n/g, " / ")}`);
  }
  lines.push("");

  if (w.result) {
    lines.push("## 본인 작성 주간 성과");
    lines.push(w.result);
    lines.push("");
  }
  if (w.dailyReviews.length) {
    lines.push("## 이번 주 팀장 일일 코멘트");
    for (const r of w.dailyReviews) lines.push(`- ${r.date.slice(5)} ${r.comment.replace(/\n/g, " / ")}`);
    lines.push("");
  }
  if (w.milestones.length) {
    lines.push("## 관련 마일스톤");
    for (const ms of w.milestones) lines.push(`- ${ms.title} · ${STATUS_LABEL[ms.status]} ${ms.progress}% · 마감 ${ms.dueDate}${ms.overdue ? " · 지연" : ""}${ms.ownerId === m.id ? " · 담당" : ""}`);
  }
  return lines.join("\n").trim();
}

/** Per-member stats for the review list. Small teams, synchronous SQLite: one collect per member is fine. */
export function weekStatsFor(members: Member[], weekStart: string): Map<number, MemberWeekStats> {
  return new Map(members.map((m) => [m.id, collectMemberWeek(m, weekStart).stats]));
}
