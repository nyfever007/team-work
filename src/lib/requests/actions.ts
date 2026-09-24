"use server";

import { and, eq, inArray, like } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth/dal";
import { isValidKey, parseKey, todayKey } from "@/lib/dates";
import { db, schema } from "@/lib/db";
import { LEAVE_TYPES, REASON_REQUIRED_TYPES, SINGLE_DAY_TYPES, type LeaveType } from "@/lib/leaves/types";
import { memberById } from "@/lib/members/queries";
import { loadHolidays } from "@/lib/workdays";
import { leaveBalance } from "@/lib/leaves/balance";
import { leaveYear } from "@/lib/leaves/policy";
import { requestAnnualCost, requestDates, requestDays } from "./calc";
import { overlappingPending, pendingUsage, requestAccess, requestById } from "./queries";

export type RequestFormState = { ok: true; id: number; approved: boolean } | { ok: false; error: string; values?: Record<string, string> } | undefined;

function revalidate() {
  // Pending approvals show on 오늘 and in header/tab badges; calendars change on approval.
  revalidatePath("/", "layout");
}

function nextDocNo(teamName: string, date: string) {
  const prefix = `${teamName}-${date.replace(/-/g, "")}-`;
  const n = db.select({ id: schema.leaveRequests.id }).from(schema.leaveRequests).where(like(schema.leaveRequests.docNo, `${prefix}%`)).all().length;
  return `${prefix}${n + 1}`;
}

