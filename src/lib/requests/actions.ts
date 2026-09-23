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
import { requestAccess, requestById } from "./queries";

export type RequestFormState = { ok: true; id: number } | { ok: false; error: string; values?: Record<string, string> } | undefined;

function revalidate() {
  revalidatePath("/schedule");
  revalidatePath("/schedule/requests");
  revalidatePath("/my/today");
  revalidatePath("/team");
  revalidatePath("/admin/members");
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

    // Refuse overlap with existing leave on any of those dates.
    const clash = db.select({ date: schema.leaves.date }).from(schema.leaves).where(and(eq(schema.leaves.memberId, memberId), inArray(schema.leaves.date, dates))).all();
    if (clash.length) return { ok: false, error: `이미 휴가가 등록된 날짜가 있습니다: ${clash.map((c) => c.date).join(", ")}`, values: raw };

    const today = todayKey();
    const days = requestDays(type, dates);
    const cost = requestAnnualCost(type, dates);
    // Balance is evaluated in the leave year that contains the requested start date.
    const bal = leaveBalance(member, start);
    if (leaveYear(member.joinedAt, end).start !== bal.period.start) return { ok: false, error: `신청 기간이 연차 연도를 넘어갑니다. ${bal.period.end}까지와 그 이후를 나눠 신청하세요.`, values: raw };
    const usedDays = bal.annual.used + cost;
    const totalDays = bal.annual.accrued; // available this year (first year accrues monthly)
    const remainingDays = totalDays - usedDays;
    if (cost > 0 && remainingDays < 0) return { ok: false, error: `잔여 연차가 부족합니다. (연차 연도 ${bal.period.start} ~ ${bal.period.end}, 잔여 ${bal.annual.remaining}일, 신청 ${cost}일)`, values: raw };
    if (type === "sick" && bal.sick.used + days > bal.sick.allowance) return { ok: false, error: `병가 잔여일수가 부족합니다. (연차 연도 ${bal.period.start} ~ ${bal.period.end}, 잔여 ${bal.sick.remaining}일, 신청 ${days}일)`, values: raw };

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
        })
        .run();
      const requestId = Number(r.lastInsertRowid);
      tx.insert(schema.leaves)
        .values(dates.map((date) => ({ memberId, date, type, note: raw.reason.slice(0, 60), requestId })))
        .run();
      return requestId;
    });
    revalidate();
    return { ok: true, id };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "저장에 실패했습니다.", values: raw };
  }
}

/** Cancel a request: removes its calendar entries, keeps the document with status 취소. */
export async function cancelLeaveRequest(id: number): Promise<{ ok: boolean; error?: string }> {
  try {
    const user = await requireUser();
    const req = requestById(id);
    if (!req) return { ok: false, error: "품의서를 찾을 수 없습니다." };
    if (!requestAccess(user).canCancel(req)) return { ok: false, error: "취소 권한이 없습니다." };
    if (req.status === "cancelled") return { ok: false, error: "이미 취소된 품의서입니다." };
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

