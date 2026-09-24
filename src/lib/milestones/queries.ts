import "server-only";
import { and, asc, desc, eq, gte, inArray, lte, ne } from "drizzle-orm";
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
  approval: schema.milestones.approval,
  approvalNote: schema.milestones.approvalNote,
  approvalByName: schema.milestones.approvalByName,
  approvalAt: schema.milestones.approvalAt,
  createdAt: schema.milestones.createdAt,
  updatedAt: schema.milestones.updatedAt,
  team: schema.teams.name,
};

/**
 * Milestones overlapping [from, to] (inclusive), with team name. Approved only by default, so pickers,
 * insights and AI sources never see proposals; the milestone page passes `includeUnapproved`.
 */
export function milestonesInRange(from: string, to: string, opts?: { includeUnapproved?: boolean }): MilestoneRow[] {
  return db
    .select(rowSelect)
    .from(schema.milestones)
    .innerJoin(schema.teams, eq(schema.teams.id, schema.milestones.teamId))
    .where(and(lte(schema.milestones.startDate, to), gte(schema.milestones.dueDate, from), opts?.includeUnapproved ? undefined : eq(schema.milestones.approval, "approved")))
    .orderBy(asc(schema.teams.name), asc(schema.milestones.startDate), asc(schema.milestones.dueDate), asc(schema.milestones.id))
    .all();
}

export function milestoneById(id: number): MilestoneRow | undefined {
  return db.select(rowSelect).from(schema.milestones).innerJoin(schema.teams, eq(schema.teams.id, schema.milestones.teamId)).where(eq(schema.milestones.id, id)).get();
}

export function milestoneUpdatesFor(id: number) {
  return db.select().from(schema.milestoneUpdates).where(eq(schema.milestoneUpdates.milestoneId, id)).orderBy(desc(schema.milestoneUpdates.createdAt), desc(schema.milestoneUpdates.id)).all();
}

/** Proposals waiting for approval in the given teams ("all" for admin), oldest first. */
export function pendingMilestones(teamIds: number[] | "all"): MilestoneRow[] {
  if (teamIds !== "all" && teamIds.length === 0) return [];
  return db
    .select(rowSelect)
    .from(schema.milestones)
    .innerJoin(schema.teams, eq(schema.teams.id, schema.milestones.teamId))
    .where(and(eq(schema.milestones.approval, "pending"), teamIds === "all" ? undefined : inArray(schema.milestones.teamId, teamIds)))
    .orderBy(asc(schema.milestones.createdAt))
    .all();
}

/** The user's own proposals that are not approved yet (pending or rejected). */
export function myMilestoneRequests(userId: number): MilestoneRow[] {
  return db
    .select(rowSelect)
    .from(schema.milestones)
    .innerJoin(schema.teams, eq(schema.teams.id, schema.milestones.teamId))
    .where(and(eq(schema.milestones.createdBy, userId), ne(schema.milestones.approval, "approved")))
    .orderBy(desc(schema.milestones.updatedAt))
    .all();
}
