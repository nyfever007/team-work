"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { requireAdmin, requireUser } from "@/lib/auth/dal";
import { addDays, isValidKey, parseKey } from "@/lib/dates";
import { db, schema } from "@/lib/db";
import { LEAVE_TYPES, type LeaveType } from "@/lib/db/schema";
import { isWorkingDay, loadHolidays } from "@/lib/workdays";

export type LeaveFormState = { ok: true; message: string } | { ok: false; error: string } | undefined;

function revalidate() {
  revalidatePath("/schedule");
  revalidatePath("/");
  revalidatePath("/admin/members");
  revalidatePath("/team");
}

export async function addLeave(_prev: LeaveFormState, formData: FormData): Promise<LeaveFormState> {
  try {
    const user = await requireUser();
    const memberId = Number(formData.get("memberId"));
    const type = String(formData.get("type")) as LeaveType;
    const start = String(formData.get("start") ?? "");
    const end = String(formData.get("end") ?? start) || start;
    const note = String(formData.get("note") ?? "").trim().slice(0, 200);

    if (!Number.isInteger(memberId)) return { ok: false, error: "구성원을 선택하세요." };
    if (user.role !== "admin" && user.memberId !== memberId) {
      return { ok: false, error: "본인의 휴가만 등록할 수 있습니다." };
    }
    if (!LEAVE_TYPES.includes(type)) return { ok: false, error: "휴가 종류를 선택하세요." };
    if (!isValidKey(start) || !isValidKey(end)) return { ok: false, error: "날짜가 올바르지 않습니다." };
    if (parseKey(end) < parseKey(start)) return { ok: false, error: "종료일이 시작일보다 빠릅니다." };
    const span = (parseKey(end).getTime() - parseKey(start).getTime()) / 86_400_000 + 1;
    if (span > 31) return { ok: false, error: "한 번에 최대 31일까지 등록할 수 있습니다." };
    if (span > 1 && (type === "half_am" || type === "half_pm")) {
      return { ok: false, error: "반차는 하루만 선택할 수 있습니다." };
    }

    const holidays = loadHolidays(start, end);
    let added = 0;
    let skipped = 0;
    db.transaction((tx) => {
      for (let d = start; parseKey(d) <= parseKey(end); d = addDays(d, 1)) {
        if (span > 1 && !isWorkingDay(d, holidays)) {
          skipped++;
          continue;
        }
        const r = tx
          .insert(schema.leaves)
          .values({ memberId, date: d, type, note })
          .onConflictDoUpdate({
            target: [schema.leaves.memberId, schema.leaves.date],
            set: { type, note },
          })
          .run();
        if (r.changes > 0) added++;
      }
    });

    revalidate();
    const skippedMsg = skipped ? ` (주말·휴무일 ${skipped}일 제외)` : "";
    return { ok: true, message: `${added}일 등록했습니다.${skippedMsg}` };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "등록에 실패했습니다." };
  }
}

export async function deleteLeave(id: number): Promise<{ ok: boolean; error?: string }> {
  try {
    const user = await requireUser();
    const row = db.select().from(schema.leaves).where(eq(schema.leaves.id, id)).get();
    if (!row) return { ok: false, error: "이미 삭제된 항목입니다." };
    if (user.role !== "admin" && user.memberId !== row.memberId) {
      return { ok: false, error: "본인의 휴가만 삭제할 수 있습니다." };
    }
    db.delete(schema.leaves).where(eq(schema.leaves.id, id)).run();
    revalidate();
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "삭제에 실패했습니다." };
  }
}

export async function addHoliday(_prev: LeaveFormState, formData: FormData): Promise<LeaveFormState> {
  try {
    await requireAdmin();
    const date = String(formData.get("date") ?? "");
    const name = String(formData.get("name") ?? "").trim().slice(0, 50);
    if (!isValidKey(date)) return { ok: false, error: "날짜가 올바르지 않습니다." };
    if (!name) return { ok: false, error: "휴무일 이름을 입력하세요." };
    db.insert(schema.holidays)
      .values({ date, name })
      .onConflictDoUpdate({ target: schema.holidays.date, set: { name } })
      .run();
    revalidate();
    return { ok: true, message: "휴무일을 등록했습니다." };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "등록에 실패했습니다." };
  }
}

export async function deleteHoliday(id: number): Promise<{ ok: boolean; error?: string }> {
  try {
    await requireAdmin();
    db.delete(schema.holidays).where(eq(schema.holidays.id, id)).run();
    revalidate();
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "삭제에 실패했습니다." };
  }
}
