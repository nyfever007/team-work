import "server-only";
import { and, eq, gte, inArray, lte } from "drizzle-orm";
import { addDays, formatKoDate } from "@/lib/dates";
import { db, schema } from "@/lib/db";
import { LEAVE_LABEL } from "@/lib/leaves/types";
import { allMembers, teamById } from "@/lib/members/queries";
import { STATUS_LABEL } from "@/lib/milestones/types";
import { weeklyItemsFor } from "@/lib/plans/queries";
import { tasksFor } from "@/lib/tasks/queries";
import { TASK_STATUS_LABEL } from "@/lib/tasks/types";
import { loadHolidays, weekInfo } from "@/lib/workdays";

export type WeekSource = {
  team: { id: number; name: string };
  weekStart: string;
  weekEnd: string;
  period: string;
  workingDays: number;
  members: {
    id: number;
    name: string;
    position: string;
    isLeader: boolean;
    weeklyItems: { title: string; status: string; assigned: boolean; milestone?: string }[];
    doneTasks: { date: string; title: string; status: string }[];
    extras: { date: string; text: string }[];
    result: string;
    leaves: string[];
  }[];
  milestones: { title: string; status: string; progress: number; dueDate: string; owner?: string; updates: { date: string; note: string; progress: number }[] }[];
};

/** Everything the report prompt needs for one team-week. */
export function collectWeekSource(teamId: number, weekStart: string): WeekSource | null {
  const team = teamById(teamId);
  if (!team) return null;
  const weekEnd = addDays(weekStart, 6);
  const holidays = loadHolidays(weekStart, weekEnd);
  const week = weekInfo(weekStart, holidays);
  const members = allMembers().filter((m) => m.teamId === teamId);
  const ids = members.map((m) => m.id);
  const nameOf = new Map(members.map((m) => [m.id, m.name]));

  const tasks = tasksFor(ids, weekStart, weekEnd);
  const items = weeklyItemsFor(ids, weekStart);
  const logs = ids.length ? db.select().from(schema.dailyLogs).where(and(inArray(schema.dailyLogs.memberId, ids), gte(schema.dailyLogs.date, weekStart), lte(schema.dailyLogs.date, weekEnd))).all() : [];
  const reports = ids.length ? db.select().from(schema.weeklyReports).where(and(inArray(schema.weeklyReports.memberId, ids), eq(schema.weeklyReports.weekStart, weekStart))).all() : [];
  const leaves = ids.length ? db.select().from(schema.leaves).where(and(inArray(schema.leaves.memberId, ids), gte(schema.leaves.date, weekStart), lte(schema.leaves.date, weekEnd))).all() : [];
  const milestones = db.select().from(schema.milestones).where(eq(schema.milestones.teamId, teamId)).all().filter((m) => m.startDate <= weekEnd && (m.dueDate >= addDays(weekStart, -14) || m.status !== "done"));
  const msTitle = new Map(milestones.map((m) => [m.id, m.title]));
  const updates = milestones.length
    ? db.select().from(schema.milestoneUpdates).where(and(inArray(schema.milestoneUpdates.milestoneId, milestones.map((m) => m.id)))).all().filter((u) => {
        const d = u.createdAt.toISOString().slice(0, 10);
        return d >= weekStart && d <= weekEnd;
      })
    : [];

  return {
    team: { id: team.id, name: team.name },
    weekStart,
    weekEnd,
    period: `${formatKoDate(weekStart)} ~ ${formatKoDate(weekEnd)}`,
    workingDays: week.workingDays.length,
    members: members.map((m) => ({
      id: m.id,
      name: m.name,
      position: m.position,
      isLeader: m.isLeader,
      weeklyItems: items.filter((w) => w.memberId === m.id).map((w) => ({ title: w.title, status: TASK_STATUS_LABEL[w.status], assigned: w.assignedBy != null, milestone: w.milestoneId != null ? msTitle.get(w.milestoneId) : undefined })),
      doneTasks: tasks.filter((t) => t.memberId === m.id).map((t) => ({ date: t.date, title: t.title, status: TASK_STATUS_LABEL[t.status] })),
      extras: logs.filter((l) => l.memberId === m.id && l.done.trim()).map((l) => ({ date: l.date, text: l.done.trim() })),
      result: reports.find((r) => r.memberId === m.id)?.result.trim() ?? "",
      leaves: leaves.filter((l) => l.memberId === m.id).map((l) => `${l.date.slice(5)} ${LEAVE_LABEL[l.type]}`),
    })),
    milestones: milestones.map((ms) => ({
      title: ms.title,
      status: STATUS_LABEL[ms.status],
      progress: ms.progress,
      dueDate: ms.dueDate,
      owner: ms.ownerId != null ? nameOf.get(ms.ownerId) : undefined,
      updates: updates.filter((u) => u.milestoneId === ms.id).map((u) => ({ date: u.createdAt.toISOString().slice(0, 10), note: u.note, progress: u.progress })),
    })),
  };
}

/** Plain-text rendering of the source, used as the user message and shown to the leader as "참고 자료". */
export function renderSource(src: WeekSource): string {
  const lines: string[] = [];
  lines.push(`팀 이름: ${src.team.name}`);
  lines.push(`기간: ${src.period} (근무일 ${src.workingDays}일)`);
  lines.push("");
  for (const m of src.members) {
    lines.push(`## ${m.name} (${m.position}${m.isLeader ? ", 팀장" : ""})`);
    if (m.leaves.length) lines.push(`휴가: ${m.leaves.join(", ")}`);
    if (m.weeklyItems.length) {
      lines.push("이번 주 항목:");
      for (const w of m.weeklyItems) lines.push(`- [${w.status}] ${w.title}${w.milestone ? ` (마일스톤: ${w.milestone})` : ""}${w.assigned ? " (팀장 지정)" : ""}`);
    }
    if (m.doneTasks.length) {
      lines.push("일별 처리 항목:");
      for (const t of m.doneTasks) lines.push(`- ${t.date.slice(5)} [${t.status}] ${t.title}`);
    }
    if (m.extras.length) {
      lines.push("추가로 한 일:");
      for (const e of m.extras) lines.push(`- ${e.date.slice(5)} ${e.text.replace(/\n/g, " / ")}`);
    }
    if (m.result) lines.push(`본인 작성 주간 성과: ${m.result.replace(/\n/g, " / ")}`);
    if (!m.weeklyItems.length && !m.doneTasks.length && !m.extras.length && !m.result) lines.push("(기록 없음)");
    lines.push("");
  }
  if (src.milestones.length) {
    lines.push("## 팀 마일스톤");
    for (const ms of src.milestones) {
      lines.push(`- ${ms.title} · ${ms.status} ${ms.progress}% · 마감 ${ms.dueDate}${ms.owner ? ` · 담당 ${ms.owner}` : ""}`);
      for (const u of ms.updates) lines.push(`  - ${u.date.slice(5)} (${u.progress}%) ${u.note}`);
    }
  }
  return lines.join("\n");
}
