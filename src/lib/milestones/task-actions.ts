"use server";

import { and, eq, max } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth/dal";
import type { SafeUser } from "@/lib/auth/session";
import { isValidKey } from "@/lib/dates";
import { db, schema } from "@/lib/db";
import type { MilestoneRecord, MilestoneTask } from "@/lib/db/schema";
import { memberById } from "@/lib/members/queries";
import { milestoneAccess } from "./permissions";
import { canReviewMilestone } from "./task-queries";
import { taskProgress, type MilestoneTaskStatus } from "./task-types";

export type TaskActionResult = { ok: true; message: string } | { ok: false; error: string };
const fail = (e: unknown, fallback: string): TaskActionResult => ({ ok: false, error: e instanceof Error ? e.message : fallback });

function revalidate() {
  // Milestone dialog, Gantt progress and the 오늘 "내 마일스톤 작업" card all read tasks.
  revalidatePath("/", "layout");
}

function loadMilestone(id: number): MilestoneRecord {
  const ms = db.select().from(schema.milestones).where(eq(schema.milestones.id, id)).get();
  if (!ms) throw new Error("마일스톤을 찾을 수 없습니다.");
  if (ms.approval !== "approved") throw new Error("승인된 마일스톤에만 작업을 둘 수 있습니다.");
  return ms;
}

function loadTask(id: number): { task: MilestoneTask; ms: MilestoneRecord } {
  const task = db.select().from(schema.milestoneTasks).where(eq(schema.milestoneTasks.id, id)).get();
  if (!task) throw new Error("작업을 찾을 수 없습니다.");
  return { task, ms: loadMilestone(task.milestoneId) };
}

/** Add/edit/delete tasks: whoever may manage the milestone (team leader, owner, admin). */
function assertManager(user: SafeUser, ms: MilestoneRecord) {
  if (!milestoneAccess(user).canManage(ms)) throw new Error("이 마일스톤의 작업을 관리할 권한이 없습니다.");
}

function checkAssignee(assigneeId: number | null, ms: MilestoneRecord) {
  if (assigneeId == null) return;
  const m = memberById(assigneeId);
  if (!m || m.teamId !== ms.teamId) throw new Error("담당자는 같은 팀 구성원만 지정할 수 있습니다.");
}

/** Progress = 검수 완료 / 전체; planned milestones move to 진행 중 once any task starts. */
function syncProgress(milestoneId: number) {
  const tasks = db.select({ status: schema.milestoneTasks.status }).from(schema.milestoneTasks).where(eq(schema.milestoneTasks.milestoneId, milestoneId)).all();
  if (tasks.length === 0) return;
  const ms = db.select().from(schema.milestones).where(eq(schema.milestones.id, milestoneId)).get();
  if (!ms) return;
  const progress = taskProgress(tasks);
  const started = tasks.some((t) => t.status !== "todo");
  db.update(schema.milestones)
    .set({ progress, ...(ms.status === "planned" && started ? { status: "in_progress" as const } : {}), updatedAt: new Date() })
    .where(eq(schema.milestones.id, milestoneId))
    .run();
}

type TaskInput = { title: string; assigneeId: number | null; dueDate: string | null };

function cleanInput(input: TaskInput): TaskInput {
  const title = String(input.title ?? "").replace(/\s+/g, " ").trim();
  if (!title) throw new Error("작업 내용을 입력하세요.");
  if (title.length > 200) throw new Error("작업은 200자 이내로 입력하세요.");
  const dueDate = input.dueDate ? String(input.dueDate) : null;
  if (dueDate && !isValidKey(dueDate)) throw new Error("기한이 올바르지 않습니다.");
  const assigneeId = input.assigneeId ? Number(input.assigneeId) : null;
  return { title, assigneeId, dueDate };
}

export async function addMilestoneTask(milestoneId: number, input: TaskInput): Promise<TaskActionResult> {
  try {
    const user = await requireUser();
    const ms = loadMilestone(milestoneId);
    assertManager(user, ms);
    const v = cleanInput(input);
    checkAssignee(v.assigneeId, ms);
    const row = db.select({ p: max(schema.milestoneTasks.position) }).from(schema.milestoneTasks).where(eq(schema.milestoneTasks.milestoneId, milestoneId)).get();
    db.insert(schema.milestoneTasks).values({ milestoneId, ...v, position: (row?.p ?? 0) + 1, createdBy: user.id }).run();
    syncProgress(milestoneId);
    revalidate();
    return { ok: true, message: "작업을 추가했습니다." };
  } catch (e) {
    return fail(e, "추가에 실패했습니다.");
  }
}

export async function updateMilestoneTask(id: number, input: TaskInput): Promise<TaskActionResult> {
  try {
    const user = await requireUser();
    const { task, ms } = loadTask(id);
    assertManager(user, ms);
    const v = cleanInput(input);
    checkAssignee(v.assigneeId, ms);
    // Reassigning an unfinished task restarts it for the new person.
    const reassigned = v.assigneeId !== task.assigneeId && task.status !== "approved";
    db.update(schema.milestoneTasks)
      .set({ ...v, ...(reassigned ? { status: "todo" as const, reportedAt: null, reviewNote: "" } : {}), updatedAt: new Date() })
      .where(eq(schema.milestoneTasks.id, id))
      .run();
    syncProgress(ms.id);
    revalidate();
    return { ok: true, message: "작업을 수정했습니다." };
  } catch (e) {
    return fail(e, "수정에 실패했습니다.");
  }
}

