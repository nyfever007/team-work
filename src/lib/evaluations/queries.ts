import "server-only";
import { and, desc, eq, gte, lte } from "drizzle-orm";
import { addDays, todayKey, weekStartOf } from "@/lib/dates";
import { db, schema } from "@/lib/db";
import type { MemberEvaluation } from "@/lib/db/schema";
import { LEAVE_COST } from "@/lib/leaves/types";
import { collectMemberWeek } from "@/lib/member-reviews/data";
import type { Member } from "@/lib/members/types";
import { periodRange } from "./types";

export function evaluationFor(memberId: number, period: string): MemberEvaluation | undefined {
  return db.select().from(schema.memberEvaluations).where(and(eq(schema.memberEvaluations.memberId, memberId), eq(schema.memberEvaluations.period, period))).get();
}

export function evaluationsFor(memberId: number): MemberEvaluation[] {
  return db.select().from(schema.memberEvaluations).where(eq(schema.memberEvaluations.memberId, memberId)).orderBy(desc(schema.memberEvaluations.period)).all();
}

export type EvaluationReference = {
  from: string;
  to: string; // clipped to today
  workDays: number;
  plannedDays: number;
  wrapDays: number;
  tasksDone: number;
  tasksTotal: number;
  itemsDone: number;
  itemsTotal: number;
  reviewCount: number;
  reviewAvg: number | null; // average weekly review rating (1–5)
  annualUsed: number;
  sickDays: number;
  earlyLeaves: number;
  otherLeaveDays: number;
};

/** Facts from the member's own records in the period (up to today), shown next to the scores. */
export function evaluationReference(member: Member, period: string): EvaluationReference {
  const { start, end } = periodRange(period);
  const today = todayKey();
  const to = end < today ? end : today;
  const ref: EvaluationReference = { from: start, to, workDays: 0, plannedDays: 0, wrapDays: 0, tasksDone: 0, tasksTotal: 0, itemsDone: 0, itemsTotal: 0, reviewCount: 0, reviewAvg: null, annualUsed: 0, sickDays: 0, earlyLeaves: 0, otherLeaveDays: 0 };
  if (to < start) return ref;

  // Weekly stats; the first/last week may straddle the period boundary — close enough for a reference.
  for (let w = weekStartOf(start); w <= to; w = addDays(w, 7)) {
    const s = collectMemberWeek(member, w).stats;
    ref.workDays += s.workDays;
    ref.plannedDays += s.plannedDays;
    ref.wrapDays += s.wrapDays;
    ref.tasksDone += s.tasksDone;
    ref.tasksTotal += s.tasksTotal;
    ref.itemsDone += s.itemsDone;
    ref.itemsTotal += s.itemsTotal;
  }
  const ratings = db
    .select({ rating: schema.memberReviews.rating })
    .from(schema.memberReviews)
    .where(and(eq(schema.memberReviews.memberId, member.id), eq(schema.memberReviews.status, "shared"), gte(schema.memberReviews.weekStart, weekStartOf(start)), lte(schema.memberReviews.weekStart, to)))
    .all()
    .map((r) => r.rating)
    .filter((r): r is number => r != null);
  ref.reviewCount = ratings.length;
  ref.reviewAvg = ratings.length ? Math.round((ratings.reduce((a, b) => a + b, 0) / ratings.length) * 10) / 10 : null;

  for (const l of db.select({ type: schema.leaves.type }).from(schema.leaves).where(and(eq(schema.leaves.memberId, member.id), gte(schema.leaves.date, start), lte(schema.leaves.date, to))).all()) {
    if (l.type === "sick") ref.sickDays += 1;
    else if (l.type === "early_leave") ref.earlyLeaves += 1;
    else if (LEAVE_COST[l.type] > 0) ref.annualUsed += LEAVE_COST[l.type];
    else ref.otherLeaveDays += 1;
  }
  return ref;
}
