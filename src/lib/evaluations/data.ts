import "server-only";
import { and, eq, gte, lte } from "drizzle-orm";
import { addDays, weekStartOf } from "@/lib/dates";
import { db, schema } from "@/lib/db";
import { LEAVE_LABEL } from "@/lib/leaves/types";
import { collectMemberWeek, renderMemberWeek } from "@/lib/member-reviews/data";
import { memberReviewFor } from "@/lib/member-reviews/queries";
import { RATING_LABEL, isRating } from "@/lib/member-reviews/types";
import type { Member } from "@/lib/members/types";
import { STATUS_LABEL } from "@/lib/milestones/types";
import { TASK_STATUS_LABEL } from "@/lib/tasks/types";
import { contributionFor, topPostsFor } from "@/lib/board/queries";
import { POST_CATEGORY_LABEL } from "@/lib/board/types";
import { growthGoalsFor } from "@/lib/growth/queries";
import { GROWTH_STATUS_LABEL } from "@/lib/growth/types";
import { oneOnOnesFor } from "@/lib/one-on-one/queries";
import { childEvaluations, evaluationReference, quartersBetween, type EvaluationReference } from "./queries";
import { CRITERIA, LEVEL_LABEL, childLevel, gradeOf, levelOf, periodLabel, type EvalLevel } from "./types";

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
  lines.push(`기간 요약: 근무일 ${ref.workDays}일 · 목표 작성 ${ref.plannedDays}일(${pct(ref.plannedDays, ref.workDays)}) · 퇴근 정리 ${ref.wrapDays}일(${pct(ref.wrapDays, ref.workDays)}) · 일일 목표 완료 ${ref.tasksDone}/${ref.tasksTotal}(${pct(ref.tasksDone, ref.tasksTotal)}) · 주간 보고 작성 ${ref.reportedWeeks}/${ref.weeks}주`);
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
    lines.push("");
  }

  if (milestones.size) {
    lines.push("## 관련 마일스톤");
    for (const m of milestones.values()) lines.push(`- ${m}`);
  }
  const life = teamLifeSource(member, ref.from, ref.to);
  if (life) lines.push("", life);
  return lines.join("\n").trim();
}

/**
 * 협업·성장 기록 for [from, to]: 게시판 공유 기여 (other teammates' reactions), 1:1 notes/actions (incl. the leader's
 * private memo — evaluations are leader-only) and the quarter's 성장 계획. Returns null when there is nothing.
 */
function teamLifeSource(member: Member, from: string, to: string): string | null {
  const lines: string[] = [];
  const c = contributionFor([member.id], from, to).get(member.id);
  if (c && (c.posts || c.points)) {
    const top = topPostsFor(member.teamId, from, to, 50).filter((p) => p.authorMemberId === member.id).slice(0, 3);
    lines.push(`게시판 공유 기여: 글 ${c.posts}개 · 도움됐어요 ${c.helpful} · 저장 ${c.saved} · 써봤어요 ${c.tried} · 답변 채택 ${c.accepted} · 기여 ${c.points}점${top.length ? ` (반응 많은 글: ${top.map((p) => `[${POST_CATEGORY_LABEL[p.category]}] ${cut(p.title, 40)}`).join("; ")})` : ""}`);
  }
  for (const m of oneOnOnesFor(member.id, from, to).slice(0, 4)) {
    const acts = m.actions.map((a) => `${a.doneAt ? "완료" : "미완료"}: ${cut(a.title, 40)}`).join("; ");
    const body = [m.notes && `합의: ${cut(m.notes, 160)}`, m.privateNotes && `팀장 메모: ${cut(m.privateNotes, 120)}`, acts && `후속 조치 ${acts}`].filter(Boolean).join(" / ");
    if (body) lines.push(`1:1 ${md(m.date)}: ${body}`);
  }
  for (const g of growthGoalsFor(member.id, quartersBetween(from, to)).slice(0, 4)) {
    lines.push(`성장 계획 ${g.quarter} [${GROWTH_STATUS_LABEL[g.status]}] ${cut(g.title, 60)}${g.reflection ? ` — 회고: ${cut(g.reflection, 120)}` : ""}${g.leaderComment ? ` — 팀장: ${cut(g.leaderComment, 80)}` : ""}`);
  }
  return lines.length ? ["## 협업 · 성장 기록", ...lines].join("\n") : null;
}

