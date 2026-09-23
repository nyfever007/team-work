import "server-only";
import { addDays, formatKoDate, todayKey } from "@/lib/dates";
import { allMembers } from "@/lib/members/queries";
import { collectWeekSource, renderSource, type WeekSource } from "@/lib/reports/data";
import { buildInsights } from "@/lib/team/insights";
import { isOverdue } from "@/lib/milestones/types";
import { milestonesInRange } from "@/lib/milestones/queries";

export type MeetingSource = {
  lastWeek: WeekSource;
  thisWeek: WeekSource;
  attention: { name: string; flags: string[] }[];
  milestones: { title: string; status: string; progress: number; dueDate: string; owner?: string; overdue: boolean }[];
};

export function collectMeetingSource(teamId: number, weekStart: string): MeetingSource | null {
  const lastWeek = collectWeekSource(teamId, addDays(weekStart, -7));
  const thisWeek = collectWeekSource(teamId, weekStart);
  if (!lastWeek || !thisWeek) return null;
  const members = allMembers().filter((m) => m.teamId === teamId);
  const today = todayKey();
  const { insights } = buildInsights(members, -1);
  const nameOf = new Map(members.map((m) => [m.id, m.name]));
  const milestones = milestonesInRange(addDays(weekStart, -365), addDays(weekStart, 365))
    .filter((m) => m.teamId === teamId && (m.status !== "done" || m.dueDate >= addDays(weekStart, -14)))
    .map((m) => ({ title: m.title, status: m.status, progress: m.progress, dueDate: m.dueDate, owner: m.ownerId != null ? nameOf.get(m.ownerId) : undefined, overdue: isOverdue(m, today) }));
  return {
    lastWeek,
    thisWeek,
    attention: insights.filter((i) => i.attention.length).map((i) => ({ name: i.member.name, flags: i.attention.map((a) => a.label) })),
    milestones,
  };
}

export function renderMeetingSource(src: MeetingSource, topics: string): string {
  const lines: string[] = [];
  lines.push(`팀 이름: ${src.thisWeek.team.name}`);
  lines.push(`회의 주간: ${src.thisWeek.period}`);
  lines.push(`지난주: ${src.lastWeek.period}`);
  lines.push("");
  lines.push("# 팀장이 정한 회의 주제");
  lines.push(topics.trim() ? topics.trim() : "(없음)");
  lines.push("");
  lines.push(`# 지난주 기록 (${src.lastWeek.period})`);
  lines.push(renderSource(src.lastWeek).split("\n").slice(3).join("\n"));
  lines.push("");
  lines.push(`# 이번주 기록 (${src.thisWeek.period}, 진행 중)`);
  lines.push(renderSource(src.thisWeek).split("\n").slice(3).join("\n"));
  lines.push("");
  lines.push("# 팀 마일스톤 현황");
  if (src.milestones.length === 0) lines.push("(없음)");
  for (const m of src.milestones) lines.push(`- ${m.title} · ${m.status} ${m.progress}% · 마감 ${m.dueDate}${m.owner ? ` · 담당 ${m.owner}` : ""}${m.overdue ? " · ⚠ 마감 지남" : ""}`);
  lines.push("");
  lines.push("# 주의 신호 (시스템 감지)");
  if (src.attention.length === 0) lines.push("(없음)");
  for (const a of src.attention) lines.push(`- ${a.name}: ${a.flags.join(", ")}`);
  return lines.join("\n");
}

export function meetingPeriodLabel(weekStart: string) {
  return `${formatKoDate(weekStart)} ~ ${formatKoDate(addDays(weekStart, 6))}`;
}
