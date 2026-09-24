import "server-only";
import { and, eq, gte, lte } from "drizzle-orm";
import { addDays, weekStartOf } from "@/lib/dates";
import { db, schema } from "@/lib/db";
import { LEAVE_LABEL } from "@/lib/leaves/types";
import { collectMemberWeek } from "@/lib/member-reviews/data";
import { RATING_LABEL, isRating } from "@/lib/member-reviews/types";
import type { Member } from "@/lib/members/types";
import { STATUS_LABEL } from "@/lib/milestones/types";
import { TASK_STATUS_LABEL } from "@/lib/tasks/types";
import type { EvaluationReference } from "./queries";
import { periodLabel } from "./types";

const cut = (s: string, n: number) => {
  const t = s.replace(/\s+/g, " ").trim();
  return t.length > n ? `${t.slice(0, n)}…` : t;
};
const md = (key: string) => key.slice(5).replace("-", "/");

/**
 * Compact week-by-week digest of the member's own records for the AI (and shown to the leader as 참고 자료).
 * Capped per week so a quarter (~13 weeks) stays within a few thousand tokens.
 */
export function renderEvaluationSource(member: Member, period: string, ref: EvaluationReference): string {
  const pct = (a: number, b: number) => (b ? `${Math.round((a / b) * 100)}%` : "—");
  const lines: string[] = [];
  lines.push(`구성원: ${member.name} (${member.team} · ${member.position}${member.rank ? ` · ${member.rank}` : ""}, 입사 ${member.joinedAt})`);
  lines.push(`평가 기간: ${periodLabel(period)} (${ref.from} ~ ${ref.to})`);
  lines.push(`기간 요약: 근무일 ${ref.workDays}일 · 목표 작성 ${ref.plannedDays}일(${pct(ref.plannedDays, ref.workDays)}) · 퇴근 정리 ${ref.wrapDays}일(${pct(ref.wrapDays, ref.workDays)}) · 일일 목표 완료 ${ref.tasksDone}/${ref.tasksTotal}(${pct(ref.tasksDone, ref.tasksTotal)}) · 주간 항목 완료 ${ref.itemsDone}/${ref.itemsTotal}(${pct(ref.itemsDone, ref.itemsTotal)})`);
  lines.push(`휴가·근태: 연차 ${ref.annualUsed}일 · 병가 ${ref.sickDays}일 · 조퇴 ${ref.earlyLeaves}회${ref.otherLeaveDays ? ` · 기타 휴가 ${ref.otherLeaveDays}일` : ""} · 주간 리뷰 평균 ${ref.reviewAvg != null ? `${ref.reviewAvg}/5 (${ref.reviewCount}회)` : "없음"}`);
  lines.push("");

  const reviews = new Map(
    db
      .select()
      .from(schema.memberReviews)
      .where(and(eq(schema.memberReviews.memberId, member.id), eq(schema.memberReviews.status, "shared"), gte(schema.memberReviews.weekStart, weekStartOf(ref.from)), lte(schema.memberReviews.weekStart, ref.to)))
      .all()
      .map((r) => [r.weekStart, r]),
  );
  const milestones = new Map<number, string>();

  for (let w = weekStartOf(ref.from); w <= ref.to; w = addDays(w, 7)) {
    const wk = collectMemberWeek(member, w);
    const s = wk.stats;
    for (const ms of wk.milestones) milestones.set(ms.id, `${ms.title} · ${STATUS_LABEL[ms.status]} ${ms.progress}% · 마감 ${ms.dueDate}${ms.overdue ? " · 지연" : ""}${ms.ownerId === member.id ? " · 담당" : ""}`);
    const review = reviews.get(w);
    lines.push(`## ${md(w)} 주 — 근무 ${s.workDays}일, 목표 작성 ${s.plannedDays}일, 퇴근 정리 ${s.wrapDays}일, 목표 완료 ${s.tasksDone}/${s.tasksTotal}`);
    if (!wk.items.length && !wk.tasks.length && !wk.extras.length && !wk.result) {
      lines.push(wk.leaves.length ? `(휴가: ${wk.leaves.map((l) => `${md(l.date)} ${LEAVE_LABEL[l.type]}`).join(", ")})` : "(기록 없음)");
      lines.push("");
      continue;
    }
    if (wk.leaves.length) lines.push(`휴가: ${wk.leaves.map((l) => `${md(l.date)} ${LEAVE_LABEL[l.type]}`).join(", ")}`);
    if (wk.items.length) lines.push(`주간 항목: ${wk.items.map((i) => `[${TASK_STATUS_LABEL[i.status]}] ${cut(i.title, 50)}${i.assignedBy != null ? "(팀장 지정)" : ""}`).join("; ")}`);
    const done = [...new Set(wk.tasks.filter((t) => t.status === "done").map((t) => cut(t.title, 40)))];
    if (done.length) lines.push(`완료한 일: ${done.slice(0, 12).join("; ")}${done.length > 12 ? ` 외 ${done.length - 12}건` : ""}`);
    const open = [...new Set(wk.tasks.filter((t) => t.status !== "done").map((t) => cut(t.title, 40)))];
    if (open.length) lines.push(`미완료/진행 중: ${open.length}건 (예: ${open.slice(0, 3).join("; ")})`);
    for (const e of wk.extras.slice(0, 3)) lines.push(`추가로 한 일 ${md(e.date)}: ${cut(e.text, 120)}`);
    if (wk.result) lines.push(`본인 주간 성과: ${cut(wk.result, 300)}`);
    if (review) lines.push(`주간 리뷰${isRating(review.rating) ? ` (성과 수준 ${review.rating}/5 ${RATING_LABEL[review.rating]})` : ""}: ${cut(review.summary, 200)}${review.improvements ? ` / 보완: ${cut(review.improvements, 120)}` : ""}`);
    for (const c of wk.dailyReviews.slice(0, 2)) lines.push(`팀장 코멘트 ${md(c.date)}: ${cut(c.comment, 100)}`);
    lines.push("");
  }

  if (milestones.size) {
    lines.push("## 관련 마일스톤");
    for (const m of milestones.values()) lines.push(`- ${m}`);
  }
  return lines.join("\n").trim();
}
