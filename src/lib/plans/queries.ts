import "server-only";
import { and, asc, eq, gte, inArray, lte } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import type { DailyTask, MonthlyGoal, WeeklyItem } from "@/lib/db/schema";

export function weeklyItemsFor(memberIds: number[], weekStart: string): WeeklyItem[] {
  if (memberIds.length === 0) return [];
  return db
    .select()
    .from(schema.weeklyItems)
    .where(and(inArray(schema.weeklyItems.memberId, memberIds), eq(schema.weeklyItems.weekStart, weekStart)))
    .orderBy(asc(schema.weeklyItems.position), asc(schema.weeklyItems.id))
    .all();
}

export function weeklyItemsInRange(memberIds: number[], fromWeek: string, toWeek: string): WeeklyItem[] {
  if (memberIds.length === 0) return [];
  return db
    .select()
    .from(schema.weeklyItems)
    .where(and(inArray(schema.weeklyItems.memberId, memberIds), gte(schema.weeklyItems.weekStart, fromWeek), lte(schema.weeklyItems.weekStart, toWeek)))
    .orderBy(asc(schema.weeklyItems.weekStart), asc(schema.weeklyItems.position))
    .all();
}

export function monthlyGoalsFor(memberIds: number[], month: string): MonthlyGoal[] {
  if (memberIds.length === 0) return [];
  return db
    .select()
    .from(schema.monthlyGoals)
    .where(and(inArray(schema.monthlyGoals.memberId, memberIds), eq(schema.monthlyGoals.month, month)))
    .orderBy(asc(schema.monthlyGoals.position), asc(schema.monthlyGoals.id))
    .all();
}

/** Weekly items across all members that point at a milestone (for the milestone detail). */
export function weeklyItemsForMilestone(milestoneId: number): WeeklyItem[] {
  return db.select().from(schema.weeklyItems).where(eq(schema.weeklyItems.milestoneId, milestoneId)).orderBy(asc(schema.weeklyItems.weekStart), asc(schema.weeklyItems.memberId)).all();
}

export function monthlyGoalsForMilestone(milestoneId: number): MonthlyGoal[] {
  return db.select().from(schema.monthlyGoals).where(eq(schema.monthlyGoals.milestoneId, milestoneId)).orderBy(asc(schema.monthlyGoals.month)).all();
}

/** Daily tasks linked to any of the given weekly items. */
export function tasksForWeeklyItems(itemIds: number[]): DailyTask[] {
  if (itemIds.length === 0) return [];
  return db.select().from(schema.dailyTasks).where(inArray(schema.dailyTasks.weeklyItemId, itemIds)).orderBy(asc(schema.dailyTasks.date)).all();
}

export function groupBy<T, K extends string | number>(rows: T[], key: (r: T) => K): Map<K, T[]> {
  const m = new Map<K, T[]>();
  for (const r of rows) m.set(key(r), [...(m.get(key(r)) ?? []), r]);
  return m;
}
