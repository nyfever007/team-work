"use server";

import { and, eq, gt, inArray, like, lt } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth/dal";
import { todayKey } from "@/lib/dates";
import { db, schema } from "@/lib/db";
import { memberById } from "@/lib/members/queries";
import { requestAccess } from "@/lib/requests/queries";
import { overtimeById } from "./queries";
import { MAX_OVERTIME_HOURS, hoursBetween, isDateTime } from "./types";

export type OvertimeFormState = { ok: true; id: number; approved: boolean } | { ok: false; error: string; values?: Record<string, string> } | undefined;
export type OvertimeResult = { ok: true; message: string } | { ok: false; error: string };

function revalidate() {
  // Approval inbox, header badges and 품의 counts all read these rows.
  revalidatePath("/", "layout");
}

function nextDocNo(teamName: string, date: string) {
  const prefix = `${teamName}-OT-${date.replace(/-/g, "")}-`;
  const n = db.select({ id: schema.overtimeRequests.id }).from(schema.overtimeRequests).where(like(schema.overtimeRequests.docNo, `${prefix}%`)).all().length;
  return `${prefix}${n + 1}`;
}

export async function createOvertimeRequest(_prev: OvertimeFormState, formData: FormData): Promise<OvertimeFormState> {
  const raw = {
    memberId: String(formData.get("memberId") ?? ""),
    startDate: String(formData.get("startDate") ?? ""),
    startTime: String(formData.get("startTime") ?? ""),
    endDate: String(formData.get("endDate") ?? ""),
    endTime: String(formData.get("endTime") ?? ""),
    reason: String(formData.get("reason") ?? "").replace(/\r\n/g, "\n").trim(),
  };
  try {
    const user = await requireUser();
    const access = requestAccess(user);
    const memberId = Number(raw.memberId) || access.me?.id;
    if (!memberId) return { ok: false, error: "구성원과 연결된 계정만 신청할 수 있습니다.", values: raw };
    if (!access.canCreateFor(memberId)) return { ok: false, error: "본인 신청서만 작성할 수 있습니다.", values: raw };
    const member = memberById(memberId);
    if (!member) return { ok: false, error: "구성원을 찾을 수 없습니다.", values: raw };

    const startAt = `${raw.startDate}T${raw.startTime}`;
    const endAt = `${raw.endDate || raw.startDate}T${raw.endTime}`;
    if (!isDateTime(startAt) || !isDateTime(endAt)) return { ok: false, error: "시작·종료 날짜와 시간을 입력하세요.", values: raw };
    const hours = hoursBetween(startAt, endAt);
    if (hours <= 0) return { ok: false, error: "종료 시각이 시작 시각보다 늦어야 합니다.", values: raw };
    if (hours > MAX_OVERTIME_HOURS) return { ok: false, error: `한 번에 ${MAX_OVERTIME_HOURS}시간까지 신청할 수 있습니다. 나눠서 신청하세요.`, values: raw };
    if (!raw.reason) return { ok: false, error: "시간외 근무 신청 사유를 자세히 입력하세요.", values: raw };
    if (raw.reason.length > 2000) return { ok: false, error: "사유는 2000자 이내로 입력하세요.", values: raw };

    // Refuse overlap with another live (pending/approved) request of the same member.
    const clash = db
      .select({ docNo: schema.overtimeRequests.docNo })
      .from(schema.overtimeRequests)
      .where(and(eq(schema.overtimeRequests.memberId, memberId), inArray(schema.overtimeRequests.status, ["submitted", "approved"]), lt(schema.overtimeRequests.startAt, endAt), gt(schema.overtimeRequests.endAt, startAt)))
      .all();
    if (clash.length) return { ok: false, error: `시간이 겹치는 신청서가 있습니다: ${clash.map((c) => c.docNo).join(", ")}`, values: raw };

    const today = todayKey();
    const autoApprove = access.autoApproves(memberId); // admin on behalf, or a team leader filing their own
    const now = new Date();
    const r = db
      .insert(schema.overtimeRequests)
      .values({
        docNo: nextDocNo(member.team, today),
        memberId,
        startAt,
        endAt,
        hours,
        reason: raw.reason,
        writtenAt: today,
        teamName: member.team,
        position: member.rank || member.position,
        duty: member.position,
        memberName: member.name,
        createdBy: user.id,
        ...(autoApprove ? { status: "approved" as const, decidedByName: user.name, decidedAt: now } : {}),
      })
      .run();
    revalidate();
    return { ok: true, id: Number(r.lastInsertRowid), approved: autoApprove };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "저장에 실패했습니다.", values: raw };
  }
}

/** Team leader (or admin) decides a pending request. Rejecting needs a reason for the requester. */
export async function decideOvertimeRequest(id: number, decision: "approve" | "reject", note = ""): Promise<OvertimeResult> {
  try {
    const user = await requireUser();
    const req = overtimeById(id);
    if (!req) return { ok: false, error: "신청서를 찾을 수 없습니다." };
    if (!requestAccess(user).canApprove(req)) return { ok: false, error: "이 신청서를 승인할 권한이 없습니다." };
    if (req.status !== "submitted") return { ok: false, error: "승인 대기 중인 신청서가 아닙니다." };
    const reason = note.replace(/\r\n/g, "\n").trim();
    if (decision === "reject" && !reason) return { ok: false, error: "반려 사유를 입력하세요." };
    if (reason.length > 500) return { ok: false, error: "사유는 500자 이내로 입력하세요." };
    const now = new Date();
    db.update(schema.overtimeRequests)
      .set({ status: decision === "approve" ? "approved" : "rejected", decidedByName: user.name, decidedAt: now, decisionNote: reason, updatedAt: now })
      .where(eq(schema.overtimeRequests.id, id))
      .run();
    revalidate();
    return { ok: true, message: decision === "approve" ? "시간외 근무를 승인했습니다." : "반려했습니다. 신청자에게 사유가 표시됩니다." };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "처리에 실패했습니다." };
  }
}

/** Requester (or admin) withdraws a pending/approved request. The document stays with status 취소. */
export async function cancelOvertimeRequest(id: number): Promise<{ ok: boolean; error?: string }> {
  try {
    const user = await requireUser();
    const req = overtimeById(id);
    if (!req) return { ok: false, error: "신청서를 찾을 수 없습니다." };
    if (!requestAccess(user).canCancel(req)) return { ok: false, error: "취소 권한이 없습니다." };
    if (req.status !== "submitted" && req.status !== "approved") return { ok: false, error: "취소할 수 없는 상태입니다." };
    db.update(schema.overtimeRequests).set({ status: "cancelled", updatedAt: new Date() }).where(eq(schema.overtimeRequests.id, id)).run();
    revalidate();
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "취소에 실패했습니다." };
  }
}
