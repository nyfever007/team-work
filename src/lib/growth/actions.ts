"use server";

import { and, eq, max } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { requireMember, requireUser } from "@/lib/auth/dal";
import { todayKey } from "@/lib/dates";
import { db, schema } from "@/lib/db";
import type { GrowthGoal } from "@/lib/db/schema";
import { currentPeriod, shiftPeriod } from "@/lib/evaluations/types";
import { memberById } from "@/lib/members/queries";
import { reviewerContext } from "@/lib/reviews/queries";
import { growthGoalById, growthGoalsFor } from "./queries";
import { GROWTH_MAX_PER_QUARTER, GROWTH_STATUSES, GROWTH_TEXT_MAX, GROWTH_TITLE_MAX, isQuarterKey, type GrowthStatus } from "./types";

export type GrowthResult = { ok: true; message: string } | { ok: false; error: string };
const fail = (e: unknown, fallback: string): GrowthResult => ({ ok: false, error: e instanceof Error ? e.message : fallback });

export type GrowthGoalInput = { title: string; plan: string };

function revalidate() {
  revalidatePath("/", "layout");
}

/** Goals can be planned up to the next quarter. */
function checkQuarter(q: unknown): string {
  if (!isQuarterKey(q)) throw new Error("분기가 올바르지 않습니다.");
  if (q > shiftPeriod(currentPeriod("quarter", todayKey()), 1)) throw new Error("다음 분기까지만 계획할 수 있습니다.");
  return q;
}

function clean(input: GrowthGoalInput): GrowthGoalInput {
  const title = String(input.title ?? "").replace(/\s+/g, " ").trim();
  if (!title) throw new Error("목표를 입력하세요.");
  if (title.length > GROWTH_TITLE_MAX) throw new Error(`목표는 ${GROWTH_TITLE_MAX}자 이내로 입력하세요.`);
  const plan = String(input.plan ?? "").trim();
  if (plan.length > GROWTH_TEXT_MAX) throw new Error(`실행 계획은 ${GROWTH_TEXT_MAX}자 이내로 입력하세요.`);
  return { title, plan };
}

/** Owner-only access to a goal. */
function ownGoal(id: number, memberId: number): GrowthGoal {
  const goal = growthGoalById(Number(id));
  if (!goal || goal.memberId !== memberId) throw new Error("목표를 찾을 수 없습니다.");
  return goal;
}

function nextPosition(memberId: number, quarter: string): number {
  const row = db
    .select({ p: max(schema.growthGoals.position) })
    .from(schema.growthGoals)
    .where(and(eq(schema.growthGoals.memberId, memberId), eq(schema.growthGoals.quarter, quarter)))
    .get();
  return (row?.p ?? -1) + 1;
}

export async function addGrowthGoal(quarter: string, input: GrowthGoalInput): Promise<GrowthResult> {
  try {
    const user = await requireMember();
    const q = checkQuarter(quarter);
    const v = clean(input);
    if (growthGoalsFor(user.memberId, [q]).length >= GROWTH_MAX_PER_QUARTER) throw new Error(`분기당 목표는 ${GROWTH_MAX_PER_QUARTER}개까지입니다.`);
    db.insert(schema.growthGoals).values({ memberId: user.memberId, quarter: q, ...v, position: nextPosition(user.memberId, q) }).run();
    revalidate();
    return { ok: true, message: "목표를 추가했습니다." };
  } catch (e) {
    return fail(e, "목표를 추가하지 못했습니다.");
  }
}

export async function updateGrowthGoal(id: number, input: GrowthGoalInput): Promise<GrowthResult> {
  try {
    const user = await requireMember();
    const goal = ownGoal(id, user.memberId);
    const v = clean(input);
    db.update(schema.growthGoals).set({ ...v, updatedAt: new Date() }).where(eq(schema.growthGoals.id, goal.id)).run();
    revalidate();
    return { ok: true, message: "목표를 수정했습니다." };
  } catch (e) {
    return fail(e, "목표를 수정하지 못했습니다.");
  }
}

