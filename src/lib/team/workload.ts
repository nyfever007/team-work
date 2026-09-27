import "server-only";
import { and, eq, gte, inArray, lte } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import { addDays, weekStartOf } from "@/lib/dates";
import { allMembers } from "@/lib/members/queries";
import type { Member } from "@/lib/members/types";
import type { MilestoneTaskStatus } from "@/lib/milestones/task-types";
import type { MilestoneStatus } from "@/lib/milestones/types";
import { LEAVE_DAYS, type LeaveType } from "@/lib/leaves/types";
import { PULSE_MIN_RESPONSES } from "@/lib/pulse/types";

/** Milestone statuses whose 작업 count as open load ("done" is finished; there is no cancelled status). */
const ACTIVE_MILESTONE: MilestoneStatus[] = ["planned", "in_progress", "on_hold"];
export const OPEN_TASK_STATUSES = ["todo", "in_progress", "review"] as const satisfies readonly MilestoneTaskStatus[];
export type OpenTaskStatus = (typeof OPEN_TASK_STATUSES)[number];

export const OVERLOAD_MIN_TASKS = 5;
export const OVERLOAD_MEDIAN_FACTOR = 1.5;
export const OVERLOAD_OVERTIME_HOURS = 12;
export const OVERTIME_WINDOW_DAYS = 28;
export const DUE_SOON_DAYS = 7;
export const LEAVE_WINDOW_DAYS = 14;
export const PULSE_WEEKS = 6;

export type WorkloadFlagKind = "overload" | "overdue" | "idle" | "leave";
export type WorkloadFlag = { kind: WorkloadFlagKind; reason: string };

export type OpenTask = {
  id: number;
  title: string;
  status: OpenTaskStatus;
  dueDate: string | null;
  milestoneId: number;
  milestoneTitle: string;
  overdue: boolean;
};

export type MemberWorkload = {
  member: Member;
  open: Record<OpenTaskStatus, number>;
  openTotal: number;
  overdue: number;
  dueSoon: number;
  ownedMilestones: { id: number; title: string; dueDate: string }[];
  week: { done: number; total: number };
  lastWeekRate: number | null; // 0–100, null when no goals last week
  overtime: { approved: number; pending: number };
  leave: { days: number; dates: { date: string; type: LeaveType }[] };
  flags: WorkloadFlag[];
  tasks: OpenTask[];
  /** Sort key: open tasks + overdue weight + overtime. */
  load: number;
};

export type PulseWeek = { weekStart: string; responses: number; workload: number | null; mood: number | null };

export type TeamWorkload = {
  today: string;
  weekStart: string;
  members: MemberWorkload[];
  median: number;
  overloadThreshold: number;
  maxOpen: number;
  summary: { open: number; overdue: number; overloaded: number; overtime: number; pendingOvertime: number };
  pulse: PulseWeek[];
};

const round1 = (n: number) => Math.round(n * 10) / 10;