export async function deleteMilestoneTask(id: number): Promise<TaskActionResult> {
  try {
    const user = await requireUser();
    const { ms } = loadTask(id);
    assertManager(user, ms);
    db.delete(schema.milestoneTasks).where(eq(schema.milestoneTasks.id, id)).run();
    syncProgress(ms.id);
    revalidate();
    return { ok: true, message: "작업을 삭제했습니다." };
  } catch (e) {
    return fail(e, "삭제에 실패했습니다.");
  }
}

/** Assignee (or a manager) moves the task: 할 일 ↔ 진행 중 → 완료 보고(review). */
export async function setMilestoneTaskStatus(id: number, status: Exclude<MilestoneTaskStatus, "approved">): Promise<TaskActionResult> {
  try {
    const user = await requireUser();
    const { task, ms } = loadTask(id);
    const isAssignee = user.memberId != null && task.assigneeId === user.memberId;
    if (!isAssignee && !milestoneAccess(user).canManage(ms)) throw new Error("담당자만 진행 상태를 바꿀 수 있습니다.");
    if (!["todo", "in_progress", "review"].includes(status)) throw new Error("상태가 올바르지 않습니다.");
    if (task.status === "approved") throw new Error("검수 완료된 작업입니다.");
    db.update(schema.milestoneTasks)
      .set({ status, reportedAt: status === "review" ? new Date() : task.reportedAt, ...(status === "review" ? { reviewNote: "" } : {}), updatedAt: new Date() })
      .where(eq(schema.milestoneTasks.id, id))
      .run();
    syncProgress(ms.id);
    revalidate();
    return { ok: true, message: status === "review" ? "완료를 보고했습니다. 마일스톤 담당자가 검수합니다." : "상태를 바꿨습니다." };
  } catch (e) {
    return fail(e, "처리에 실패했습니다.");
  }
}

/** 검수: approve a reported task, or send it back to 진행 중 with a reason. Approved tasks can be reopened. */
export async function reviewMilestoneTask(id: number, decision: "approve" | "reject", note = ""): Promise<TaskActionResult> {
  try {
    const user = await requireUser();
    const { task, ms } = loadTask(id);
    if (!canReviewMilestone(user, ms)) throw new Error("마일스톤 담당자 또는 팀장만 검수할 수 있습니다.");
    const reason = note.replace(/\r\n/g, "\n").trim();
    if (decision === "approve") {
      if (task.status !== "review") throw new Error("완료 보고된 작업만 검수할 수 있습니다.");
      db.update(schema.milestoneTasks).set({ status: "approved", approvedAt: new Date(), approvedByName: user.name, reviewNote: "", updatedAt: new Date() }).where(eq(schema.milestoneTasks.id, id)).run();
    } else {
      if (task.status !== "review" && task.status !== "approved") throw new Error("완료 보고된 작업만 되돌릴 수 있습니다.");
      if (!reason) throw new Error("되돌리는 사유를 입력하세요.");
      if (reason.length > 500) throw new Error("사유는 500자 이내로 입력하세요.");
      db.update(schema.milestoneTasks).set({ status: "in_progress", approvedAt: null, approvedByName: null, reviewNote: reason, updatedAt: new Date() }).where(eq(schema.milestoneTasks.id, id)).run();
    }
    syncProgress(ms.id);
    revalidate();
    return { ok: true, message: decision === "approve" ? "검수 완료했습니다." : "보완을 요청했습니다. 담당자에게 사유가 표시됩니다." };
  } catch (e) {
    return fail(e, "처리에 실패했습니다.");
  }
}

/** "오늘로": assignee adds the task to today's goals (linked) and it becomes 진행 중. */
export async function pullMilestoneTaskToDay(id: number, date: string): Promise<TaskActionResult> {
  try {
    const user = await requireUser();
    const { task, ms } = loadTask(id);
    if (user.memberId == null || task.assigneeId !== user.memberId) throw new Error("내가 맡은 작업만 오늘 목표로 가져올 수 있습니다.");
    if (!isValidKey(date)) throw new Error("날짜가 올바르지 않습니다.");
    const memberId = user.memberId;
    const dup = db.select({ id: schema.dailyTasks.id }).from(schema.dailyTasks).where(and(eq(schema.dailyTasks.memberId, memberId), eq(schema.dailyTasks.date, date), eq(schema.dailyTasks.milestoneTaskId, id))).get();
    if (dup) return { ok: true, message: "이미 오늘 목표에 있습니다." };
    const row = db.select({ p: max(schema.dailyTasks.position) }).from(schema.dailyTasks).where(and(eq(schema.dailyTasks.memberId, memberId), eq(schema.dailyTasks.date, date))).get();
    db.insert(schema.dailyTasks).values({ memberId, date, title: task.title, milestoneTaskId: id, position: (row?.p ?? 0) + 1 }).run();
    if (task.status === "todo") db.update(schema.milestoneTasks).set({ status: "in_progress", updatedAt: new Date() }).where(eq(schema.milestoneTasks.id, id)).run();
    syncProgress(ms.id);
    revalidate();
    return { ok: true, message: "오늘 목표에 추가했습니다." };
  } catch (e) {
    return fail(e, "추가에 실패했습니다.");
  }
}
