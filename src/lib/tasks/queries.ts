import "server-only";
import { and, asc, eq, gte, inArray, lte } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import type { DailyTask } from "@/lib/db/schema";

export function tasksFor(memberIds: number[], from: string, to: string): DailyTask[] {
  if (memberIds.length === 0) return [];
  return db
    .select()
    .from(schema.dailyTasks)
    .where(and(inArray(schema.dailyTasks.memberId, memberIds), gte(schema.dailyTasks.date, from), lte(schema.dailyTasks.date, to)))
    .orderBy(asc(schema.dailyTasks.date), asc(schema.dailyTasks.position), asc(schema.dailyTasks.id))
    .all();
}

export function myTasks(memberId: number, date: string): DailyTask[] {
  return db
    .select()
    .from(schema.dailyTasks)
    .where(and(eq(schema.dailyTasks.memberId, memberId), eq(schema.dailyTasks.date, date)))
    .orderBy(asc(schema.dailyTasks.position), asc(schema.dailyTasks.id))
    .all();
}

/** Group tasks by "memberId:date". */
export function groupTasks(tasks: DailyTask[]): Map<string, DailyTask[]> {
  const map = new Map<string, DailyTask[]>();
  for (const t of tasks) {
    const k = `${t.memberId}:${t.date}`;
    map.set(k, [...(map.get(k) ?? []), t]);
  }
  return map;
}
