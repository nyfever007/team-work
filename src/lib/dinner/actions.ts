"use server";

import { eq, like } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth/dal";
import { isValidKey, todayKey } from "@/lib/dates";
import { db, schema } from "@/lib/db";
import { isRetention } from "@/lib/general/types";
import { memberById } from "@/lib/members/queries";
import { requestAccess } from "@/lib/requests/queries";
import { canUseDinner } from "./access";
import { dinnerById, liveSettleOf } from "./queries";
import { DINNER_LIMIT_PER_PERSON, DINNER_STAGE_LABEL, headcountNumber, type DinnerStage } from "./types";

export type DinnerFormState = { ok: true; id: number; approved: boolean } | { ok: false; error: string; values?: Record<string, string> } | undefined;
export type DinnerResult = { ok: true; message: string } | { ok: false; error: string };

function revalidate() {
  revalidatePath("/", "layout");
}

function nextDocNo(teamName: string, stage: DinnerStage, date: string) {
  const prefix = `${teamName}-${stage === "budget" ? "D" : "DS"}-${date.replace(/-/g, "")}-`;
  const n = db.select({ id: schema.dinnerRequests.id }).from(schema.dinnerRequests).where(like(schema.dinnerRequests.docNo, `${prefix}%`)).all().length;
  return `${prefix}${n + 1}`;
}

const read = (formData: FormData, keys: readonly string[]) => Object.fromEntries(keys.map((k) => [k, String(formData.get(k) ?? "").replace(/\r\n/g, "\n").trim()])) as Record<string, string>;

