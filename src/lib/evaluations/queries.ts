import "server-only";
import { and, desc, eq, gte, inArray, lte } from "drizzle-orm";
import { addDays, todayKey, weekStartOf } from "@/lib/dates";
import { db, schema } from "@/lib/db";
import type { MemberEvaluation } from "@/lib/db/schema";
import { LEAVE_COST } from "@/lib/leaves/types";
import { collectMemberWeek } from "@/lib/member-reviews/data";
import type { Member } from "@/lib/members/types";
import { contributionFor, type Contribution } from "@/lib/board/queries";
import { oneOnOnesFor } from "@/lib/one-on-one/queries";
import { childPeriods, periodRange } from "./types";

export function evaluationFor(memberId: number, period: string): MemberEvaluation | undefined {
  return db.select().from(schema.memberEvaluations).where(and(eq(schema.memberEvaluations.memberId, memberId), eq(schema.memberEvaluations.period, period))).get();
}

export function evaluationsFor(memberId: number): MemberEvaluation[] {
  return db.select().from(schema.memberEvaluations).where(eq(schema.memberEvaluations.memberId, memberId)).orderBy(desc(schema.memberEvaluations.period)).all();
}

/** Saved evaluations for the periods one level below `period` (weeks of a month, months of a quarter, quarters of a year). */
export function childEvaluations(memberId: number, period: string): MemberEvaluation[] {
  const kids = childPeriods(period);
  if (kids.length === 0) return [];
  return db
    .select()
    .from(schema.memberEvaluations)
    .where(and(eq(schema.memberEvaluations.memberId, memberId), inArray(schema.memberEvaluations.period, kids)))
    .all()
    .sort((a, b) => a.period.localeCompare(b.period));
}

/** Evaluations of several members for one period (고과평가 table). */
export function evaluationsForPeriod(memberIds: number[], period: string): MemberEvaluation[] {
  if (memberIds.length === 0) return [];
  return db.select().from(schema.memberEvaluations).where(and(inArray(schema.memberEvaluations.memberId, memberIds), eq(schema.memberEvaluations.period, period))).all();
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
  /** Weeks in the period (up to today) and weeks with a written 주간 보고. */
  weeks: number;
  reportedWeeks: number;
  reviewCount: number;
  reviewAvg: number | null; // average weekly review rating (1–5)
  annualUsed: number;
  sickDays: number;
  earlyLeaves: number;
  otherLeaveDays: number;
  /** 게시판 공유 기여 (reactions from other teammates; see lib/board/queries `contributionFor`). */
  shares: Contribution;
  /** 1:1 미팅 held in the period and follow-up actions from them. */
  oneOnOnes: number;
  actionsDone: number;
  actionsTotal: number;
  /** 성장 계획 goals of the quarters overlapping the period. */
  growthGoals: number;
  growthDone: number;
};

/** Quarter keys ("2026-Q3") overlapping [from, to]. */
export function quartersBetween(from: string, to: string): string[] {
  const q = (key: string) => `${key.slice(0, 4)}-Q${Math.floor((Number(key.slice(5, 7)) - 1) / 3) + 1}`;
  const out: string[] = [];
  for (let k = from; k <= to; ) {
    const key = q(k);
    if (!out.includes(key)) out.push(key);
    const y = Number(k.slice(0, 4));
    const nextQ = Math.floor((Number(k.slice(5, 7)) - 1) / 3) + 1;
    k = nextQ === 4 ? `${y + 1}-01-01` : `${y}-${String(nextQ * 3 + 1).padStart(2, "0")}-01`;
  }
  return out;
}

/** Facts from the member's own records in the period (up to today), shown next to the scores. */
export function evaluationReference(member: Member, period: string): EvaluationReference {
  const { start, end } = periodRange(period);
  const today = todayKey();
  const to = end < today ? end : today;
  const ref: EvaluationReference = { from: start, to, workDays: 0, plannedDays: 0, wrapDays: 0, tasksDone: 0, tasksTotal: 0, itemsDone: 0, itemsTotal: 0, weeks: 0, reportedWeeks: 0, reviewCount: 0, reviewAvg: null, annualUsed: 0, sickDays: 0, earlyLeaves: 0, otherLeaveDays: 0, shares: { posts: 0, helpful: 0, saved: 0, tried: 0, accepted: 0, points: 0 }, oneOnOnes: 0, actionsDone: 0, actionsTotal: 0, growthGoals: 0, growthDone: 0 };
  if (to < start) return ref;

  // Weekly stats; the first/last week may straddle the period boundary — close enough for a reference.
  for (let w = weekStartOf(start); w <= to; w = addDays(w, 7)) {
    const wk = collectMemberWeek(member, w);
    const s = wk.stats;
    ref.weeks += 1;
    if (wk.result) ref.reportedWeeks += 1;
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

  ref.shares = contributionFor([member.id], start, to).get(member.id) ?? ref.shares;
  const meetings = oneOnOnesFor(member.id, start, to).filter((m) => m.status === "done" || m.date <= today);
  ref.oneOnOnes = meetings.length;
  for (const m of meetings) {
    ref.actionsTotal += m.actions.length;
    ref.actionsDone += m.actions.filter((a) => a.doneAt).length;
  }
  const goals = db.select({ status: schema.growthGoals.status }).from(schema.growthGoals).where(and(eq(schema.growthGoals.memberId, member.id), inArray(schema.growthGoals.quarter, quartersBetween(start, to)))).all();
  ref.growthGoals = goals.filter((g) => g.status !== "dropped").length;
  ref.growthDone = goals.filter((g) => g.status === "done").length;
  return ref;
}
