"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth/dal";
import { isValidKey, parseKey } from "@/lib/dates";
import { db, schema } from "@/lib/db";
import { MILESTONE_STATUSES, type MilestoneStatus } from "@/lib/db/schema";
import { milestoneAccess } from "./permissions";

export type MilestoneFormState =
  | { ok: true; id: number; message: string }
  | { ok: false; error: string; values?: Record<string, string> }
  | undefined;

function revalidate() {
  // Pending approvals show up in the header badge and on 오늘, so refresh the whole tree.
  revalidatePath("/", "layout");
}

function readForm(formData: FormData) {
  const raw = {
    teamId: String(formData.get("teamId") ?? ""),
    title: String(formData.get("title") ?? "").trim(),
    description: String(formData.get("description") ?? "").replace(/\r\n/g, "\n").trim(),
    startDate: String(formData.get("startDate") ?? ""),
    dueDate: String(formData.get("dueDate") ?? ""),
    status: String(formData.get("status") ?? "planned"),
    progress: String(formData.get("progress") ?? "0"),
    ownerId: String(formData.get("ownerId") ?? ""),
  };
  const progress = Number(raw.progress);
  let error: string | null = null;
  const teamId = Number(raw.teamId);
  if (!Number.isInteger(teamId) || teamId <= 0) error = "팀을 선택하세요.";
  else if (!raw.title) error = "제목을 입력하세요.";
  else if (raw.title.length > 100) error = "제목은 100자 이내로 입력하세요.";
  else if (raw.description.length > 4000) error = "설명은 4000자 이내로 입력하세요.";
  else if (!isValidKey(raw.startDate) || !isValidKey(raw.dueDate)) error = "기간을 올바르게 입력하세요.";
  else if (parseKey(raw.dueDate) < parseKey(raw.startDate)) error = "마감일이 시작일보다 빠릅니다.";
  else if (!MILESTONE_STATUSES.includes(raw.status as MilestoneStatus)) error = "상태가 올바르지 않습니다.";
  else if (!Number.isInteger(progress) || progress < 0 || progress > 100) error = "진행률은 0~100 사이 정수로 입력하세요.";
  const ownerId = raw.ownerId ? Number(raw.ownerId) : null;
  if (!error && ownerId != null && !Number.isInteger(ownerId)) error = "담당자가 올바르지 않습니다.";
  if (!error && ownerId != null && db.select({ teamId: schema.members.teamId }).from(schema.members).where(eq(schema.members.id, ownerId)).get()?.teamId !== teamId) error = "담당자는 같은 팀 구성원만 지정할 수 있습니다.";
  return {
    raw,
    error,
    data: {
      teamId,
      title: raw.title,
      description: raw.description,
      startDate: raw.startDate,
      dueDate: raw.dueDate,
      status: raw.status as MilestoneStatus,
      progress: raw.status === "done" ? 100 : progress,
      ownerId,
    },
  };
}

export async function createMilestone(_prev: MilestoneFormState, formData: FormData): Promise<MilestoneFormState> {
  try {
    const user = await requireUser();
    const { raw, error, data } = readForm(formData);
    if (error) return { ok: false, error, values: raw };
    const access = milestoneAccess(user);
    if (!access.canCreateFor(data.teamId)) return { ok: false, error: "소속 팀의 마일스톤만 만들 수 있습니다.", values: raw };
    if (!db.select({ id: schema.teams.id }).from(schema.teams).where(eq(schema.teams.id, data.teamId)).get()) return { ok: false, error: "팀을 찾을 수 없습니다.", values: raw };
    const approved = access.autoApproves(data.teamId);
    const now = new Date();

    const id = db.transaction((tx) => {
      const r = tx
        .insert(schema.milestones)
        .values({ ...data, createdBy: user.id, approval: approved ? "approved" : "pending", approvalByName: approved ? user.name : null, approvalAt: approved ? now : null })
        .run();
      const milestoneId = Number(r.lastInsertRowid);
      tx.insert(schema.milestoneUpdates)
        .values({ milestoneId, authorId: user.id, authorName: user.name, note: approved ? "마일스톤을 만들었습니다." : "마일스톤을 제안했습니다. 팀장 승인을 기다립니다.", status: data.status, progress: data.progress })
        .run();
      return milestoneId;
    });
    revalidate();
    return { ok: true, id, message: approved ? "마일스톤을 만들었습니다." : "마일스톤을 제안했습니다. 팀장이 승인하면 팀 일정에 반영됩니다." };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "처리에 실패했습니다." };
  }
}

