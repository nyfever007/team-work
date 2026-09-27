"use server";

import { and, asc, eq, max } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { requireMember, requireUser } from "@/lib/auth/dal";
import type { SafeUser } from "@/lib/auth/session";
import { db, schema } from "@/lib/db";
import type { OnboardingItem } from "@/lib/db/schema";
import { memberById } from "@/lib/members/queries";
import { teamScope } from "@/lib/teams/scope";
import { isNewcomer } from "./queries";

export type OnboardingResult = { ok: true; message: string } | { ok: false; error: string };
const fail = (e: unknown, fallback: string): OnboardingResult => ({ ok: false, error: e instanceof Error ? e.message : fallback });

export type OnboardingItemInput = { title: string; description: string; postId: number | null };

function assertLead(user: SafeUser, teamId: number) {
  if (!teamScope(user).canLead(teamId)) throw new Error("체크리스트를 관리할 권한이 없습니다.");
}

function loadItem(id: number): OnboardingItem {
  const item = db.select().from(schema.onboardingItems).where(eq(schema.onboardingItems.id, Number(id))).get();
  if (!item) throw new Error("항목을 찾을 수 없습니다.");
  return item;
}

function clean(input: OnboardingItemInput, teamId: number): OnboardingItemInput {
  const title = String(input.title ?? "").replace(/\s+/g, " ").trim();
  if (!title) throw new Error("항목 제목을 입력하세요.");
  if (title.length > 120) throw new Error("제목은 120자 이내로 입력하세요.");
  const description = String(input.description ?? "").trim();
  if (description.length > 1000) throw new Error("설명은 1000자 이내로 입력하세요.");
  const postId = input.postId ? Number(input.postId) : null;
  if (postId != null) {
    const post = db.select({ teamId: schema.posts.teamId }).from(schema.posts).where(eq(schema.posts.id, postId)).get();
    if (!post || post.teamId !== teamId) throw new Error("같은 팀 게시글만 연결할 수 있습니다.");
  }
  return { title, description, postId };
}

function revalidate() {
  revalidatePath("/", "layout");
}

export async function addOnboardingItem(teamId: number, input: OnboardingItemInput): Promise<OnboardingResult> {
  try {
    const user = await requireUser();
    assertLead(user, Number(teamId));
    const v = clean(input, Number(teamId));
    const row = db.select({ p: max(schema.onboardingItems.position) }).from(schema.onboardingItems).where(eq(schema.onboardingItems.teamId, Number(teamId))).get();
    db.insert(schema.onboardingItems).values({ teamId: Number(teamId), ...v, position: (row?.p ?? -1) + 1 }).run();
    revalidate();
    return { ok: true, message: "항목을 추가했습니다." };
  } catch (e) {
    return fail(e, "항목을 추가하지 못했습니다.");
  }
}

export async function updateOnboardingItem(id: number, input: OnboardingItemInput): Promise<OnboardingResult> {
  try {
    const user = await requireUser();
    const item = loadItem(id);
    assertLead(user, item.teamId);
    const v = clean(input, item.teamId);
    db.update(schema.onboardingItems).set(v).where(eq(schema.onboardingItems.id, item.id)).run();
    revalidate();
    return { ok: true, message: "항목을 수정했습니다." };
  } catch (e) {
    return fail(e, "항목을 수정하지 못했습니다.");
  }
}

export async function deleteOnboardingItem(id: number): Promise<OnboardingResult> {
  try {
    const user = await requireUser();
    const item = loadItem(id);
    assertLead(user, item.teamId);
    db.delete(schema.onboardingItems).where(eq(schema.onboardingItems.id, item.id)).run();
    revalidate();
    return { ok: true, message: "항목을 삭제했습니다." };
  } catch (e) {
    return fail(e, "항목을 삭제하지 못했습니다.");
  }
}

/** Swap with the neighbour above (-1) or below (1); positions are renumbered 0..n-1. */
export async function moveOnboardingItem(id: number, dir: -1 | 1): Promise<OnboardingResult> {
  try {
    const user = await requireUser();
    const item = loadItem(id);
    assertLead(user, item.teamId);
    const list = db
      .select({ id: schema.onboardingItems.id })
      .from(schema.onboardingItems)
      .where(eq(schema.onboardingItems.teamId, item.teamId))
      .orderBy(asc(schema.onboardingItems.position), asc(schema.onboardingItems.id))
      .all()
      .map((r) => r.id);
    const i = list.indexOf(item.id);
    const j = i + (dir < 0 ? -1 : 1);
    if (j < 0 || j >= list.length) return { ok: true, message: "이동할 수 없습니다." };
    [list[i], list[j]] = [list[j], list[i]];
    db.transaction((tx) => {
      list.forEach((itemId, position) => tx.update(schema.onboardingItems).set({ position }).where(eq(schema.onboardingItems.id, itemId)).run());
    });
    revalidate();
    return { ok: true, message: "순서를 바꿨습니다." };
  } catch (e) {
    return fail(e, "순서를 바꾸지 못했습니다.");
  }
}

/** Newcomer checks/unchecks an item of their own team's checklist. */
export async function toggleOnboardingCheck(itemId: number, checked: boolean): Promise<OnboardingResult> {
  try {
    const user = await requireMember();
    const me = memberById(user.memberId);
    const item = loadItem(itemId);
    if (!me || me.teamId !== item.teamId) throw new Error("우리 팀 체크리스트만 체크할 수 있습니다.");
    if (!isNewcomer(me.joinedAt)) throw new Error("온보딩 기간이 지났습니다.");
    const where = and(eq(schema.onboardingChecks.itemId, item.id), eq(schema.onboardingChecks.memberId, me.id));
    if (checked) db.insert(schema.onboardingChecks).values({ itemId: item.id, memberId: me.id }).onConflictDoNothing().run();
    else db.delete(schema.onboardingChecks).where(where).run();
    revalidate();
    return { ok: true, message: checked ? "완료로 표시했습니다." : "완료를 취소했습니다." };
  } catch (e) {
    return fail(e, "저장하지 못했습니다.");
  }
}
