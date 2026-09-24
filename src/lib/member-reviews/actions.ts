"use server";

import { and, eq, max } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { requireMember, requireUser } from "@/lib/auth/dal";
import { addDays, isValidKey, weekStartOf } from "@/lib/dates";
import { db, schema } from "@/lib/db";
import { memberById } from "@/lib/members/queries";
import { chatCompletion } from "@/lib/reports/openai";
import { reviewerContext } from "@/lib/reviews/queries";
import { collectMemberWeek, hasRecords, renderMemberWeek } from "./data";
import { MEMBER_REVIEW_SYSTEM_PROMPT, memberReviewUserPrompt, parseMemberReview } from "./prompt";
import { memberReviewFor } from "./queries";
import { actionLines, isRating, type MemberReviewInput } from "./types";

export type DraftResult = { ok: true; draft: MemberReviewInput; model: string } | { ok: false; error: string };
export type SaveResult = { ok: true; message: string; assigned: number } | { ok: false; error: string };
export type SimpleResult = { ok: true; message: string } | { ok: false; error: string };

const validWeek = (w: string) => isValidKey(w) && weekStartOf(w) === w;
const err = (e: unknown, fallback: string) => ({ ok: false as const, error: e instanceof Error ? e.message : fallback });

function revalidate() {
  // Header badges live in the (app) layout, so refresh the whole tree.
  revalidatePath("/", "layout");
}

/** Admin, or the member's team leader (never self). Same rule as daily reviews. */
async function reviewerFor(memberId: number) {
  const user = await requireUser();
  const target = memberById(memberId);
  if (!target) throw new Error("구성원을 찾을 수 없습니다.");
  if (!reviewerContext(user).canReview(target)) throw new Error("이 구성원을 리뷰할 권한이 없습니다.");
  return { user, target };
}

export async function generateMemberReview(memberId: number, weekStart: string, instructions?: string): Promise<DraftResult> {
  try {
    const { target } = await reviewerFor(memberId);
    if (!validWeek(weekStart)) return { ok: false, error: "주차가 올바르지 않습니다." };
    const week = collectMemberWeek(target, weekStart);
    if (!hasRecords(week)) return { ok: false, error: "이 주에 구성원 기록이 없어 AI 초안을 만들 수 없습니다." };
    const { content, model } = await chatCompletion(
      [
        { role: "system", content: MEMBER_REVIEW_SYSTEM_PROMPT },
        { role: "user", content: memberReviewUserPrompt(renderMemberWeek(week), instructions?.slice(0, 300)) },
      ],
      { maxTokens: 1200, json: true },
    );
    return { ok: true, draft: parseMemberReview(content), model };
  } catch (e) {
    return err(e, "AI 초안 생성에 실패했습니다.");
  }
}

function clean(input: MemberReviewInput): MemberReviewInput {
  const t = (s: unknown, n: number) => String(s ?? "").replace(/\r\n/g, "\n").trim().slice(0, n);
  return {
    summary: t(input.summary, 3000),
    strengths: t(input.strengths, 3000),
    improvements: t(input.improvements, 3000),
    nextActions: actionLines(t(input.nextActions, 3000)).slice(0, 10).map((l) => l.slice(0, 200)).join("\n"),
    rating: isRating(input.rating) ? input.rating : null,
  };
}

/**
 * Save the leader's review. `share` makes it visible to the member; `assignNext` (with share)
 * also adds each "다음 주 할 일" line to the member's next week as a leader-assigned item.
 */