/** Step 1 — 회식비 전산품의. */
export async function createDinnerBudget(_prev: DinnerFormState, formData: FormData): Promise<DinnerFormState> {
  const raw = read(formData, ["memberId", "headcount", "amount", "payMethod", "retention"]);
  const fail = (error: string): DinnerFormState => ({ ok: false, error, values: raw });
  try {
    const user = await requireUser();
    const access = requestAccess(user);
    const memberId = Number(raw.memberId) || access.me?.id;
    if (!memberId) return fail("구성원과 연결된 계정만 품의할 수 있습니다.");
    if (!access.canCreateFor(memberId)) return fail("본인 품의서만 작성할 수 있습니다.");
    const member = memberById(memberId);
    if (!member) return fail("구성원을 찾을 수 없습니다.");
    if (!canUseDinner(user) || !member.isLeader) return fail("회식비 품의는 팀장만 올릴 수 있습니다.");

    const people = headcountNumber(raw.headcount);
    if (!raw.headcount || !people) return fail("인원을 숫자와 함께 입력하세요. 예: 4명 (A, B, C, D)");
    const amount = Number(raw.amount.replace(/[,\s원]/g, ""));
    if (!raw.amount || !Number.isInteger(amount) || amount <= 0) return fail("금액을 원 단위 숫자로 입력하세요.");
    if (amount > people * DINNER_LIMIT_PER_PERSON) return fail(`1인당 한도(${DINNER_LIMIT_PER_PERSON.toLocaleString("ko-KR")}원)를 넘습니다. ${people}명 기준 최대 ${(people * DINNER_LIMIT_PER_PERSON).toLocaleString("ko-KR")}원입니다.`);
    if (!raw.payMethod) return fail("법인카드 사용 여부 또는 현금 수령인을 입력하세요.");
    if ([raw.headcount, raw.payMethod].some((v) => v.length > 300)) return fail("입력이 너무 깁니다.");
    const retention = Number(raw.retention || "3");
    if (!isRetention(retention)) return fail("보존기간을 선택하세요.");

    const today = todayKey();
    const autoApprove = access.autoApproves(memberId); // admin on behalf, or a team leader filing their own
    const r = db
      .insert(schema.dinnerRequests)
      .values({
        stage: "budget",
        docNo: nextDocNo(member.team, "budget", today),
        memberId,
        headcount: raw.headcount,
        limitPerPerson: DINNER_LIMIT_PER_PERSON,
        amount,
        payMethod: raw.payMethod,
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

/** Step 2 — 회식비 청구(정산)품의, from an approved 전산. Copies 인원/한도/금액/결제 방식; adds 시기 + 지급계좌. */
export async function createDinnerSettle(budgetId: number, _prev: DinnerFormState, formData: FormData): Promise<DinnerFormState> {
  const raw = read(formData, ["dinnerDate", "account", "retention"]);
  const fail = (error: string): DinnerFormState => ({ ok: false, error, values: raw });
  try {
    const user = await requireUser();
    const access = requestAccess(user);
    if (!canUseDinner(user)) return fail("회식비 품의는 팀장만 올릴 수 있습니다.");
    const budget = dinnerById(budgetId);
    if (!budget || budget.stage !== "budget") return fail("회식비 전산품의를 찾을 수 없습니다.");
    if (!access.canCreateFor(budget.memberId)) return fail("본인 품의서만 작성할 수 있습니다.");
    if (budget.status !== "approved") return fail("승인된 회식비 전산품의로만 청구할 수 있습니다.");
    const existing = liveSettleOf(budget.id);
    if (existing) return fail(`이미 청구품의가 있습니다: ${existing.docNo}`);
    const member = memberById(budget.memberId);
    if (!member) return fail("구성원을 찾을 수 없습니다.");
    if (!isValidKey(raw.dinnerDate)) return fail("회식한 날짜(시기)를 선택하세요.");
    if (raw.dinnerDate > todayKey()) return fail("회식 후에 청구해 주세요. 시기는 오늘 이전이어야 합니다.");
    if (raw.account.length > 300) return fail("입력이 너무 깁니다.");
    const retention = Number(raw.retention || String(budget.retention));
    if (!isRetention(retention)) return fail("보존기간을 선택하세요.");

    const today = todayKey();
    const autoApprove = access.autoApproves(budget.memberId);
    const r = db
      .insert(schema.dinnerRequests)
      .values({
        stage: "settle",
        parentId: budget.id,
        docNo: nextDocNo(member.team, "settle", today),
        memberId: budget.memberId,
        headcount: budget.headcount,
        limitPerPerson: budget.limitPerPerson,
        amount: budget.amount,
        payMethod: budget.payMethod,
        dinnerDate: raw.dinnerDate,
        account: raw.account,
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

export async function decideDinnerRequest(id: number, decision: "approve" | "reject", note = ""): Promise<DinnerResult> {
  try {
    const user = await requireUser();
    const req = dinnerById(id);
    if (!req) return { ok: false, error: "품의서를 찾을 수 없습니다." };
    if (!requestAccess(user).canApprove(req)) return { ok: false, error: "이 품의서를 승인할 권한이 없습니다." };
    if (req.status !== "submitted") return { ok: false, error: "승인 대기 중인 품의서가 아닙니다." };
    const reason = note.replace(/\r\n/g, "\n").trim();
    if (decision === "reject" && !reason) return { ok: false, error: "반려 사유를 입력하세요." };
    if (reason.length > 500) return { ok: false, error: "사유는 500자 이내로 입력하세요." };
    const now = new Date();
    db.update(schema.dinnerRequests)
      .set({ status: decision === "approve" ? "approved" : "rejected", decidedByName: user.name, decidedAt: now, decisionNote: reason, updatedAt: now })
      .where(eq(schema.dinnerRequests.id, id))
      .run();
    revalidate();
    const label = DINNER_STAGE_LABEL[req.stage];
    return { ok: true, message: decision === "approve" ? `${label}를 승인했습니다.${req.stage === "budget" ? " 회식 후 청구품의를 올릴 수 있습니다." : ""}` : "반려했습니다. 작성자에게 사유가 표시됩니다." };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "처리에 실패했습니다." };
  }
}

export async function cancelDinnerRequest(id: number): Promise<{ ok: boolean; error?: string }> {
  try {
    const user = await requireUser();
    const req = dinnerById(id);
    if (!req) return { ok: false, error: "품의서를 찾을 수 없습니다." };
    if (!requestAccess(user).canCancel(req)) return { ok: false, error: "취소 권한이 없습니다." };
    if (req.status !== "submitted" && req.status !== "approved") return { ok: false, error: "취소할 수 없는 상태입니다." };
    if (req.stage === "budget") {
      const settle = liveSettleOf(req.id);
      if (settle) return { ok: false, error: `연결된 청구품의(${settle.docNo})를 먼저 취소하세요.` };
    }
    db.update(schema.dinnerRequests).set({ status: "cancelled", updatedAt: new Date() }).where(eq(schema.dinnerRequests.id, id)).run();
    revalidate();
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "취소에 실패했습니다." };
  }
}