export async function createLeaveRequest(_prev: RequestFormState, formData: FormData): Promise<RequestFormState> {
  const raw = {
    memberId: String(formData.get("memberId") ?? ""),
    type: String(formData.get("type") ?? ""),
    startDate: String(formData.get("startDate") ?? ""),
    endDate: String(formData.get("endDate") ?? ""),
    reason: String(formData.get("reason") ?? "").replace(/\r\n/g, "\n").trim(),
    delegate: String(formData.get("delegate") ?? "").trim(),
    contact: String(formData.get("contact") ?? "").trim(),
  };
  try {
    const user = await requireUser();
    const access = requestAccess(user);
    const memberId = Number(raw.memberId) || access.me?.id;
    if (!memberId) return { ok: false, error: "구성원과 연결된 계정만 품의서를 작성할 수 있습니다.", values: raw };
    if (!access.canCreateFor(memberId)) return { ok: false, error: "본인 품의서만 작성할 수 있습니다.", values: raw };
    const member = memberById(memberId);
    if (!member) return { ok: false, error: "구성원을 찾을 수 없습니다.", values: raw };

    const type = raw.type as LeaveType;
    if (!LEAVE_TYPES.includes(type)) return { ok: false, error: "구분을 선택하세요.", values: raw };
    const start = raw.startDate;
    const end = SINGLE_DAY_TYPES.includes(type) ? start : raw.endDate || start;
    if (!isValidKey(start) || !isValidKey(end)) return { ok: false, error: "신청일자를 입력하세요.", values: raw };
    if (parseKey(end) < parseKey(start)) return { ok: false, error: "종료일이 시작일보다 빠릅니다.", values: raw };
    if ((parseKey(end).getTime() - parseKey(start).getTime()) / 86_400_000 > 60) return { ok: false, error: "한 번에 60일까지 신청할 수 있습니다.", values: raw };
    if (REASON_REQUIRED_TYPES.includes(type) && !raw.reason) return { ok: false, error: "이 구분은 사유를 상세히 기재해야 합니다.", values: raw };
    if (raw.reason.length > 1000 || raw.delegate.length > 100 || raw.contact.length > 100) return { ok: false, error: "입력이 너무 깁니다.", values: raw };

    const holidays = new Set(loadHolidays(start, end).keys());
    const dates = requestDates(type, start, end, holidays);
    if (dates.length === 0) return { ok: false, error: "선택한 기간에 근무일이 없습니다.", values: raw };

    // Refuse overlap with existing leave, or with another request still waiting for approval.
    const clash = db.select({ date: schema.leaves.date }).from(schema.leaves).where(and(eq(schema.leaves.memberId, memberId), inArray(schema.leaves.date, dates))).all();
    if (clash.length) return { ok: false, error: `이미 휴가가 등록된 날짜가 있습니다: ${clash.map((c) => c.date).join(", ")}`, values: raw };
    const waiting = overlappingPending(memberId, start, end);
    if (waiting.length) return { ok: false, error: `승인 대기 중인 품의서와 기간이 겹칩니다: ${waiting.map((w) => w.docNo).join(", ")}`, values: raw };

    const today = todayKey();
    const days = requestDays(type, dates);
    const cost = requestAnnualCost(type, dates);
    // Balance is evaluated in the leave year that contains the requested start date.
    const bal = leaveBalance(member, start);
    if (leaveYear(member.joinedAt, end).start !== bal.period.start) return { ok: false, error: `신청 기간이 연차 연도를 넘어갑니다. ${bal.period.end}까지와 그 이후를 나눠 신청하세요.`, values: raw };
    const usedDays = bal.annual.used + cost;
    const totalDays = bal.annual.accrued; // available this year (first year accrues monthly)
    const remainingDays = totalDays - usedDays;
    // Days held by other pending requests count against the balance too, so nobody over-books while waiting.
    const held = pendingUsage(memberId, bal.period.start, bal.period.end);
    const heldNote = (n: number) => (n > 0 ? `, 승인 대기 ${n}일` : "");
    if (cost > 0 && remainingDays - held.annual < 0) return { ok: false, error: `잔여 연차가 부족합니다. (연차 연도 ${bal.period.start} ~ ${bal.period.end}, 잔여 ${bal.annual.remaining}일${heldNote(held.annual)}, 신청 ${cost}일)`, values: raw };
    if (type === "sick" && bal.sick.used + held.sick + days > bal.sick.allowance) return { ok: false, error: `병가 잔여일수가 부족합니다. (연차 연도 ${bal.period.start} ~ ${bal.period.end}, 잔여 ${bal.sick.remaining}일${heldNote(held.sick)}, 신청 ${days}일)`, values: raw };

    // Filed by someone who may approve it (admin on behalf of a member): approved immediately.
    const autoApprove = access.autoApproves(memberId); // admin on behalf, or a team leader filing their own
    const now = new Date();

    const id = db.transaction((tx) => {
      const r = tx
        .insert(schema.leaveRequests)
        .values({
          docNo: nextDocNo(member.team, today),
          memberId,
          type,
          startDate: start,
          endDate: end,
          days,
          reason: raw.reason,
          delegate: raw.delegate,
          contact: raw.contact,
          writtenAt: today,
          teamName: member.team,
          position: member.rank || member.position,
          memberName: member.name,
          usedDays,
          totalDays,
          remainingDays,
          createdBy: user.id,
          ...(autoApprove ? { status: "approved" as const, decidedByName: user.name, decidedAt: now } : {}),
        })
        .run();
      const requestId = Number(r.lastInsertRowid);
      if (autoApprove) {
        tx.insert(schema.leaves)
          .values(dates.map((date) => ({ memberId, date, type, note: raw.reason.slice(0, 60), requestId })))
          .run();
      }
      return requestId;
    });
    revalidate();
    return { ok: true, id, approved: autoApprove };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "저장에 실패했습니다.", values: raw };
  }
}

/**
 * Team leader (or admin) decides a pending request. Approving re-checks clashes and balance as of now,
 * refreshes the printed snapshot and writes the calendar rows; rejecting needs a reason for the requester.
 */
