"use server";

import { and, eq, max } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { requireMember, requireUser } from "@/lib/auth/dal";
import { memberById } from "@/lib/members/queries";
import { isValidKey, isValidMonth, weekStartOf } from "@/lib/dates";
import { db, schema } from "@/lib/db";
import { TASK_STATUSES, type TaskStatus } from "@/lib/tasks/types";

export type PlanResult = { ok: true; id?: number } | { ok: false; error: string };

function revalidate() {
  revalidatePath("/team/manage");
  revalidatePath("/my/week");
  revalidatePath("/my/month");
  revalidatePath("/my/today");
  revalidatePath("/team");
  revalidatePath("/team/milestones");
}
const fail = (e: unknown, fallback: string): PlanResult => ({ ok: false, error: e instanceof Error ? e.message : fallback });
const cleanTitle = (t: string) => t.replace(/\s+/g, " ").trim();

function checkMilestone(id: number | null) {
  if (id == null) return true;
  return !!db.select({ id: schema.milestones.id }).from(schema.milestones).where(eq(schema.milestones.id, id)).get();
}

// ---------------- weekly items ----------------

/** Admin, or leader of the member's team (not for self). */
async function managerOf(memberId: number) {
  const user = await requireUser();
  const target = memberById(memberId);
  if (!target) throw new Error("구성원을 찾을 수 없습니다.");
  if (user.role === "admin") return { user, target };
  const me = user.memberId != null ? memberById(user.memberId) : undefined;
  if (me?.isLeader && me.teamId === target.teamId && me.id !== target.id) return { user, target };
  throw new Error("이 구성원을 관리할 권한이 없습니다.");
}

async function ownItem(id: number) {
  const { memberId } = await requireMember();
  const item = db.select().from(schema.weeklyItems).where(eq(schema.weeklyItems.id, id)).get();
  if (!item || item.memberId !== memberId) throw new Error("항목을 찾을 수 없습니다.");
  return { item, memberId };
}

/** Owner for own items; for leader-assigned items only the team leader / admin may rename or delete. */
async function editableItem(id: number) {
  const user = await requireUser();
  const item = db.select().from(schema.weeklyItems).where(eq(schema.weeklyItems.id, id)).get();
  if (!item) throw new Error("항목을 찾을 수 없습니다.");
  if (item.assignedBy != null) {
    await managerOf(item.memberId); // throws unless admin / that team's leader
    return { item, memberId: item.memberId };
  }
  if (item.memberId !== user.memberId) throw new Error("항목을 찾을 수 없습니다.");
  return { item, memberId: item.memberId };
}

/** Leader/admin adds an item to a teammate's week. */
export async function assignWeeklyItem(memberId: number, weekStart: string, title: string, milestoneId?: number | null): Promise<PlanResult> {
  try {
    const { user } = await managerOf(memberId);
    if (!isValidKey(weekStart) || weekStartOf(weekStart) !== weekStart) return { ok: false, error: "주차가 올바르지 않습니다." };
    const clean = cleanTitle(title);
    if (!clean) return { ok: false, error: "항목을 입력하세요." };
    if (clean.length > 200) return { ok: false, error: "200자 이내로 입력하세요." };
    if (!checkMilestone(milestoneId ?? null)) return { ok: false, error: "마일스톤을 찾을 수 없습니다." };
    const row = db.select({ maxPos: max(schema.weeklyItems.position) }).from(schema.weeklyItems).where(and(eq(schema.weeklyItems.memberId, memberId), eq(schema.weeklyItems.weekStart, weekStart))).get();
    const r = db.insert(schema.weeklyItems).values({ memberId, weekStart, title: clean, milestoneId: milestoneId ?? null, assignedBy: user.id, assignedByName: user.name, position: (row?.maxPos ?? 0) + 1 }).run();
    revalidate();
    revalidatePath("/team/manage");
    return { ok: true, id: Number(r.lastInsertRowid) };
  } catch (e) {
    return fail(e, "지정에 실패했습니다.");
  }
}

