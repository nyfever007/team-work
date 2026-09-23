"use server";

import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth/dal";
import { isValidKey } from "@/lib/dates";
import { db, schema } from "@/lib/db";
import { reviewerContext } from "./queries";

export type ReviewState = { ok: true; message: string; savedAt: number } | { ok: false; error: string } | undefined;

/** Upsert the caller's review for (member, date). Empty comment deletes it. */
export async function saveDailyReview(memberId: number, date: string, _prev: ReviewState, formData: FormData): Promise<ReviewState> {
  try {
    const user = await requireUser();
    if (!isValidKey(date)) return { ok: false, error: "날짜가 올바르지 않습니다." };
    const target = db.select().from(schema.members).where(eq(schema.members.id, memberId)).get();
    if (!target) return { ok: false, error: "구성원을 찾을 수 없습니다." };
    if (!reviewerContext(user).canReview(target)) return { ok: false, error: "이 구성원을 리뷰할 권한이 없습니다." };

    const comment = String(formData.get("comment") ?? "").replace(/\r\n/g, "\n").trim();
    if (comment.length > 2000) return { ok: false, error: "2000자 이내로 입력하세요." };

    const where = and(eq(schema.dailyReviews.memberId, memberId), eq(schema.dailyReviews.date, date), eq(schema.dailyReviews.reviewerId, user.id));
    const existing = db.select().from(schema.dailyReviews).where(where).get();
    const now = new Date();

    if (!comment) {
      if (existing) db.delete(schema.dailyReviews).where(eq(schema.dailyReviews.id, existing.id)).run();
      revalidate();
      return { ok: true, message: existing ? "리뷰를 삭제했습니다." : "저장할 내용이 없습니다.", savedAt: now.getTime() };
    }
    if (existing) {
      db.update(schema.dailyReviews).set({ comment, reviewerName: user.name, updatedAt: now }).where(eq(schema.dailyReviews.id, existing.id)).run();
    } else {
      db.insert(schema.dailyReviews).values({ memberId, date, reviewerId: user.id, reviewerName: user.name, comment }).run();
    }
    revalidate();
    return { ok: true, message: "리뷰를 저장했습니다.", savedAt: now.getTime() };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "저장에 실패했습니다." };
  }
}

function revalidate() {
  revalidatePath("/team");
  revalidatePath("/my/history");
  revalidatePath("/team");
  revalidatePath("/");
}