export async function decideLeaveRequest(id: number, decision: "approve" | "reject", note = ""): Promise<{ ok: true; message: string } | { ok: false; error: string }> {
  try {
    const user = await requireUser();
    const req = requestById(id);
    if (!req) return { ok: false, error: "품의서를 찾을 수 없습니다." };
    if (!requestAccess(user).canApprove(req)) return { ok: false, error: "이 품의서를 승인할 권한이 없습니다." };
    if (req.status !== "submitted") return { ok: false, error: "승인 대기 중인 품의서가 아닙니다." };
    const reason = note.replace(/\r\n/g, "\n").trim();
    if (reason.length > 500) return { ok: false, error: "사유는 500자 이내로 입력하세요." };
    const now = new Date();

    if (decision === "reject") {
      if (!reason) return { ok: false, error: "반려 사유를 입력하세요." };
      db.update(schema.leaveRequests).set({ status: "rejected", decidedByName: user.name, decidedAt: now, decisionNote: reason, updatedAt: now }).where(eq(schema.leaveRequests.id, id)).run();
      revalidate();
      return { ok: true, message: "반려했습니다. 신청자에게 사유가 표시됩니다." };
    }

    const member = memberById(req.memberId);
    if (!member) return { ok: false, error: "구성원을 찾을 수 없습니다." };
    const dates = requestDates(req.type, req.startDate, req.endDate, new Set(loadHolidays(req.startDate, req.endDate).keys()));
    if (dates.length === 0) return { ok: false, error: "신청 기간에 근무일이 없습니다. 반려 후 다시 신청하도록 안내해 주세요." };
    const clash = db.select({ date: schema.leaves.date }).from(schema.leaves).where(and(eq(schema.leaves.memberId, req.memberId), inArray(schema.leaves.date, dates))).all();
    if (clash.length) return { ok: false, error: `그 사이 휴가가 등록된 날짜가 있습니다: ${clash.map((c) => c.date).join(", ")}` };
    const bal = leaveBalance(member, req.startDate);
    const cost = requestAnnualCost(req.type, dates);
    const usedDays = bal.annual.used + cost;
    if (cost > 0 && bal.annual.accrued - usedDays < 0) return { ok: false, error: `잔여 연차가 부족합니다. (잔여 ${bal.annual.remaining}일, 신청 ${cost}일)` };

    db.transaction((tx) => {
      tx.update(schema.leaveRequests)
        .set({ status: "approved", decidedByName: user.name, decidedAt: now, decisionNote: reason, usedDays, totalDays: bal.annual.accrued, remainingDays: bal.annual.accrued - usedDays, days: requestDays(req.type, dates), updatedAt: now })
        .where(eq(schema.leaveRequests.id, id))
        .run();
      tx.insert(schema.leaves)
        .values(dates.map((date) => ({ memberId: req.memberId, date, type: req.type, note: req.reason.slice(0, 60), requestId: id })))
        .run();
    });
    revalidate();
    return { ok: true, message: "승인했습니다. 달력에 반영되었습니다." };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "처리에 실패했습니다." };
  }
}

/** Cancel a request: removes its calendar entries (if approved), keeps the document with status 취소. */
export async function cancelLeaveRequest(id: number): Promise<{ ok: boolean; error?: string }> {
  try {
    const user = await requireUser();
    const req = requestById(id);
    if (!req) return { ok: false, error: "품의서를 찾을 수 없습니다." };
    if (!requestAccess(user).canCancel(req)) return { ok: false, error: "취소 권한이 없습니다." };
    if (req.status === "cancelled") return { ok: false, error: "이미 취소된 품의서입니다." };
    if (req.status === "rejected") return { ok: false, error: "반려된 품의서는 취소할 수 없습니다." };
    db.transaction((tx) => {
      tx.delete(schema.leaves).where(eq(schema.leaves.requestId, id)).run();
      tx.update(schema.leaveRequests).set({ status: "cancelled", updatedAt: new Date() }).where(eq(schema.leaveRequests.id, id)).run();
    });
    revalidate();
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "취소에 실패했습니다." };
  }
}