export async function addWeeklyItem(weekStart: string, title: string, links?: { milestoneId?: number | null; monthlyGoalId?: number | null }): Promise<PlanResult> {
  try {
    const { memberId } = await requireMember();
    if (!isValidKey(weekStart) || weekStartOf(weekStart) !== weekStart) return { ok: false, error: "주차가 올바르지 않습니다." };
    const clean = cleanTitle(title);
    if (!clean) return { ok: false, error: "할 일을 입력하세요." };
    if (clean.length > 200) return { ok: false, error: "200자 이내로 입력하세요." };
    const milestoneId = links?.milestoneId ?? null;
    const monthlyGoalId = links?.monthlyGoalId ?? null;
    if (!checkMilestone(milestoneId)) return { ok: false, error: "마일스톤을 찾을 수 없습니다." };
    if (monthlyGoalId != null) {
      const g = db.select().from(schema.monthlyGoals).where(eq(schema.monthlyGoals.id, monthlyGoalId)).get();
      if (!g || g.memberId !== memberId) return { ok: false, error: "월간 목표를 찾을 수 없습니다." };
    }
    const row = db.select({ maxPos: max(schema.weeklyItems.position) }).from(schema.weeklyItems).where(and(eq(schema.weeklyItems.memberId, memberId), eq(schema.weeklyItems.weekStart, weekStart))).get();
    const r = db.insert(schema.weeklyItems).values({ memberId, weekStart, title: clean, milestoneId, monthlyGoalId, position: (row?.maxPos ?? 0) + 1 }).run();
    revalidate();
    return { ok: true, id: Number(r.lastInsertRowid) };
  } catch (e) {
    return fail(e, "추가에 실패했습니다.");
  }
}

export async function renameWeeklyItem(id: number, title: string): Promise<PlanResult> {
  try {
    await editableItem(id);
    const clean = cleanTitle(title);
    if (!clean) return { ok: false, error: "할 일을 입력하세요." };
    db.update(schema.weeklyItems).set({ title: clean.slice(0, 200) }).where(eq(schema.weeklyItems.id, id)).run();
    revalidate();
    return { ok: true };
  } catch (e) {
    return fail(e, "수정에 실패했습니다.");
  }
}

export async function setWeeklyItemStatus(id: number, status: TaskStatus): Promise<PlanResult> {
  try {
    await ownItem(id);
    if (!TASK_STATUSES.includes(status)) return { ok: false, error: "상태가 올바르지 않습니다." };
    db.update(schema.weeklyItems).set({ status, doneAt: status === "done" ? new Date() : null }).where(eq(schema.weeklyItems.id, id)).run();
    revalidate();
    return { ok: true };
  } catch (e) {
    return fail(e, "저장에 실패했습니다.");
  }
}

export async function setWeeklyItemLinks(id: number, links: { milestoneId: number | null; monthlyGoalId: number | null }): Promise<PlanResult> {
  try {
    const { memberId } = await ownItem(id);
    if (!checkMilestone(links.milestoneId)) return { ok: false, error: "마일스톤을 찾을 수 없습니다." };
    if (links.monthlyGoalId != null) {
      const g = db.select().from(schema.monthlyGoals).where(eq(schema.monthlyGoals.id, links.monthlyGoalId)).get();
      if (!g || g.memberId !== memberId) return { ok: false, error: "월간 목표를 찾을 수 없습니다." };
    }
    db.update(schema.weeklyItems).set(links).where(eq(schema.weeklyItems.id, id)).run();
    revalidate();
    return { ok: true };
  } catch (e) {
    return fail(e, "저장에 실패했습니다.");
  }
}

export async function deleteWeeklyItem(id: number): Promise<PlanResult> {
  try {
    await editableItem(id);
    db.delete(schema.weeklyItems).where(eq(schema.weeklyItems.id, id)).run();
    revalidate();
    return { ok: true };
  } catch (e) {
    return fail(e, "삭제에 실패했습니다.");
  }
}

