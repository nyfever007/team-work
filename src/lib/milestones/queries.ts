import "server-only";
import { and, asc, desc, eq, gte, lte } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import type { MilestoneRow } from "./types";

const rowSelect = {
  id: schema.milestones.id,
  teamId: schema.milestones.teamId,
  title: schema.milestones.title,
  description: schema.milestones.description,
  startDate: schema.milestones.startDate,
  dueDate: schema.milestones.dueDate,
  status: schema.milestones.status,
  progress: schema.milestones.progress,
  ownerId: schema.milestones.ownerId,
  createdBy: schema.milestones.createdBy,
  createdAt: schema.milestones.createdAt,
  updatedAt: schema.milestones.updatedAt,
  team: schema.teams.name,
};

/** Milestones overlapping [from, to] (inclusive), with team name. */
export function milestonesInRange(from: string, to: string): MilestoneRow[] {
  return db
    .select(rowSelect)
    .from(schema.milestones)
    .innerJoin(schema.teams, eq(schema.teams.id, schema.milestones.teamId))
    .where(and(lte(schema.milestones.startDate, to), gte(schema.milestones.dueDate, from)))
    .orderBy(asc(schema.teams.name), asc(schema.milestones.startDate), asc(schema.milestones.dueDate), asc(schema.milestones.id))
    .all();
}

export function milestoneById(id: number): MilestoneRow | undefined {
  return db.select(rowSelect).from(schema.milestones).innerJoin(schema.teams, eq(schema.teams.id, schema.milestones.teamId)).where(eq(schema.milestones.id, id)).get();
}

export function milestoneUpdatesFor(id: number) {
  return db.select().from(schema.milestoneUpdates).where(eq(schema.milestoneUpdates.milestoneId, id)).orderBy(desc(schema.milestoneUpdates.createdAt), desc(schema.milestoneUpdates.id)).all();
}
