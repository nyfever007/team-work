"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth/dal";
import { todayKey } from "@/lib/dates";
import { db, schema } from "@/lib/db";
import { memberById } from "@/lib/members/queries";
import { reviewerContext } from "@/lib/reviews/queries";
import { chatCompletion } from "@/lib/reports/openai";
import { renderEvaluationSource } from "./data";
import { EVALUATION_SYSTEM_PROMPT, evaluationUserPrompt, parseEvaluation } from "./prompt";
import { evaluationFor, evaluationReference } from "./queries";
import { CRITERIA, EVALUATION_STATUSES, MAX_SCORE, isPeriod, periodLabel, periodRange, totalScore, type EvaluationInput, type EvaluationStatus, type Reasons, type Scores } from "./types";

export type EvaluationResult = { ok: true; message: string } | { ok: false; error: string };
export type EvaluationDraftResult = { ok: true; draft: EvaluationInput; model: string } | { ok: false; error: string };

async function evaluatorFor(memberId: number) {
  const user = await requireUser();
  const target = memberById(memberId);
  if (!target) throw new Error("구성원을 찾을 수 없습니다.");
  if (!reviewerContext(user).canReview(target)) throw new Error("이 구성원을 평가할 권한이 없습니다.");
  return { user, target };
}

/**
 * AI scores every criterion with a 근거 from the period's daily/weekly records. Returns the draft to the form;
 * nothing is saved until the leader saves (the model name is stored then).
 */
export async function generateEvaluationDraft(memberId: number, period: string, instructions?: string): Promise<EvaluationDraftResult> {
  try {
    const { target } = await evaluatorFor(memberId);
    if (!isPeriod(period)) return { ok: false, error: "평가 기간이 올바르지 않습니다." };
    const ref = evaluationReference(target, period);
    if (ref.tasksTotal + ref.itemsTotal === 0) return { ok: false, error: "이 기간에 일일·주간 기록이 없어 AI 채점을 할 수 없습니다." };
    const { content, model } = await chatCompletion(
      [
        { role: "system", content: EVALUATION_SYSTEM_PROMPT },
        { role: "user", content: evaluationUserPrompt(renderEvaluationSource(target, period, ref), instructions?.slice(0, 300)) },
      ],
      { maxTokens: 2000, json: true },
    );
    return { ok: true, draft: parseEvaluation(content), model };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "AI 채점에 실패했습니다." };
  }
}

/**
 * Save the 인사평가 for (member, period). Same rule as reviews: admin, or the member's team leader (never self).
 * `final` requires every criterion to be scored; saving a final evaluation as draft reopens it.
 */
export async function saveEvaluation(memberId: number, period: string, input: EvaluationInput, status: EvaluationStatus, aiModel?: string | null): Promise<EvaluationResult> {
  try {
    const { user } = await evaluatorFor(memberId);
    if (!isPeriod(period)) return { ok: false, error: "평가 기간이 올바르지 않습니다." };
    if (periodRange(period).start > todayKey()) return { ok: false, error: "아직 시작하지 않은 분기는 평가할 수 없습니다." };
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

    const now = new Date();
    const values = { scores, reasons, total: totalScore(scores), summary, strengths, improvements, status, evaluatorId: user.id, evaluatorName: user.name, finalizedAt: status === "final" ? now : null, updatedAt: now, ...(aiModel ? { aiModel, aiGeneratedAt: now } : {}) };
    const existing = evaluationFor(memberId, period);
    if (existing) db.update(schema.memberEvaluations).set(values).where(eq(schema.memberEvaluations.id, existing.id)).run();
    else db.insert(schema.memberEvaluations).values({ memberId, period, ...values }).run();

    revalidatePath(`/team/members/${memberId}`);
    revalidatePath("/team/members");
    return { ok: true, message: status === "final" ? `${periodLabel(period)} 평가를 확정했습니다.` : existing?.status === "final" ? "확정을 해제하고 임시 저장했습니다." : "임시 저장했습니다." };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "저장에 실패했습니다." };
  }
}
