import "server-only";
import { and, asc, eq, inArray } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import type { GrowthGoal } from "@/lib/db/schema";

export type { GrowthGoal };

/** A member's goals for the given quarters ("2026-Q3"), ordered by quarter then position. */
export function growthGoalsFor(memberId: number, quarters: string[]): GrowthGoal[] {
  if (quarters.length === 0) return [];
  return db
    .select()
    .from(schema.growthGoals)
    .where(and(eq(schema.growthGoals.memberId, memberId), inArray(schema.growthGoals.quarter, quarters)))
    .orderBy(asc(schema.growthGoals.quarter), asc(schema.growthGoals.position), asc(schema.growthGoals.id))
    .all();
}

export function growthGoalById(id: number): GrowthGoal | undefined {
  return db.select().from(schema.growthGoals).where(eq(schema.growthGoals.id, id)).get();
}
