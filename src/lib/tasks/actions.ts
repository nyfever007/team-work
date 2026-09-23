"use server";

import { and, eq, max } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { requireMember } from "@/lib/auth/dal";
import { isValidKey } from "@/lib/dates";
import { db, schema } from "@/lib/db";
import { TASK_STATUSES, type TaskStatus } from "@/lib/db/schema";

export type TaskResult = { ok: true } | { ok: false; error: string };

function revalidate() {
  revalidatePath("/my/today");
  revalidatePath("/my/week");
  revalidatePath("/my/history");
  revalidatePath("/team");
}

function fail(e: unknown, fallback: string): TaskResult {
  return { ok: false, error: e instanceof Error ? e.message : fallback };
}

async function ownTask(id: number) {
  const { memberId } = await requireMember();
  const task = db.select().from(schema.dailyTasks).where(eq(schema.dailyTasks.id, id)).get();
  if (!task || task.memberId !== memberId) throw new Error("항목을 찾을 수 없습니다.");
  return task;
}

export async function addTask(date: string, title: string, weeklyItemId?: number | null): Promise<TaskResult> {
  try {
    const { memberId } = await requireMember();
    if (!isValidKey(date)) return { ok: false, error: "날짜가 올바르지 않습니다." };
    const clean = title.replace(/\s+/g, " ").trim();
    if (!clean) return { ok: false, error: "할 일을 입력하세요." };
    if (clean.length > 200) return { ok: false, error: "200자 이내로 입력하세요." };
    if (weeklyItemId != null) {
      const w = db.select().from(schema.weeklyItems).where(eq(schema.weeklyItems.id, weeklyItemId)).get();
      if (!w || w.memberId !== memberId) return { ok: false, error: "주간 항목을 찾을 수 없습니다." };
    }
    const row = db
      .select({ maxPos: max(schema.dailyTasks.position) })
      .from(schema.dailyTasks)
      .where(and(eq(schema.dailyTasks.memberId, memberId), eq(schema.dailyTasks.date, date)))
      .get();
    db.insert(schema.dailyTasks).values({ memberId, date, title: clean, weeklyItemId: weeklyItemId ?? null, position: (row?.maxPos ?? 0) + 1 }).run();
    revalidate();
    return { ok: true };
  } catch (e) {
    return fail(e, "추가에 실패했습니다.");
  }
}

export async function renameTask(id: number, title: string): Promise<TaskResult> {
  try {
    await ownTask(id);
    const clean = title.replace(/\s+/g, " ").trim();
    if (!clean) return { ok: false, error: "할 일을 입력하세요." };
    if (clean.length > 200) return { ok: false, error: "200자 이내로 입력하세요." };
    db.update(schema.dailyTasks).set({ title: clean }).where(eq(schema.dailyTasks.id, id)).run();
    revalidate();
    return { ok: true };
  } catch (e) {
    return fail(e, "수정에 실패했습니다.");
  }
}

export async function deleteTask(id: number): Promise<TaskResult> {
  try {
    await ownTask(id);
    db.delete(schema.dailyTasks).where(eq(schema.dailyTasks.id, id)).run();
    revalidate();
    return { ok: true };
  } catch (e) {
    return fail(e, "삭제에 실패했습니다.");
  }
}

export async function setTaskStatus(id: number, status: TaskStatus): Promise<TaskResult> {
  try {
    await ownTask(id);
    if (!TASK_STATUSES.includes(status)) return { ok: false, error: "상태가 올바르지 않습니다." };
    db.update(schema.dailyTasks).set({ status, reviewedAt: new Date() }).where(eq(schema.dailyTasks.id, id)).run();
    revalidate();
    return { ok: true };
  } catch (e) {
    return fail(e, "저장에 실패했습니다.");
  }
}

export async function setTaskNote(id: number, note: string): Promise<TaskResult> {
  try {
    await ownTask(id);
    const clean = note.replace(/\s+/g, " ").trim().slice(0, 300);
    db.update(schema.dailyTasks).set({ note: clean, reviewedAt: new Date() }).where(eq(schema.dailyTasks.id, id)).run();
    revalidate();
    return { ok: true };
  } catch (e) {
    return fail(e, "저장에 실패했습니다.");
  }
}

/** Copy unfinished items from `fromDate` to `toDate` (e.g. yesterday → today). */
export async function carryOverTasks(fromDate: string, toDate: string): Promise<TaskResult & { count?: number }> {
  try {
    const { memberId } = await requireMember();
    if (!isValidKey(fromDate) || !isValidKey(toDate) || fromDate >= toDate) return { ok: false, error: "날짜가 올바르지 않습니다." };
    const pending = db
      .select()
      .from(schema.dailyTasks)
      .where(and(eq(schema.dailyTasks.memberId, memberId), eq(schema.dailyTasks.date, fromDate)))
      .all()
      .filter((t) => t.status !== "done");
    const existing = new Set(
      db.select({ title: schema.dailyTasks.title }).from(schema.dailyTasks).where(and(eq(schema.dailyTasks.memberId, memberId), eq(schema.dailyTasks.date, toDate))).all().map((t) => t.title),
    );
    const toAdd = pending.filter((t) => !existing.has(t.title));
    if (toAdd.length === 0) return { ok: true, count: 0 };
    const row = db.select({ maxPos: max(schema.dailyTasks.position) }).from(schema.dailyTasks).where(and(eq(schema.dailyTasks.memberId, memberId), eq(schema.dailyTasks.date, toDate))).get();
    let pos = row?.maxPos ?? 0;
    db.insert(schema.dailyTasks)
      .values(toAdd.map((t) => ({ memberId, date: toDate, title: t.title, weeklyItemId: t.weeklyItemId, position: ++pos })))
      .run();
    revalidate();
    return { ok: true, count: toAdd.length };
  } catch (e) {
    return fail(e, "이월에 실패했습니다.");
  }
}