export async function updateMilestone(id: number, _prev: MilestoneFormState, formData: FormData): Promise<MilestoneFormState> {
  try {
    const user = await requireUser();
    const existing = db.select().from(schema.milestones).where(eq(schema.milestones.id, id)).get();
    if (!existing) return { ok: false, error: "마일스톤을 찾을 수 없습니다." };
    const access = milestoneAccess(user);
    if (!access.canManage(existing)) return { ok: false, error: "수정 권한이 없습니다." };
    const { raw, error, data } = readForm(formData);
    if (error) return { ok: false, error, values: raw };
    if (data.teamId !== existing.teamId && !access.canCreateFor(data.teamId)) return { ok: false, error: "그 팀으로 옮길 권한이 없습니다.", values: raw };
    // A proposer fixing a rejected proposal sends it back for approval.
    const resubmit = existing.approval === "rejected" && !access.canApprove({ teamId: data.teamId });

    db.transaction((tx) => {
      tx.update(schema.milestones)
        .set({ ...data, updatedAt: new Date(), ...(resubmit ? { approval: "pending" as const, approvalNote: "" } : {}) })
        .where(eq(schema.milestones.id, id))
        .run();
      if (resubmit || existing.status !== data.status || existing.progress !== data.progress) {
        tx.insert(schema.milestoneUpdates)
          .values({ milestoneId: id, authorId: user.id, authorName: user.name, note: resubmit ? "반려 내용을 반영해 다시 제안했습니다." : "정보를 수정했습니다.", status: data.status, progress: data.progress })
          .run();
      }
    });
    revalidate();
    return { ok: true, id, message: resubmit ? "수정해서 다시 제안했습니다." : "마일스톤을 수정했습니다." };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "처리에 실패했습니다." };
  }
}

export async function deleteMilestone(id: number): Promise<{ ok: boolean; error?: string }> {
  try {
    const user = await requireUser();
    const existing = db.select().from(schema.milestones).where(eq(schema.milestones.id, id)).get();
    if (!existing) return { ok: false, error: "이미 삭제된 마일스톤입니다." };
    if (!milestoneAccess(user).canManage(existing)) return { ok: false, error: "삭제 권한이 없습니다." };
    db.delete(schema.milestones).where(eq(schema.milestones.id, id)).run();
    revalidate();
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "처리에 실패했습니다." };
  }
}

export type UpdateFormState = { ok: true; message: string } | { ok: false; error: string } | undefined;

/** Post a status update; also moves the milestone's status/progress. */
export async function addMilestoneUpdate(id: number, _prev: UpdateFormState, formData: FormData): Promise<UpdateFormState> {
  try {
    const user = await requireUser();
    const existing = db.select().from(schema.milestones).where(eq(schema.milestones.id, id)).get();
    if (!existing) return { ok: false, error: "마일스톤을 찾을 수 없습니다." };
    if (existing.approval !== "approved") return { ok: false, error: "승인된 마일스톤에만 현황을 남길 수 있습니다." };
    if (!milestoneAccess(user).canUpdate(existing)) return { ok: false, error: "이 팀 구성원만 현황을 남길 수 있습니다." };

    const note = String(formData.get("note") ?? "").replace(/\r\n/g, "\n").trim();
    const status = String(formData.get("status") ?? existing.status) as MilestoneStatus;
    const progressRaw = Number(formData.get("progress") ?? existing.progress);
    if (!note) return { ok: false, error: "현황 내용을 입력하세요." };
    if (note.length > 2000) return { ok: false, error: "2000자 이내로 입력하세요." };
    if (!MILESTONE_STATUSES.includes(status)) return { ok: false, error: "상태가 올바르지 않습니다." };
    if (!Number.isInteger(progressRaw) || progressRaw < 0 || progressRaw > 100) return { ok: false, error: "진행률은 0~100 사이 정수로 입력하세요." };
    const progress = status === "done" ? 100 : progressRaw;

    db.transaction((tx) => {
      tx.insert(schema.milestoneUpdates).values({ milestoneId: id, authorId: user.id, authorName: user.name, note, status, progress }).run();
      tx.update(schema.milestones).set({ status, progress, updatedAt: new Date() }).where(eq(schema.milestones.id, id)).run();
    });
    revalidate();
    return { ok: true, message: "현황을 남겼습니다." };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "처리에 실패했습니다." };
  }
}

export type ApprovalResult = { ok: true; message: string } | { ok: false; error: string };

/** Team leader / admin approves or rejects a proposal. Rejecting needs a short reason for the proposer. */
export async function decideMilestone(id: number, decision: "approve" | "reject", note = ""): Promise<ApprovalResult> {
  try {
    const user = await requireUser();
    const existing = db.select().from(schema.milestones).where(eq(schema.milestones.id, id)).get();
    if (!existing) return { ok: false, error: "마일스톤을 찾을 수 없습니다." };
    if (!milestoneAccess(user).canApprove(existing)) return { ok: false, error: "이 팀의 마일스톤을 승인할 권한이 없습니다." };
    if (existing.approval === "approved") return { ok: false, error: "이미 승인된 마일스톤입니다." };
    const reason = note.replace(/\r\n/g, "\n").trim();
    if (decision === "reject" && !reason) return { ok: false, error: "반려 사유를 입력하세요." };
    if (reason.length > 500) return { ok: false, error: "사유는 500자 이내로 입력하세요." };

    const now = new Date();
    const approve = decision === "approve";
    db.transaction((tx) => {
      tx.update(schema.milestones)
        .set({ approval: approve ? "approved" : "rejected", approvalNote: approve ? "" : reason, approvalByName: user.name, approvalAt: now, updatedAt: now })
        .where(eq(schema.milestones.id, id))
        .run();
      tx.insert(schema.milestoneUpdates)
        .values({ milestoneId: id, authorId: user.id, authorName: user.name, note: approve ? `승인했습니다.${reason ? ` ${reason}` : ""}` : `반려했습니다: ${reason}`, status: existing.status, progress: existing.progress })
        .run();
    });
    revalidate();
    return { ok: true, message: approve ? "마일스톤을 승인했습니다." : "반려했습니다. 제안자가 수정 후 다시 제안할 수 있습니다." };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "처리에 실패했습니다." };
  }
}
