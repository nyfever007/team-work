import "server-only";
import { and, desc, eq, inArray, isNull } from "drizzle-orm";
import { addDays, weekStartOf } from "@/lib/dates";
import { db, schema } from "@/lib/db";
import type { MemberReview } from "@/lib/db/schema";
import { loadHolidays, weekInfo } from "@/lib/workdays";

export function memberReviewFor(memberId: number, weekStart: string): MemberReview | undefined {
  return db.select().from(schema.memberReviews).where(and(eq(schema.memberReviews.memberId, memberId), eq(schema.memberReviews.weekStart, weekStart))).get();
}

export function memberReviewsForWeek(memberIds: number[], weekStart: string): MemberReview[] {
  if (memberIds.length === 0) return [];
  return db.select().from(schema.memberReviews).where(and(inArray(schema.memberReviews.memberId, memberIds), eq(schema.memberReviews.weekStart, weekStart))).all();
}

/** Shared reviews for one member, newest week first. */
export function sharedReviewsFor(memberId: number, limit = 12): MemberReview[] {
  return db
    .select()
    .from(schema.memberReviews)
    .where(and(eq(schema.memberReviews.memberId, memberId), eq(schema.memberReviews.status, "shared")))
    .orderBy(desc(schema.memberReviews.weekStart))
    .limit(limit)
    .all();
}

/** Shared reviews the member has not marked as read yet. */
export function unreadReviewCount(memberId: number): number {
  return db
    .select({ id: schema.memberReviews.id })
    .from(schema.memberReviews)
    .where(and(eq(schema.memberReviews.memberId, memberId), eq(schema.memberReviews.status, "shared"), isNull(schema.memberReviews.ackAt)))
    .all().length;
}

/**
 * The week a leader is expected to review "now": this week from its last working day
 * (reviews happen at the end of the week), otherwise last week (catch-up on Monday–Thursday).
 */
export function defaultReviewWeek(today: string): string {
  const thisWeek = weekStartOf(today);
  const week = weekInfo(thisWeek, loadHolidays(thisWeek, addDays(thisWeek, 6)));
  const last = week.lastWorkingDay ?? addDays(thisWeek, 4);
  return today >= last ? thisWeek : addDays(thisWeek, -7);
}
