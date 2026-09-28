"use server";

import { and, eq, inArray } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth/dal";
import { isValidKey, todayKey } from "@/lib/dates";
import { db, schema } from "@/lib/db";
import { allMembers } from "@/lib/members/queries";
import { formatDays } from "@/lib/requests/calc";
import { compGrantById } from "./comp";

export type CompGrantState = { ok: true; message: string } | { ok: false; error: string } | undefined;

function revalidate() {
  // Balances show on 오늘, 휴가 현황, 구성원 tables and the request form.
  revalidatePath("/", "layout");
}

/** Days must be positive and in 0.5 steps (반일 단위). */
function parseDays(raw: FormDataEntryValue | null) {
  const n = Number(String(raw ?? "").trim());
  return Number.isFinite(n) && n > 0 && n <= 365 && Number.isInteger(n * 2) ? n : null;
}

function readFields(formData: FormData) {
  return {
    title: String(formData.get("title") ?? "").trim(),
    description: String(formData.get("description") ?? "").replace(/\r\n/g, "\n").trim(),
    days: parseDays(formData.get("days")),
    grantedOn: String(formData.get("grantedOn") ?? "") || todayKey(),
  };
}

function validate(f: ReturnType<typeof readFields>): string | null {
  if (!f.title) return "보상휴가 제목을 입력하세요.";
  if (f.title.length > 100) return "제목은 100자 이내로 입력하세요.";
  if (f.description.length > 1000) return "설명은 1000자 이내로 입력하세요.";
  if (f.days == null) return "보상휴가 일수는 0.5일 단위의 양수로 입력하세요.";
  if (!isValidKey(f.grantedOn)) return "지급일이 올바르지 않습니다.";
  return null;
}

/** Admin grants the same 보상휴가 (title/설명/일수) to one or more members: one row per member. */
export async function grantCompLeave(_prev: CompGrantState, formData: FormData): Promise<CompGrantState> {
  try {
    const user = await requireAdmin();
    const f = readFields(formData);
    const err = validate(f);
    if (err) return { ok: false, error: err };
    const ids = [...new Set(formData.getAll("memberIds").map(Number).filter(Number.isInteger))];
    const known = new Set(allMembers().map((m) => m.id));
    const memberIds = ids.filter((id) => known.has(id));
    if (memberIds.length === 0) return { ok: false, error: "지급할 구성원을 선택하세요." };
    db.insert(schema.compLeaveGrants)
      .values(memberIds.map((memberId) => ({ memberId, title: f.title, description: f.description, days: f.days!, grantedOn: f.grantedOn, createdBy: user.id })))
      .run();
    revalidate();
    return { ok: true, message: `${memberIds.length}명에게 보상휴가 ${formatDays(f.days!)}일을 지급했습니다.` };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "지급에 실패했습니다." };
  }
}

/** Edit a grant. Days can't go below what is already used or waiting for approval. */
export async function updateCompGrant(id: number, _prev: CompGrantState, formData: FormData): Promise<CompGrantState> {
  try {
    await requireAdmin();
    const grant = compGrantById(id);
    if (!grant) return { ok: false, error: "보상휴가를 찾을 수 없습니다." };
    const f = readFields(formData);
    const err = validate(f);
    if (err) return { ok: false, error: err };
    const held = grant.used + grant.pending;
    if (f.days! < held) return { ok: false, error: `이미 사용했거나 승인 대기 중인 ${formatDays(held)}일보다 적게 줄일 수 없습니다.` };
    db.update(schema.compLeaveGrants)
      .set({ title: f.title, description: f.description, days: f.days!, grantedOn: f.grantedOn, updatedAt: new Date() })
      .where(eq(schema.compLeaveGrants.id, id))
      .run();
    revalidate();
    return { ok: true, message: "보상휴가를 수정했습니다." };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "수정에 실패했습니다." };
  }
}

/** Delete a grant that no pending/approved request uses (cancel or reject those first). */
export async function deleteCompGrant(id: number): Promise<{ ok: boolean; error?: string }> {
  try {
    await requireAdmin();
    const live = db
      .select({ docNo: schema.leaveRequests.docNo })
      .from(schema.leaveRequests)
      .where(and(eq(schema.leaveRequests.compGrantId, id), inArray(schema.leaveRequests.status, ["submitted", "approved"])))
      .all();
    if (live.length) return { ok: false, error: `이 보상휴가를 사용한 품의서가 있어 삭제할 수 없습니다: ${live.map((r) => r.docNo).join(", ")}` };
    db.delete(schema.compLeaveGrants).where(eq(schema.compLeaveGrants.id, id)).run();
    revalidate();
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "삭제에 실패했습니다." };
  }
}