export async function setGrowthGoalStatus(id: number, status: GrowthStatus): Promise<GrowthResult> {
  try {
    const user = await requireMember();
    const goal = ownGoal(id, user.memberId);
    if (!GROWTH_STATUSES.includes(status)) throw new Error("상태가 올바르지 않습니다.");
    db.update(schema.growthGoals).set({ status, updatedAt: new Date() }).where(eq(schema.growthGoals.id, goal.id)).run();
    revalidate();
    return { ok: true, message: "상태를 바꿨습니다." };
  } catch (e) {
    return fail(e, "상태를 바꾸지 못했습니다.");
  }
}

export async function saveGrowthReflection(id: number, reflection: string): Promise<GrowthResult> {
  try {
    const user = await requireMember();
    const goal = ownGoal(id, user.memberId);
    const text = String(reflection ?? "").trim();
    if (text.length > GROWTH_TEXT_MAX) throw new Error(`회고는 ${GROWTH_TEXT_MAX}자 이내로 입력하세요.`);
    db.update(schema.growthGoals).set({ reflection: text, updatedAt: new Date() }).where(eq(schema.growthGoals.id, goal.id)).run();
    revalidate();
    return { ok: true, message: "회고를 저장했습니다." };
  } catch (e) {
    return fail(e, "회고를 저장하지 못했습니다.");
  }
}

export async function deleteGrowthGoal(id: number): Promise<GrowthResult> {
  try {
    const user = await requireMember();
    const goal = ownGoal(id, user.memberId);
    db.delete(schema.growthGoals).where(eq(schema.growthGoals.id, goal.id)).run();
    revalidate();
    return { ok: true, message: "목표를 삭제했습니다." };
  } catch (e) {
    return fail(e, "목표를 삭제하지 못했습니다.");
  }
}

/** Copy the previous quarter's unfinished goals (계획/진행 중) into `quarter`, skipping titles already there, up to the limit. */
export async function importUnfinishedGrowthGoals(quarter: string): Promise<GrowthResult> {
  try {
    const user = await requireMember();
    const q = checkQuarter(quarter);
    const prev = shiftPeriod(q, -1);
    const existing = growthGoalsFor(user.memberId, [q]);
    const titles = new Set(existing.map((g) => g.title));
    const source = growthGoalsFor(user.memberId, [prev]).filter((g) => (g.status === "planned" || g.status === "in_progress") && !titles.has(g.title));
    if (source.length === 0) return { ok: false, error: "가져올 미완료 목표가 없습니다." };
    const room = GROWTH_MAX_PER_QUARTER - existing.length;
    if (room <= 0) return { ok: false, error: `분기당 목표는 ${GROWTH_MAX_PER_QUARTER}개까지입니다.` };
    const picked = source.slice(0, room);
    let position = nextPosition(user.memberId, q);
    db.transaction((tx) => {
      for (const g of picked) {
        tx.insert(schema.growthGoals).values({ memberId: user.memberId, quarter: q, title: g.title, plan: g.plan, status: g.status, position: position++ }).run();
      }
    });
    revalidate();
    const skipped = source.length - picked.length;
    return { ok: true, message: `${picked.length}개 목표를 가져왔습니다.${skipped ? ` (한도 초과 ${skipped}개 제외)` : ""}` };
  } catch (e) {
    return fail(e, "목표를 가져오지 못했습니다.");
  }
}

/** Leader/admin comment on a member's goal (never self). Empty comment clears it. */
export async function commentGrowthGoal(id: number, comment: string): Promise<GrowthResult> {
  try {
    const user = await requireUser();
    const goal = growthGoalById(Number(id));
    const member = goal ? memberById(goal.memberId) : undefined;
    if (!goal || !member) throw new Error("목표를 찾을 수 없습니다.");
    if (!reviewerContext(user).canReview(member)) throw new Error("코멘트를 남길 권한이 없습니다.");
    const text = String(comment ?? "").trim();
    if (text.length > GROWTH_TEXT_MAX) throw new Error(`코멘트는 ${GROWTH_TEXT_MAX}자 이내로 입력하세요.`);
    db.update(schema.growthGoals)
      .set({ leaderComment: text, leaderName: text ? user.name : null, updatedAt: new Date() })
      .where(eq(schema.growthGoals.id, goal.id))
      .run();
    revalidate();
    return { ok: true, message: text ? "코멘트를 저장했습니다." : "코멘트를 지웠습니다." };
  } catch (e) {
    return fail(e, "코멘트를 저장하지 못했습니다.");
  }
}