export async function saveMemberReview(memberId: number, weekStart: string, input: MemberReviewInput, opts: { share: boolean; assignNext?: boolean; model?: string | null }): Promise<SaveResult> {
  try {
    const { user } = await reviewerFor(memberId);
    if (!validWeek(weekStart)) return { ok: false, error: "주차가 올바르지 않습니다." };
    const v = clean(input);
    const empty = !v.summary && !v.strengths && !v.improvements && !v.nextActions;
    if (opts.share && empty) return { ok: false, error: "내용이 비어 있어 공유할 수 없습니다." };

    const existing = memberReviewFor(memberId, weekStart);
    const now = new Date();
    const changed = !existing || existing.summary !== v.summary || existing.strengths !== v.strengths || existing.improvements !== v.improvements || existing.nextActions !== v.nextActions || existing.rating !== v.rating;
    const patch = {
      ...v,
      reviewerId: user.id,
      reviewerName: user.name,
      status: opts.share ? ("shared" as const) : ("draft" as const),
      sharedAt: opts.share ? (changed || !existing?.sharedAt ? now : existing.sharedAt) : null,
      // Re-sharing edited content asks the member to read it again.
      ackAt: opts.share && !changed ? (existing?.ackAt ?? null) : null,
      updatedAt: now,
      ...(opts.model ? { model: opts.model, generatedAt: now } : {}),
    };

    let assigned = 0;
    db.transaction((tx) => {
      if (existing) tx.update(schema.memberReviews).set(patch).where(eq(schema.memberReviews.id, existing.id)).run();
      else tx.insert(schema.memberReviews).values({ memberId, weekStart, ...patch }).run();

      if (opts.share && opts.assignNext) {
        const next = addDays(weekStart, 7);
        const have = new Set(tx.select({ title: schema.weeklyItems.title }).from(schema.weeklyItems).where(and(eq(schema.weeklyItems.memberId, memberId), eq(schema.weeklyItems.weekStart, next))).all().map((r) => r.title));
        const row = tx.select({ maxPos: max(schema.weeklyItems.position) }).from(schema.weeklyItems).where(and(eq(schema.weeklyItems.memberId, memberId), eq(schema.weeklyItems.weekStart, next))).get();
        let pos = row?.maxPos ?? 0;
        for (const title of actionLines(v.nextActions)) {
          if (have.has(title)) continue;
          tx.insert(schema.weeklyItems).values({ memberId, weekStart: next, title, assignedBy: user.id, assignedByName: user.name, position: ++pos }).run();
          have.add(title);
          assigned++;
        }
      }
    });

    revalidate();
    const message = opts.share ? `리뷰를 공유했습니다.${assigned ? ` 다음 주 할 일 ${assigned}개를 지정했습니다.` : ""}` : existing?.status === "shared" ? "공유를 취소하고 초안으로 저장했습니다." : "초안을 저장했습니다.";
    return { ok: true, message, assigned };
  } catch (e) {
    return err(e, "저장에 실패했습니다.");
  }
}

async function ownSharedReview(id: number) {
  const { memberId } = await requireMember();
  const review = db.select().from(schema.memberReviews).where(eq(schema.memberReviews.id, id)).get();
  if (!review || review.memberId !== memberId || review.status !== "shared") throw new Error("리뷰를 찾을 수 없습니다.");
  return review;
}

export async function acknowledgeMemberReview(id: number): Promise<SimpleResult> {
  try {
    const review = await ownSharedReview(id);
    if (!review.ackAt) db.update(schema.memberReviews).set({ ackAt: new Date() }).where(eq(schema.memberReviews.id, id)).run();
    revalidate();
    return { ok: true, message: "확인했습니다." };
  } catch (e) {
    return err(e, "처리에 실패했습니다.");
  }
}

export async function replyToMemberReview(id: number, reply: string): Promise<SimpleResult> {
  try {
    const review = await ownSharedReview(id);
    const text = reply.replace(/\r\n/g, "\n").trim();
    if (text.length > 2000) return { ok: false, error: "2000자 이내로 입력하세요." };
    const now = new Date();
    db.update(schema.memberReviews)
      .set({ reply: text, repliedAt: text ? now : null, ackAt: review.ackAt ?? now })
      .where(eq(schema.memberReviews.id, id))
      .run();
    revalidate();
    return { ok: true, message: text ? "답글을 남겼습니다." : "답글을 삭제했습니다." };
  } catch (e) {
    return err(e, "저장에 실패했습니다.");
  }
}
