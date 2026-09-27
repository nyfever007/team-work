"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth/dal";
import { todayKey } from "@/lib/dates";
import { db, schema } from "@/lib/db";
import { memberById } from "@/lib/members/queries";
import { openAIConfigured } from "@/lib/reports/openai";
import { reviewerContext } from "@/lib/reviews/queries";
import { evaluationFor } from "./queries";
import { draftEvaluation, storeEvaluation } from "./store";
import { CRITERIA, EVALUATION_STATUSES, GRADE_LETTERS, MAX_SCORE, isEvalPeriod, levelOf, periodLabel, periodRange, type EvaluationInput, type EvaluationStatus, type Grade, type Reasons, type Scores } from "./types";

export type EvaluationResult = { ok: true; message: string } | { ok: false; error: string };
export type EvaluationDraftResult = { ok: true; draft: EvaluationInput; model: string } | { ok: false; error: string };

async function evaluatorFor(memberId: number) {
  const user = await requireUser();
  const target = memberById(memberId);
  if (!target) throw new Error("구성원을 찾을 수 없습니다.");
  if (!reviewerContext(user).canReview(target)) throw new Error("이 구성원을 평가할 권한이 없습니다.");
  return { user, target };
}

/** AI draft for any level (주간 · 월간 · 분기 · 연간), from the level below. Returned to the form; nothing is saved. */
export async function generateEvaluationDraft(memberId: number, period: string, instructions?: string): Promise<EvaluationDraftResult> {
  try {
    const { target } = await evaluatorFor(memberId);
    if (!isEvalPeriod(period)) return { ok: false, error: "평가 기간이 올바르지 않습니다." };
    const { draft, model } = await draftEvaluation(target, period, instructions);
    return { ok: true, draft, model };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "AI 평가 생성에 실패했습니다." };
  }
}

/** Review workspace: (re)generate the private 주간 평가 and store it as a draft right away. */
export async function regenerateWeeklyEvaluation(memberId: number, week: string): Promise<EvaluationResult> {
  try {
    const { user, target } = await evaluatorFor(memberId);
    if (levelOf(week) !== "week") return { ok: false, error: "주차가 올바르지 않습니다." };
    if (!openAIConfigured()) return { ok: false, error: "OPENAI_API_KEY가 설정되지 않았습니다." };
    const existing = evaluationFor(memberId, week);
    if (existing?.status === "final") return { ok: false, error: "확정된 주간 평가입니다. 구성원 상세에서 확정을 해제한 뒤 다시 생성하세요." };
    const { draft, model } = await draftEvaluation(target, week);
    storeEvaluation(memberId, week, draft, "draft", user, model);
    revalidatePath("/team/reviews");
    revalidatePath(`/team/members/${memberId}`);
    return { ok: true, message: "주간 인사평가 초안을 만들었습니다. (구성원에게 공개되지 않습니다)" };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "AI 평가 생성에 실패했습니다." };
  }
}

/** 고과평가: leader's final grade on a quarter evaluation (null clears it). */
export async function setFinalGrade(memberId: number, quarter: string, grade: Grade | null): Promise<EvaluationResult> {
  try {
    await evaluatorFor(memberId);
    if (levelOf(quarter) !== "quarter") return { ok: false, error: "분기가 올바르지 않습니다." };
    if (grade != null && !GRADE_LETTERS.includes(grade)) return { ok: false, error: "등급이 올바르지 않습니다." };
    const ev = evaluationFor(memberId, quarter);
    if (!ev) return { ok: false, error: "먼저 분기 인사평가를 작성하세요." };
    db.update(schema.memberEvaluations).set({ finalGrade: grade, updatedAt: new Date() }).where(eq(schema.memberEvaluations.id, ev.id)).run();
    revalidatePath("/team/appraisal");
    revalidatePath(`/team/members/${memberId}`);
    return { ok: true, message: grade ? `최종 고과를 ${grade}로 정했습니다.` : "최종 고과를 지웠습니다." };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "저장에 실패했습니다." };
  }
}

/**
 * Save the 인사평가 for (member, period). Same rule as reviews: admin, or the member's team leader (never self).
 * `final` requires every criterion to be scored; saving a final evaluation as draft reopens it.
 */
export async function saveEvaluation(memberId: number, period: string, input: EvaluationInput, status: EvaluationStatus, aiModel?: string | null): Promise<EvaluationResult> {
  try {
    const { user } = await evaluatorFor(memberId);
    if (!isEvalPeriod(period)) return { ok: false, error: "평가 기간이 올바르지 않습니다." };
    if (periodRange(period).start > todayKey()) return { ok: false, error: "아직 시작하지 않은 기간은 평가할 수 없습니다." };
    if (!EVALUATION_STATUSES.includes(status)) return { ok: false, error: "상태가 올바르지 않습니다." };

    const scores: Scores = {};
    for (const c of CRITERIA) {
      const v = input.scores?.[c.key];
      if (v == null) continue;
      if (!Number.isInteger(v) || v < 1 || v > MAX_SCORE) return { ok: false, error: `${c.label} 점수는 1~${MAX_SCORE} 사이 정수여야 합니다.` };
      scores[c.key] = v;
    }
    const text = (s: unknown) => String(s ?? "").replace(/\r\n/g, "\n").trim().slice(0, 3000);
    const reasons: Reasons = {};
    for (const c of CRITERIA) {
      const r = text(input.reasons?.[c.key]).slice(0, 600);
      if (r) reasons[c.key] = r;
    }
    const summary = text(input.summary);
    const strengths = text(input.strengths);
    const improvements = text(input.improvements);
    if (status === "final") {
      const missing = CRITERIA.filter((c) => scores[c.key] == null).map((c) => c.label);
      if (missing.length) return { ok: false, error: `확정하려면 모든 항목을 채점하세요: ${missing.join(", ")}` };
      if (!summary) return { ok: false, error: "확정하려면 종합 의견을 입력하세요." };
    }

    const existing = evaluationFor(memberId, period);
    storeEvaluation(memberId, period, { scores, reasons, summary, strengths, improvements }, status, user, aiModel);

    revalidatePath(`/team/members/${memberId}`);
    revalidatePath("/team/members");
    revalidatePath("/team/appraisal");
    revalidatePath("/team/reviews");
    return { ok: true, message: status === "final" ? `${periodLabel(period)} 평가를 확정했습니다.` : existing?.status === "final" ? "확정을 해제하고 임시 저장했습니다." : "임시 저장했습니다." };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "저장에 실패했습니다." };
  }
}
