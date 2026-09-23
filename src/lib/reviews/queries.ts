import "server-only";
import { and, asc, gte, inArray, lte } from "drizzle-orm";
import type { SafeUser } from "@/lib/auth/session";
import { db, schema } from "@/lib/db";
import type { DailyReview } from "@/lib/db/schema";
import { memberById } from "@/lib/members/queries";

export function reviewsFor(memberIds: number[], from: string, to: string): DailyReview[] {
  if (memberIds.length === 0) return [];
  return db
    .select()
    .from(schema.dailyReviews)
    .where(and(inArray(schema.dailyReviews.memberId, memberIds), gte(schema.dailyReviews.date, from), lte(schema.dailyReviews.date, to)))
    .orderBy(asc(schema.dailyReviews.date), asc(schema.dailyReviews.createdAt))
    .all();
}

export function groupReviews(rows: DailyReview[]): Map<string, DailyReview[]> {
  const map = new Map<string, DailyReview[]>();
  for (const r of rows) {
    const k = `${r.memberId}:${r.date}`;
    map.set(k, [...(map.get(k) ?? []), r]);
  }
  return map;
}

export type ReviewerContext = {
  /** May write a review for this member. */
  canReview: (target: { id: number; teamId: number }) => boolean;
  /** May read reviews about this member. */
  canSee: (target: { id: number; teamId: number }) => boolean;
};

/** Admin: all. Team leader: own team (not self). Member: own reviews only. */
export function reviewerContext(user: SafeUser): ReviewerContext {
  if (user.role === "admin") return { canReview: () => true, canSee: () => true };
  const me = user.memberId != null ? memberById(user.memberId) : undefined;
  const leaderOf = me?.isLeader ? me.teamId : null;
  return {
    canReview: (t) => leaderOf !== null && t.teamId === leaderOf && t.id !== me?.id,
    canSee: (t) => t.id === me?.id || (leaderOf !== null && t.teamId === leaderOf),
  };
}
