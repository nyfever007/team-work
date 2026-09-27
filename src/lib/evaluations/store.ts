import "server-only";
import { eq } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import type { Member } from "@/lib/members/types";
import { chatCompletion } from "@/lib/reports/openai";
import { buildEvaluationSource } from "./data";
import { evaluationSystemPrompt, evaluationUserPrompt, parseEvaluation } from "./prompt";
import { evaluationFor } from "./queries";
import { levelOf, totalScore, type EvaluationInput, type EvaluationStatus } from "./types";

/** Ask the model for a draft of `period` (any level). Throws with a Korean message on failure. */
export async function draftEvaluation(member: Member, period: string, instructions?: string): Promise<{ draft: EvaluationInput; model: string }> {
  const level = levelOf(period);
  if (!level) throw new Error("평가 기간이 올바르지 않습니다.");
  const src = buildEvaluationSource(member, period);
  if ("error" in src) throw new Error(src.error);
  const { content, model } = await chatCompletion(
    [
      { role: "system", content: evaluationSystemPrompt(level) },
      { role: "user", content: evaluationUserPrompt(src.source, instructions?.slice(0, 300)) },
    ],
    { maxTokens: 2000, json: true },
  );
  return { draft: parseEvaluation(content), model };
}

/** Upsert an evaluation row (level derived from the period key). */
export function storeEvaluation(memberId: number, period: string, input: EvaluationInput, status: EvaluationStatus, evaluator: { id: number; name: string }, aiModel?: string | null) {
  const now = new Date();
  const level = levelOf(period)!;
  const values = {
    level,
    scores: input.scores,
    reasons: input.reasons,
    total: totalScore(input.scores),
    summary: input.summary,
    strengths: input.strengths,
    improvements: input.improvements,
    status,
    evaluatorId: evaluator.id,
    evaluatorName: evaluator.name,
    finalizedAt: status === "final" ? now : null,
    updatedAt: now,
    ...(aiModel ? { aiModel, aiGeneratedAt: now } : {}),
  };
  const existing = evaluationFor(memberId, period);
  if (existing) db.update(schema.memberEvaluations).set(values).where(eq(schema.memberEvaluations.id, existing.id)).run();
  else db.insert(schema.memberEvaluations).values({ memberId, period, ...values }).run();
}

/**
 * Background 주간 평가 after a weekly review is shared: creates an AI draft, or refreshes one that is still an untouched
 * AI draft. Never overwrites an evaluation the leader edited or finalized. Errors are swallowed (it's best-effort).
 */
export async function autoWeeklyEvaluation(member: Member, week: string, evaluator: { id: number; name: string }) {
  try {
    const existing = evaluationFor(member.id, week);
    const untouchedAi = existing && existing.status === "draft" && existing.aiGeneratedAt && Math.abs(existing.updatedAt.getTime() - existing.aiGeneratedAt.getTime()) < 2000;
    if (existing && !untouchedAi) return;
    const { draft, model } = await draftEvaluation(member, week);
    storeEvaluation(member.id, week, draft, "draft", evaluator, model);
  } catch {
    // Best-effort: the leader can still generate it from the review workspace.
  }
}
