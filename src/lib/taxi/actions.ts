"use server";

import { eq, like } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth/dal";
import { isValidKey, todayKey } from "@/lib/dates";
import { db, schema } from "@/lib/db";
import { isRetention } from "@/lib/general/types";
import { memberById } from "@/lib/members/queries";
import { requestAccess } from "@/lib/requests/queries";
import { taxiById } from "./queries";

export type TaxiFormState = { ok: true; id: number; approved: boolean } | { ok: false; error: string; values?: Record<string, string> } | undefined;
export type TaxiResult = { ok: true; message: string } | { ok: false; error: string };

function revalidate() {
  revalidatePath("/", "layout");
}

function nextDocNo(teamName: string, date: string) {
  const prefix = `${teamName}-T-${date.replace(/-/g, "")}-`;
  const n = db.select({ id: schema.taxiRequests.id }).from(schema.taxiRequests).where(like(schema.taxiRequests.docNo, `${prefix}%`)).all().length;
  return `${prefix}${n + 1}`;
}

const FIELDS = ["memberId", "reason", "useStart", "useEnd", "amount", "account", "attachment", "retention"] as const;

export async function createTaxiRequest(_prev: TaxiFormState, formData: FormData): Promise<TaxiFormState> {
  const raw = Object.fromEntries(FIELDS.map((k) => [k, String(formData.get(k) ?? "").replace(/\r\n/g, "\n").trim()])) as Record<(typeof FIELDS)[number], string>;
  const fail = (error: string): TaxiFormState => ({ ok: false, error, values: raw });
  try {
    const user = await requireUser();
    const access = requestAccess(user);
    const memberId = Number(raw.memberId) || access.me?.id;
    if (!memberId) return fail("구성원과 연결된 계정만 품의할 수 있습니다.");
    if (!access.canCreateFor(memberId)) return fail("본인 품의서만 작성할 수 있습니다.");
    const member = memberById(memberId);
    if (!member) return fail("구성원을 찾을 수 없습니다.");

    if (!raw.reason) return fail("지급 요청 사유를 입력하세요.");
    if ([raw.reason, raw.account, raw.attachment].some((v) => v.length > 500)) return fail("입력이 너무 깁니다.");
    const end = raw.useEnd || raw.useStart;
    if (!isValidKey(raw.useStart) || !isValidKey(end)) return fail("이용 기간을 선택하세요.");
    if (end < raw.useStart) return fail("이용 기간의 종료일이 시작일보다 빠릅니다.");
    if (raw.useStart > todayKey()) return fail("이용 기간은 오늘 이전이어야 합니다. 이미 이용한 택시비를 청구해 주세요.");
    const amount = Number(raw.amount.replace(/[,\s원]/g, ""));
    if (!raw.amount || !Number.isInteger(amount) || amount <= 0 || amount > 100_000_000) return fail("총 이용 금액을 원 단위 숫자로 입력하세요.");
    const retention = Number(raw.retention || "3");
    if (!isRetention(retention)) return fail("보존기간을 선택하세요.");

    const today = todayKey();
    const autoApprove = access.autoApproves(memberId); // admin on behalf, or a team leader filing their own
    const r = db
      .insert(schema.taxiRequests)
      .values({
        docNo: nextDocNo(member.team, today),
        memberId,
        reason: raw.reason,
        useStart: raw.useStart,
        useEnd: end,
        amount,
        account: raw.account,
        attachment: raw.attachment,
        retention,
        writtenAt: today,
        teamName: member.team,
        position: member.rank || member.position,
        memberName: member.name,
        createdBy: user.id,
        ...(autoApprove ? { status: "approved" as const, decidedByName: user.name, decidedAt: new Date() } : {}),
      })
      .run();
    revalidate();
    return { ok: true, id: Number(r.lastInsertRowid), approved: autoApprove };
  } catch (e) {
    return fail(e instanceof Error ? e.message : "저장에 실패했습니다.");
  }
}

export async function decideTaxiRequest(id: number, decision: "approve" | "reject", note = ""): Promise<TaxiResult> {
  try {
    const user = await requireUser();
    const req = taxiById(id);
    if (!req) return { ok: false, error: "품의서를 찾을 수 없습니다." };
    if (!requestAccess(user).canApprove(req)) return { ok: false, error: "이 품의서를 승인할 권한이 없습니다." };
    if (req.status !== "submitted") return { ok: false, error: "승인 대기 중인 품의서가 아닙니다." };
    const reason = note.replace(/\r\n/g, "\n").trim();
    if (decision === "reject" && !reason) return { ok: false, error: "반려 사유를 입력하세요." };
    if (reason.length > 500) return { ok: false, error: "사유는 500자 이내로 입력하세요." };
    const now = new Date();
    db.update(schema.taxiRequests)
      .set({ status: decision === "approve" ? "approved" : "rejected", decidedByName: user.name, decidedAt: now, decisionNote: reason, updatedAt: now })
      .where(eq(schema.taxiRequests.id, id))
      .run();
    revalidate();
    return { ok: true, message: decision === "approve" ? "택시비 지급 품의를 승인했습니다." : "반려했습니다. 작성자에게 사유가 표시됩니다." };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "처리에 실패했습니다." };
  }
}

export async function cancelTaxiRequest(id: number): Promise<{ ok: boolean; error?: string }> {
  try {
    const user = await requireUser();
    const req = taxiById(id);
    if (!req) return { ok: false, error: "품의서를 찾을 수 없습니다." };
    if (!requestAccess(user).canCancel(req)) return { ok: false, error: "취소 권한이 없습니다." };
    if (req.status !== "submitted" && req.status !== "approved") return { ok: false, error: "취소할 수 없는 상태입니다." };
    db.update(schema.taxiRequests).set({ status: "cancelled", updatedAt: new Date() }).where(eq(schema.taxiRequests.id, id)).run();
    revalidate();
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "취소에 실패했습니다." };
  }
}
