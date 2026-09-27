import "server-only";
import { and, asc, eq, inArray, ne } from "drizzle-orm";
import type { SafeUser } from "@/lib/auth/session";
import { db, schema } from "@/lib/db";
import type { MilestoneRecord, MilestoneTask } from "@/lib/db/schema";
import { memberById } from "@/lib/members/queries";

/** 검수 rights: milestone owner, the team's leader, or admin. */
export function canReviewMilestone(user: SafeUser, ms: { ownerId: number | null; teamId: number }): boolean {
  if (user.role === "admin") return true;
  const me = user.memberId != null ? memberById(user.memberId) : undefined;
  if (!me) return false;
  return ms.ownerId === me.id || (me.isLeader && me.teamId === ms.teamId);
}

export function tasksForMilestone(milestoneId: number): MilestoneTask[] {
  return db.select().from(schema.milestoneTasks).where(eq(schema.milestoneTasks.milestoneId, milestoneId)).orderBy(asc(schema.milestoneTasks.position), asc(schema.milestoneTasks.id)).all();
}

export type MyMilestoneTask = MilestoneTask & { milestoneTitle: string; milestoneDue: string };

const withMilestone = {
  task: schema.milestoneTasks,
  milestoneTitle: schema.milestones.title,
  milestoneDue: schema.milestones.dueDate,
};

/** Tasks assigned to the member that aren't 검수 완료 yet (approved milestones only). */
export function myMilestoneTasks(memberId: number): MyMilestoneTask[] {
  return db
    .select(withMilestone)
    .from(schema.milestoneTasks)
    .innerJoin(schema.milestones, eq(schema.milestones.id, schema.milestoneTasks.milestoneId))
    .where(and(eq(schema.milestoneTasks.assigneeId, memberId), ne(schema.milestoneTasks.status, "approved"), eq(schema.milestones.approval, "approved")))
    .orderBy(asc(schema.milestoneTasks.dueDate), asc(schema.milestoneTasks.id))
    .all()
    .map((r) => ({ ...r.task, milestoneTitle: r.milestoneTitle, milestoneDue: r.milestoneDue }));
}

/**
 * Tasks waiting for this user's 검수: on milestones they own, plus — as team leader — milestones of their team without
 * an owner or owned by someone else (the leader can always review). Admins aren't flooded with every team's reviews.
 */
export function tasksToReview(user: SafeUser): (MyMilestoneTask & { assigneeName: string | null })[] {
  if (user.memberId == null) return [];
  const me = memberById(user.memberId);
  if (!me) return [];
  const rows = db
    .select({ ...withMilestone, ownerId: schema.milestones.ownerId, teamId: schema.milestones.teamId, assigneeName: schema.members.name })
    .from(schema.milestoneTasks)
    .innerJoin(schema.milestones, eq(schema.milestones.id, schema.milestoneTasks.milestoneId))
    .leftJoin(schema.members, eq(schema.members.id, schema.milestoneTasks.assigneeId))
    .where(eq(schema.milestoneTasks.status, "review"))
    .all();
  return rows
    .filter((r) => r.ownerId === me.id || (me.isLeader && r.teamId === me.teamId))
    .map((r) => ({ ...r.task, milestoneTitle: r.milestoneTitle, milestoneDue: r.milestoneDue, assigneeName: r.assigneeName }));
}

/** Task counts per milestone id: total / approved / review — for Gantt tooltips and lists. */
export function taskCountsFor(milestoneIds: number[]): Map<number, { total: number; approved: number; review: number }> {
  const out = new Map<number, { total: number; approved: number; review: number }>();
  if (milestoneIds.length === 0) return out;
  for (const t of db.select({ m: schema.milestoneTasks.milestoneId, s: schema.milestoneTasks.status }).from(schema.milestoneTasks).where(inArray(schema.milestoneTasks.milestoneId, milestoneIds)).all()) {
    const c = out.get(t.m) ?? { total: 0, approved: 0, review: 0 };
    c.total++;
    if (t.s === "approved") c.approved++;
    if (t.s === "review") c.review++;
    out.set(t.m, c);
  }
  return out;
}

export type MyMilestone = {
  id: number;
  title: string;
  team: string;
  startDate: string;
  dueDate: string;
  status: MilestoneRecord["status"];
  progress: number;
  owned: boolean;
  /** My tasks on it that aren't 검수 완료 / all my tasks on it. */
  myOpen: number;
  myTotal: number;
  /** All tasks on the milestone (for "작업 n/m"). */
  approved: number;
  total: number;
  /** My tasks with a due date (timeline markers). */
  myDue: { title: string; dueDate: string; status: MilestoneTask["status"] }[];
};

/** Milestones I own or have 작업 on — approved and not finished — soonest due first. */
export function myMilestones(memberId: number): MyMilestone[] {
  const owned = db
    .select({ id: schema.milestones.id })
    .from(schema.milestones)
    .where(and(eq(schema.milestones.ownerId, memberId), eq(schema.milestones.approval, "approved"), ne(schema.milestones.status, "done")))
    .all()
    .map((r) => r.id);
  const mine = db
    .select({ m: schema.milestoneTasks.milestoneId, s: schema.milestoneTasks.status, title: schema.milestoneTasks.title, due: schema.milestoneTasks.dueDate })
    .from(schema.milestoneTasks)
    .where(eq(schema.milestoneTasks.assigneeId, memberId))
    .all();
  const ids = [...new Set([...owned, ...mine.map((t) => t.m)])];
  if (ids.length === 0) return [];
  const counts = taskCountsFor(ids);
  return db
    .select({ id: schema.milestones.id, title: schema.milestones.title, startDate: schema.milestones.startDate, dueDate: schema.milestones.dueDate, status: schema.milestones.status, progress: schema.milestones.progress, ownerId: schema.milestones.ownerId, approval: schema.milestones.approval, team: schema.teams.name })
    .from(schema.milestones)
    .innerJoin(schema.teams, eq(schema.teams.id, schema.milestones.teamId))
    .where(inArray(schema.milestones.id, ids))
    .orderBy(asc(schema.milestones.dueDate))
    .all()
    .filter((m) => m.approval === "approved" && m.status !== "done")
    .map((m) => {
      const my = mine.filter((t) => t.m === m.id);
      const c = counts.get(m.id);
      return {
        id: m.id,
        title: m.title,
        team: m.team,
        startDate: m.startDate,
        dueDate: m.dueDate,
        status: m.status,
        progress: m.progress,
        owned: m.ownerId === memberId,
        myOpen: my.filter((t) => t.s !== "approved").length,
        myTotal: my.length,
        approved: c?.approved ?? 0,
        total: c?.total ?? 0,
        myDue: my.filter((t) => t.due).map((t) => ({ title: t.title, dueDate: t.due!, status: t.s })),
      };
    });
}