function median(values: number[]): number {
  if (values.length === 0) return 0;
  const s = [...values].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

/** Workload per member of one team as of `today` (YYYY-MM-DD, KST). Read-only; callers check leader/admin access. */
export function workloadFor(teamId: number, today: string): TeamWorkload {
  const weekStart = weekStartOf(today);
  const members = allMembers().filter((m) => m.teamId === teamId);
  const ids = members.map((m) => m.id);
  const pulse = pulseTrend(teamId, weekStart);
  const empty: TeamWorkload = {
    today,
    weekStart,
    members: [],
    median: 0,
    overloadThreshold: OVERLOAD_MIN_TASKS,
    maxOpen: 0,
    summary: { open: 0, overdue: 0, overloaded: 0, overtime: 0, pendingOvertime: 0 },
    pulse,
  };
  if (ids.length === 0) return empty;

  // Open 작업 on approved, unfinished milestones of this team.
  const taskRows = db
    .select({
      id: schema.milestoneTasks.id,
      title: schema.milestoneTasks.title,
      status: schema.milestoneTasks.status,
      dueDate: schema.milestoneTasks.dueDate,
      assigneeId: schema.milestoneTasks.assigneeId,
      milestoneId: schema.milestones.id,
      milestoneTitle: schema.milestones.title,
    })
    .from(schema.milestoneTasks)
    .innerJoin(schema.milestones, eq(schema.milestones.id, schema.milestoneTasks.milestoneId))
    .where(
      and(
        inArray(schema.milestoneTasks.assigneeId, ids),
        inArray(schema.milestoneTasks.status, [...OPEN_TASK_STATUSES]),
        eq(schema.milestones.approval, "approved"),
        inArray(schema.milestones.status, ACTIVE_MILESTONE),
      ),
    )
    .all();

  const owned = db
    .select({ id: schema.milestones.id, title: schema.milestones.title, dueDate: schema.milestones.dueDate, ownerId: schema.milestones.ownerId })
    .from(schema.milestones)
    .where(
      and(
        inArray(schema.milestones.ownerId, ids),
        eq(schema.milestones.approval, "approved"),
        inArray(schema.milestones.status, ACTIVE_MILESTONE),
      ),
    )
    .all();

  // Daily goals: last week Monday .. this week Sunday.
  const lastWeekStart = addDays(weekStart, -7);
  const weekEnd = addDays(weekStart, 6);
  const goals = db
    .select({ memberId: schema.dailyTasks.memberId, date: schema.dailyTasks.date, status: schema.dailyTasks.status })
    .from(schema.dailyTasks)
    .where(and(inArray(schema.dailyTasks.memberId, ids), gte(schema.dailyTasks.date, lastWeekStart), lte(schema.dailyTasks.date, weekEnd)))
    .all();

  const otFrom = `${addDays(today, -(OVERTIME_WINDOW_DAYS - 1))}T00:00`;
  const otTo = `${today}T23:59`;
  const overtime = db
    .select({ memberId: schema.overtimeRequests.memberId, hours: schema.overtimeRequests.hours, status: schema.overtimeRequests.status })
    .from(schema.overtimeRequests)
    .where(
      and(
        inArray(schema.overtimeRequests.memberId, ids),
        inArray(schema.overtimeRequests.status, ["approved", "submitted"]),
        gte(schema.overtimeRequests.startAt, otFrom),
        lte(schema.overtimeRequests.startAt, otTo),
      ),
    )
    .all();

  const leaveRows = db
    .select({ memberId: schema.leaves.memberId, date: schema.leaves.date, type: schema.leaves.type })
    .from(schema.leaves)
    .where(and(inArray(schema.leaves.memberId, ids), gte(schema.leaves.date, today), lte(schema.leaves.date, addDays(today, LEAVE_WINDOW_DAYS - 1))))
    .orderBy(schema.leaves.date)
    .all();

  const soonLimit = addDays(today, DUE_SOON_DAYS);
  const statusRank: Record<OpenTaskStatus, number> = { review: 0, in_progress: 1, todo: 2 };

  const rows = members.map((member) => {
    const mine = taskRows.filter((t) => t.assigneeId === member.id);
    const open: Record<OpenTaskStatus, number> = { todo: 0, in_progress: 0, review: 0 };
    const tasks: OpenTask[] = mine
      .map((t) => {
        const status = t.status as OpenTaskStatus;
        open[status] += 1;
        return {
          id: t.id,
          title: t.title,
          status,
          dueDate: t.dueDate,
          milestoneId: t.milestoneId,
          milestoneTitle: t.milestoneTitle,
          overdue: !!t.dueDate && t.dueDate < today,
        };
      })
      .sort(
        (a, b) =>
          Number(b.overdue) - Number(a.overdue) ||
          (a.dueDate ?? "9999").localeCompare(b.dueDate ?? "9999") ||
          statusRank[a.status] - statusRank[b.status] ||
          a.id - b.id,
      );
    const overdue = tasks.filter((t) => t.overdue).length;
    const dueSoon = tasks.filter((t) => t.dueDate && t.dueDate >= today && t.dueDate <= soonLimit).length;

    const myGoals = goals.filter((g) => g.memberId === member.id);
    const thisWeek = myGoals.filter((g) => g.date >= weekStart);
    const lastWeek = myGoals.filter((g) => g.date < weekStart);
    const lastDone = lastWeek.filter((g) => g.status === "done").length;

    const myOt = overtime.filter((o) => o.memberId === member.id);
    const sumHours = (status: string) => round1(myOt.filter((o) => o.status === status).reduce((s, o) => s + o.hours, 0));

    const myLeave = leaveRows.filter((l) => l.memberId === member.id);
    const leaveDays = myLeave.reduce((s, l) => s + LEAVE_DAYS[l.type], 0);

    return {
      member,
      open,
      openTotal: tasks.length,
      overdue,
      dueSoon,
      ownedMilestones: owned
        .filter((m) => m.ownerId === member.id)
        .map(({ id, title, dueDate }) => ({ id, title, dueDate }))
        .sort((a, b) => a.dueDate.localeCompare(b.dueDate)),
      week: { done: thisWeek.filter((g) => g.status === "done").length, total: thisWeek.length },
      lastWeekRate: lastWeek.length ? Math.round((lastDone / lastWeek.length) * 100) : null,
      overtime: { approved: sumHours("approved"), pending: sumHours("submitted") },
      leave: { days: leaveDays, dates: myLeave.map(({ date, type }) => ({ date, type })) },
      flags: [] as WorkloadFlag[],
      tasks,
      load: 0,
    } satisfies MemberWorkload;
  });

  const med = median(rows.map((r) => r.openTotal));
  const threshold = Math.max(OVERLOAD_MIN_TASKS, Math.ceil(OVERLOAD_MEDIAN_FACTOR * med));

  for (const r of rows) {
    const flags: WorkloadFlag[] = [];
    const heavy = r.openTotal >= threshold;
    const longHours = r.overtime.approved >= OVERLOAD_OVERTIME_HOURS;
    if (heavy || longHours) {
      const why: string[] = [];
      if (heavy) why.push(`진행 작업 ${r.openTotal}건 (기준 ${threshold}건, 팀 중앙값 ${round1(med)}건)`);
      if (longHours) why.push(`최근 ${OVERTIME_WINDOW_DAYS}일 승인 시간외 ${r.overtime.approved}시간 (기준 ${OVERLOAD_OVERTIME_HOURS}시간)`);
      flags.push({ kind: "overload", reason: why.join(" · ") });
    }
    if (r.overdue > 0) flags.push({ kind: "overdue", reason: `기한 지난 작업 ${r.overdue}건` });
    if (r.openTotal === 0 && r.ownedMilestones.length === 0) flags.push({ kind: "idle", reason: "진행 작업과 담당 마일스톤 없음" });
    if (r.leave.dates.length > 0) {
      const first = r.leave.dates[0].date;
      flags.push({ kind: "leave", reason: `${LEAVE_WINDOW_DAYS}일 내 휴가 ${r.leave.days}일 (${first.slice(5).replace("-", "/")}부터)` });
    }
    r.flags = flags;
    r.load = r.openTotal + r.overdue * 0.5 + r.ownedMilestones.length * 0.5 + r.overtime.approved / 8;
  }

  rows.sort((a, b) => b.load - a.load || a.member.name.localeCompare(b.member.name, "ko"));

  return {
    today,
    weekStart,
    members: rows,
    median: med,
    overloadThreshold: threshold,
    maxOpen: Math.max(0, ...rows.map((r) => r.openTotal)),
    summary: {
      open: rows.reduce((s, r) => s + r.openTotal, 0),
      overdue: rows.reduce((s, r) => s + r.overdue, 0),
      overloaded: rows.filter((r) => r.flags.some((f) => f.kind === "overload")).length,
      overtime: round1(rows.reduce((s, r) => s + r.overtime.approved, 0)),
      pendingOvertime: round1(rows.reduce((s, r) => s + r.overtime.pending, 0)),
    },
    pulse,
  };
}

/** Anonymous 펄스 averages for the last `PULSE_WEEKS` weeks (oldest first). Averages hidden below `PULSE_MIN_RESPONSES`. */
function pulseTrend(teamId: number, weekStart: string): PulseWeek[] {
  const weeks = Array.from({ length: PULSE_WEEKS }, (_, i) => addDays(weekStart, -7 * (PULSE_WEEKS - 1 - i)));
  const rows = db
    .select({ weekStart: schema.pulseResponses.weekStart, workload: schema.pulseResponses.workload, mood: schema.pulseResponses.mood })
    .from(schema.pulseResponses)
    .where(and(eq(schema.pulseResponses.teamId, teamId), inArray(schema.pulseResponses.weekStart, weeks)))
    .all();
  return weeks.map((w) => {
    const rs = rows.filter((r) => r.weekStart === w);
    const enough = rs.length >= PULSE_MIN_RESPONSES;
    const avg = (k: "workload" | "mood") => (enough ? round1(rs.reduce((s, r) => s + r[k], 0) / rs.length) : null);
    return { weekStart: w, responses: rs.length, workload: avg("workload"), mood: avg("mood") };
  });
}