/** 주간: the week's records (renderMemberWeek) plus the leader's 주간 리뷰 for that week. */
function weekSource(member: Member, week: string): string | null {
  const wk = collectMemberWeek(member, week);
  const review = memberReviewFor(member.id, week);
  const hasReview = !!review && !!(review.summary || review.strengths || review.improvements || review.nextActions);
  if (!hasReview && !wk.items.length && !wk.tasks.length && !wk.extras.length && !wk.result) return null;
  const lines = [renderMemberWeek(wk)];
  const life = teamLifeSource(member, week, addDays(week, 6));
  if (life) lines.push("", life);
  if (hasReview) {
    lines.push("", `## 팀장 주간 리뷰 (${review.status === "shared" ? "공유됨" : "초안"})`);
    if (isRating(review.rating)) lines.push(`성과 수준: ${review.rating}/5 (${RATING_LABEL[review.rating]})`);
    if (review.summary) lines.push(`종합: ${review.summary}`);
    if (review.strengths) lines.push(`잘한 점: ${review.strengths.replace(/\n/g, " / ")}`);
    if (review.improvements) lines.push(`보완할 점: ${review.improvements.replace(/\n/g, " / ")}`);
    if (review.nextActions) lines.push(`다음 주 요청: ${review.nextActions.replace(/\n/g, " / ")}`);
  }
  return lines.join("\n");
}

/** 월간/분기/연간: the lower-level evaluations (scores, 근거, 의견) the leader already made. */
function childSource(member: Member, period: string, level: EvalLevel): string | null {
  const kids = childEvaluations(member.id, period);
  if (kids.length === 0) return null;
  const kidLabel = LEVEL_LABEL[childLevel(level)!];
  const lines: string[] = [];
  lines.push(`구성원: ${member.name} (${member.team} · ${member.position}${member.rank ? ` · ${member.rank}` : ""})`);
  lines.push(`평가 기간: ${periodLabel(period)} · 하위 ${kidLabel} 평가 ${kids.length}개 (확정 ${kids.filter((k) => k.status === "final").length}개)`);
  const ref = evaluationReference(member, period);
  lines.push(`기간 기록 요약: 목표 작성 ${ref.plannedDays}/${ref.workDays}일 · 목표 완료 ${ref.tasksDone}/${ref.tasksTotal} · 주간 보고 ${ref.reportedWeeks}/${ref.weeks}주 · 연차 ${ref.annualUsed}일 · 병가 ${ref.sickDays}일 · 조퇴 ${ref.earlyLeaves}회`);
  const life = teamLifeSource(member, ref.from, ref.to);
  if (life) lines.push("", life);
  lines.push("");
  for (const k of kids) {
    const g = gradeOf(k.total);
    lines.push(`## ${kidLabel} 평가 · ${periodLabel(k.period)} · ${k.status === "final" ? "확정" : "초안"} · 총점 ${k.total?.toFixed(1) ?? "—"}${g ? ` (${g.grade})` : ""}`);
    lines.push(CRITERIA.map((c) => `${c.label} ${k.scores[c.key] ?? "—"}`).join(" · "));
    for (const c of CRITERIA) if (k.reasons[c.key]) lines.push(`- ${c.label} 근거: ${cut(k.reasons[c.key]!, 160)}`);
    if (k.summary) lines.push(`종합: ${cut(k.summary, 300)}`);
    if (k.strengths) lines.push(`강점: ${cut(k.strengths, 200)}`);
    if (k.improvements) lines.push(`개선: ${cut(k.improvements, 200)}`);
    lines.push("");
  }
  return lines.join("\n").trim();
}

/**
 * AI source per level: week → records + 주간 리뷰; month/quarter → child evaluations (falls back to the raw record digest
 * when none exist yet); year → quarter evaluations only (a year of raw records is too long).
 */
export function buildEvaluationSource(member: Member, period: string): { source: string } | { error: string } {
  const level = levelOf(period);
  if (!level) return { error: "평가 기간이 올바르지 않습니다." };
  if (level === "week") {
    const src = weekSource(member, period);
    return src ? { source: src } : { error: "이 주에 기록이나 주간 리뷰가 없어 AI 평가를 만들 수 없습니다." };
  }
  const kids = childSource(member, period, level);
  if (kids) return { source: kids };
  if (level === "year") return { error: "분기 평가가 없어 연간 AI 평가를 만들 수 없습니다. 분기 평가를 먼저 작성하세요." };
  const ref = evaluationReference(member, period);
  if (ref.tasksTotal + ref.itemsTotal === 0) return { error: `이 기간에 기록이 없어 AI 평가를 만들 수 없습니다.` };
  return { source: `(하위 ${LEVEL_LABEL[childLevel(level)!]} 평가가 아직 없어 원본 기록으로 평가합니다)\n` + renderEvaluationSource(member, period, ref) };
}