/** Create today's task from a weekly item (linked). Skips if an identical linked task exists that day. */
export async function pullWeeklyItemToDay(id: number, date: string): Promise<PlanResult> {
  try {
    const { item, memberId } = await ownItem(id);
    if (!isValidKey(date)) return { ok: false, error: "날짜가 올바르지 않습니다." };
    const dup = db.select({ id: schema.dailyTasks.id }).from(schema.dailyTasks).where(and(eq(schema.dailyTasks.memberId, memberId), eq(schema.dailyTasks.date, date), eq(schema.dailyTasks.weeklyItemId, id))).get();
    if (dup) return { ok: false, error: "이미 오늘 할 일에 있습니다." };
    const row = db.select({ maxPos: max(schema.dailyTasks.position) }).from(schema.dailyTasks).where(and(eq(schema.dailyTasks.memberId, memberId), eq(schema.dailyTasks.date, date))).get();
    const r = db.insert(schema.dailyTasks).values({ memberId, date, title: item.title, weeklyItemId: id, position: (row?.maxPos ?? 0) + 1 }).run();
    if (item.status === "todo") db.update(schema.weeklyItems).set({ status: "in_progress" }).where(eq(schema.weeklyItems.id, id)).run();
    revalidate();
    return { ok: true, id: Number(r.lastInsertRowid) };
  } catch (e) {
    return fail(e, "가져오기에 실패했습니다.");
  }
}

// ---------------- monthly goals ----------------

async function ownGoal(id: number) {
  const { memberId } = await requireMember();
  const goal = db.select().from(schema.monthlyGoals).where(eq(schema.monthlyGoals.id, id)).get();
  if (!goal || goal.memberId !== memberId) throw new Error("목표를 찾을 수 없습니다.");
  return { goal, memberId };
}

export async function addMonthlyGoal(month: string, title: string, milestoneId?: number | null): Promise<PlanResult> {
  try {
    const { memberId } = await requireMember();
    if (!isValidMonth(month)) return { ok: false, error: "월이 올바르지 않습니다." };
    const clean = cleanTitle(title);
    if (!clean) return { ok: false, error: "목표를 입력하세요." };
    if (clean.length > 200) return { ok: false, error: "200자 이내로 입력하세요." };
    if (!checkMilestone(milestoneId ?? null)) return { ok: false, error: "마일스톤을 찾을 수 없습니다." };
    const row = db.select({ maxPos: max(schema.monthlyGoals.position) }).from(schema.monthlyGoals).where(and(eq(schema.monthlyGoals.memberId, memberId), eq(schema.monthlyGoals.month, month))).get();
    const r = db.insert(schema.monthlyGoals).values({ memberId, month, title: clean, milestoneId: milestoneId ?? null, position: (row?.maxPos ?? 0) + 1 }).run();
    revalidate();
    return { ok: true, id: Number(r.lastInsertRowid) };
  } catch (e) {
    return fail(e, "추가에 실패했습니다.");
  }
}

export async function renameMonthlyGoal(id: number, title: string): Promise<PlanResult> {
  try {
    await ownGoal(id);
    const clean = cleanTitle(title);
    if (!clean) return { ok: false, error: "목표를 입력하세요." };
    db.update(schema.monthlyGoals).set({ title: clean.slice(0, 200) }).where(eq(schema.monthlyGoals.id, id)).run();
    revalidate();
    return { ok: true };
  } catch (e) {
    return fail(e, "수정에 실패했습니다.");
  }
}

export async function setMonthlyGoalStatus(id: number, status: TaskStatus): Promise<PlanResult> {
  try {
    await ownGoal(id);
    if (!TASK_STATUSES.includes(status)) return { ok: false, error: "상태가 올바르지 않습니다." };
    db.update(schema.monthlyGoals).set({ status, doneAt: status === "done" ? new Date() : null }).where(eq(schema.monthlyGoals.id, id)).run();
    revalidate();
    return { ok: true };
  } catch (e) {
    return fail(e, "저장에 실패했습니다.");
  }
}

export async function setMonthlyGoalMilestone(id: number, milestoneId: number | null): Promise<PlanResult> {
  try {
    await ownGoal(id);
    if (!checkMilestone(milestoneId)) return { ok: false, error: "마일스톤을 찾을 수 없습니다." };
    db.update(schema.monthlyGoals).set({ milestoneId }).where(eq(schema.monthlyGoals.id, id)).run();
    revalidate();
    return { ok: true };
  } catch (e) {
    return fail(e, "저장에 실패했습니다.");
  }
}

export async function deleteMonthlyGoal(id: number): Promise<PlanResult> {
  try {
    await ownGoal(id);
    db.delete(schema.monthlyGoals).where(eq(schema.monthlyGoals.id, id)).run();
    revalidate();
    return { ok: true };
  } catch (e) {
    return fail(e, "삭제에 실패했습니다.");
  }
}
