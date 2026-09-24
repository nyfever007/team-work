"use server";

import { eq, like } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth/dal";
import { todayKey } from "@/lib/dates";
import { db, schema } from "@/lib/db";
import { memberById } from "@/lib/members/queries";
import { requestAccess } from "@/lib/requests/queries";
import { generalById } from "./queries";
import { VAT_MODES, isCurrency, isRetention, parseAmount, type VatMode } from "./types";

export type GeneralFormState = { ok: true; id: number; approved: boolean } | { ok: false; error: string; values?: Record<string, string> } | undefined;
export type GeneralResult = { ok: true; message: string } | { ok: false; error: string };

function revalidate() {
  revalidatePath("/", "layout");
}

function nextDocNo(teamName: string, date: string) {
  const prefix = `${teamName}-G-${date.replace(/-/g, "")}-`;
  const n = db.select({ id: schema.generalRequests.id }).from(schema.generalRequests).where(like(schema.generalRequests.docNo, `${prefix}%`)).all().length;
  return `${prefix}${n + 1}`;
}

const FIELDS = ["memberId", "title", "purpose", "vendor", "period", "timing", "amount", "currency", "vat", "account", "extra", "attachment", "retention"] as const;

export async function createGeneralRequest(_prev: GeneralFormState, formData: FormData): Promise<GeneralFormState> {
  const raw = Object.fromEntries(FIELDS.map((k) => [k, String(formData.get(k) ?? "").replace(/\r\n/g, "\n").trim()])) as Record<(typeof FIELDS)[number], string>;
  const fail = (error: string): GeneralFormState => ({ ok: false, error, values: raw });
  try {
    const user = await requireUser();
    const access = requestAccess(user);
    const memberId = Number(raw.memberId) || access.me?.id;
    if (!memberId) return fail("구성원과 연결된 계정만 품의할 수 있습니다.");
    if (!access.canCreateFor(memberId)) return fail("본인 품의서만 작성할 수 있습니다.");
    const member = memberById(memberId);
    if (!member) return fail("구성원을 찾을 수 없습니다.");

    if (!raw.title) return fail("제목을 입력하세요.");
    if (!raw.purpose) return fail("목적을 입력하세요.");
    if (raw.title.length > 120) return fail("제목은 120자 이내로 입력하세요.");
    if ([raw.purpose, raw.vendor, raw.account, raw.attachment, raw.period, raw.timing].some((v) => v.length > 500) || raw.extra.length > 3000) return fail("입력이 너무 깁니다.");
    const currency = isCurrency(raw.currency) ? raw.currency : "KRW";
    const amount = parseAmount(raw.amount, currency);
    if (amount != null && (!Number.isFinite(amount) || amount < 0 || amount > 10_000_000_000_000)) return fail(currency === "KRW" || currency === "JPY" ? "금액은 숫자로 입력하세요." : "금액은 숫자로 입력하세요. 소수점은 둘째 자리까지 가능합니다.");
    const vat = (VAT_MODES as readonly string[]).includes(raw.vat) ? (raw.vat as VatMode) : "included";
    const retention = Number(raw.retention);
    if (!isRetention(retention)) return fail("보존기간을 선택하세요.");

    const today = todayKey();
    const autoApprove = access.autoApproves(memberId); // admin on behalf, or a team leader filing their own
    const r = db
      .insert(schema.generalRequests)
      .values({
        docNo: nextDocNo(member.team, today),
        memberId,
        title: raw.title,
        purpose: raw.purpose,
        vendor: raw.vendor,
        period: raw.period,
        timing: raw.timing,
        amount,
        currency,
        vat,
        account: raw.account,
        extra: raw.extra,
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

export async function decideGeneralRequest(id: number, decision: "approve" | "reject", note = ""): Promise<GeneralResult> {
  try {
    const user = await requireUser();
    const req = generalById(id);
    if (!req) return { ok: false, error: "품의서를 찾을 수 없습니다." };
    if (!requestAccess(user).canApprove(req)) return { ok: false, error: "이 품의서를 승인할 권한이 없습니다." };
    if (req.status !== "submitted") return { ok: false, error: "승인 대기 중인 품의서가 아닙니다." };
    const reason = note.replace(/\r\n/g, "\n").trim();
    if (decision === "reject" && !reason) return { ok: false, error: "반려 사유를 입력하세요." };
    if (reason.length > 500) return { ok: false, error: "사유는 500자 이내로 입력하세요." };
    const now = new Date();
    db.update(schema.generalRequests)
      .set({ status: decision === "approve" ? "approved" : "rejected", decidedByName: user.name, decidedAt: now, decisionNote: reason, updatedAt: now })
      .where(eq(schema.generalRequests.id, id))
      .run();
    revalidate();
    return { ok: true, message: decision === "approve" ? "품의를 승인했습니다." : "반려했습니다. 작성자에게 사유가 표시됩니다." };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "처리에 실패했습니다." };
  }
}

export async function cancelGeneralRequest(id: number): Promise<{ ok: boolean; error?: string }> {
  try {
    const user = await requireUser();
    const req = generalById(id);
    if (!req) return { ok: false, error: "품의서를 찾을 수 없습니다." };
    if (!requestAccess(user).canCancel(req)) return { ok: false, error: "취소 권한이 없습니다." };
    if (req.status !== "submitted" && req.status !== "approved") return { ok: false, error: "취소할 수 없는 상태입니다." };
    db.update(schema.generalRequests).set({ status: "cancelled", updatedAt: new Date() }).where(eq(schema.generalRequests.id, id)).run();
    revalidate();
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "취소에 실패했습니다." };
  }
}
