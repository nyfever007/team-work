"use server";

import { revalidatePath } from "next/cache";
import { requireMember } from "@/lib/auth/dal";
import { isValidKey, weekStartOf } from "@/lib/dates";
import { db, schema } from "@/lib/db";

export type SaveState = { ok: true; savedAt: number } | { ok: false; error: string } | undefined;

const MAX = 4000;

function readText(formData: FormData, name: string) {
  const v = String(formData.get(name) ?? "").replace(/\r\n/g, "\n").trimEnd();
  if (v.length > MAX) throw new Error(`${MAX}자 이내로 입력하세요.`);
  return v;
}

export async function saveDailyLog(
  date: string,
  field: "plan" | "done",
  _prev: SaveState,
  formData: FormData,
): Promise<SaveState> {
  try {
    const { memberId } = await requireMember();
    if (!isValidKey(date)) return { ok: false, error: "날짜가 올바르지 않습니다." };
    const text = readText(formData, "text");
    const now = new Date();
    const stamp = field === "plan" ? { planUpdatedAt: now } : { doneUpdatedAt: now };

    db.insert(schema.dailyLogs)
      .values({ memberId, date, [field]: text, ...stamp })
      .onConflictDoUpdate({
        target: [schema.dailyLogs.memberId, schema.dailyLogs.date],
        set: { [field]: text, ...stamp },
      })
      .run();

    revalidatePath("/");
    revalidatePath("/team");
    return { ok: true, savedAt: now.getTime() };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "저장에 실패했습니다." };
  }
}

export async function saveWeeklyReport(
  weekStart: string,
  field: "plan" | "result",
  _prev: SaveState,
  formData: FormData,
): Promise<SaveState> {
  try {
    const { memberId } = await requireMember();
    if (!isValidKey(weekStart) || weekStartOf(weekStart) !== weekStart) {
      return { ok: false, error: "주차가 올바르지 않습니다." };
    }
    const text = readText(formData, "text");
    const now = new Date();
    const stamp = field === "plan" ? { planUpdatedAt: now } : { resultUpdatedAt: now };

    db.insert(schema.weeklyReports)
      .values({ memberId, weekStart, [field]: text, ...stamp })
      .onConflictDoUpdate({
        target: [schema.weeklyReports.memberId, schema.weeklyReports.weekStart],
        set: { [field]: text, ...stamp },
      })
      .run();

    revalidatePath("/");
    revalidatePath("/team");
    return { ok: true, savedAt: now.getTime() };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "저장에 실패했습니다." };
  }
}
