"use server";

import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth/dal";
import type { SafeUser } from "@/lib/auth/session";
import { db, schema } from "@/lib/db";
import type { Retro, RetroItem } from "@/lib/db/schema";
import { memberById } from "@/lib/members/queries";
import { chatCompletion, openAIConfigured } from "@/lib/reports/openai";
import { teamScope } from "@/lib/teams/scope";
import { retroAccess, retroById, type RetroAccess } from "./queries";
import { RETRO_KINDS, RETRO_KIND_LABEL, type RetroKind } from "./types";

export type RetroActionResult = { ok: true; message: string } | { ok: false; error: string };
const fail = (e: unknown, fallback: string): { ok: false; error: string } => ({ ok: false, error: e instanceof Error ? e.message : fallback });

const ITEM_MAX = 500;
const TITLE_MAX = 100;
const SUMMARY_MAX = 5000;

function revalidate() {
  revalidatePath("/lounge", "layout");
}

function load(user: SafeUser, retroId: number): { retro: Retro; access: RetroAccess } {
  const retro = retroById(Number(retroId));
  if (!retro) throw new Error("회고를 찾을 수 없습니다.");
  const access = retroAccess(user, retro);
  if (!access) throw new Error("이 회고를 볼 권한이 없습니다.");
  return { retro, access };
}

function loadItem(user: SafeUser, itemId: number): { item: RetroItem; retro: Retro; access: RetroAccess } {
  const item = db.select().from(schema.retroItems).where(eq(schema.retroItems.id, Number(itemId))).get();
  if (!item) throw new Error("항목을 찾을 수 없습니다.");
  return { item, ...load(user, item.retroId) };
}

function assertLead(access: RetroAccess) {
  if (!access.canLead) throw new Error("팀장 또는 관리자만 할 수 있습니다.");
}

function assertOpen(retro: Retro) {
  if (retro.status !== "open") throw new Error("마감된 회고입니다.");
}

function cleanBody(body: unknown): string {
  const v = String(body ?? "").trim();
  if (!v) throw new Error("내용을 입력하세요.");
  if (v.length > ITEM_MAX) throw new Error(`${ITEM_MAX}자 이내로 입력하세요.`);
  return v;
}

export async function createRetro(teamId: number, input: { title: string; milestoneId: number | null; anonymous: boolean }): Promise<{ ok: true; message: string; id: number } | { ok: false; error: string }> {
  try {
    const user = await requireUser();
    const scope = teamScope(user);
    const tid = Number(teamId);
    if (!scope.canLead(tid)) throw new Error("팀장 또는 관리자만 회고를 만들 수 있습니다.");
    const title = String(input.title ?? "").replace(/\s+/g, " ").trim();
    if (!title) throw new Error("제목을 입력하세요.");
    if (title.length > TITLE_MAX) throw new Error(`제목은 ${TITLE_MAX}자 이내로 입력하세요.`);
    let milestoneId: number | null = null;
    if (input.milestoneId) {
      const ms = db.select({ id: schema.milestones.id, teamId: schema.milestones.teamId, approval: schema.milestones.approval }).from(schema.milestones).where(eq(schema.milestones.id, Number(input.milestoneId))).get();
      if (!ms || ms.teamId !== tid || ms.approval !== "approved") throw new Error("같은 팀의 승인된 마일스톤만 연결할 수 있습니다.");
      milestoneId = ms.id;
    }
    const row = db
      .insert(schema.retros)
      .values({ teamId: tid, title, milestoneId, anonymous: input.anonymous !== false, createdBy: user.id, createdByName: user.name })
      .returning({ id: schema.retros.id })
      .get();
    revalidate();
    return { ok: true, message: "회고를 만들었습니다.", id: row.id };
  } catch (e) {
    return fail(e, "회고를 만들지 못했습니다.");
  }
}

export async function setRetroStatus(retroId: number, status: "open" | "closed"): Promise<RetroActionResult> {
  try {
    const user = await requireUser();
    const { retro, access } = load(user, retroId);
    assertLead(access);
    if (status !== "open" && status !== "closed") throw new Error("잘못된 상태입니다.");
    db.update(schema.retros).set({ status, updatedAt: new Date() }).where(eq(schema.retros.id, retro.id)).run();
    revalidate();
    return { ok: true, message: status === "closed" ? "회고를 마감했습니다." : "회고를 다시 열었습니다." };
  } catch (e) {
    return fail(e, "상태를 바꾸지 못했습니다.");
  }
}

export async function deleteRetro(retroId: number): Promise<RetroActionResult> {
  try {
    const user = await requireUser();
    const { retro, access } = load(user, retroId);
    assertLead(access);
    db.delete(schema.retros).where(eq(schema.retros.id, retro.id)).run();
    revalidate();
    return { ok: true, message: "회고를 삭제했습니다." };
  } catch (e) {
    return fail(e, "삭제에 실패했습니다.");
  }
}

export async function addRetroItem(retroId: number, kind: RetroKind, body: string): Promise<RetroActionResult> {
  try {
    const user = await requireUser();
    const { retro, access } = load(user, retroId);
    assertOpen(retro);
    if (access.memberId == null) throw new Error("이 팀 구성원만 항목을 남길 수 있습니다.");
    if (!(RETRO_KINDS as readonly string[]).includes(kind)) throw new Error("잘못된 항목 종류입니다.");
    const me = memberById(access.memberId);
    db.insert(schema.retroItems)
      .values({ retroId: retro.id, kind, body: cleanBody(body), authorMemberId: access.memberId, authorName: me?.name ?? user.name })
      .run();
    revalidate();
    return { ok: true, message: "항목을 추가했습니다." };
  } catch (e) {
    return fail(e, "추가에 실패했습니다.");
  }
}

export async function updateRetroItem(itemId: number, body: string): Promise<RetroActionResult> {
  try {
    const user = await requireUser();
    const { item, retro, access } = loadItem(user, itemId);
    assertOpen(retro);
    if (access.memberId == null || item.authorMemberId !== access.memberId) throw new Error("본인이 쓴 항목만 수정할 수 있습니다.");
    db.update(schema.retroItems).set({ body: cleanBody(body) }).where(eq(schema.retroItems.id, item.id)).run();
    revalidate();
    return { ok: true, message: "항목을 수정했습니다." };
  } catch (e) {
    return fail(e, "수정에 실패했습니다.");
  }
}

/** Author while open; the leader/admin may also remove any item (moderation). */
export async function deleteRetroItem(itemId: number): Promise<RetroActionResult> {
  try {
    const user = await requireUser();
    const { item, retro, access } = loadItem(user, itemId);
    const own = access.memberId != null && item.authorMemberId === access.memberId;
    if (!access.canLead) {
      assertOpen(retro);
      if (!own) throw new Error("본인이 쓴 항목만 삭제할 수 있습니다.");
    }
    db.delete(schema.retroItems).where(eq(schema.retroItems.id, item.id)).run();
    revalidate();
    return { ok: true, message: "항목을 삭제했습니다." };
  } catch (e) {
    return fail(e, "삭제에 실패했습니다.");
  }
}

export async function toggleRetroVote(itemId: number): Promise<RetroActionResult> {
  try {
    const user = await requireUser();
    const { item, retro, access } = loadItem(user, itemId);
    assertOpen(retro);
    if (access.memberId == null) throw new Error("이 팀 구성원만 투표할 수 있습니다.");
    const where = and(eq(schema.retroVotes.itemId, item.id), eq(schema.retroVotes.memberId, access.memberId));
    const existing = db.select({ id: schema.retroVotes.id }).from(schema.retroVotes).where(where).get();
    if (existing) db.delete(schema.retroVotes).where(eq(schema.retroVotes.id, existing.id)).run();
    else db.insert(schema.retroVotes).values({ itemId: item.id, memberId: access.memberId }).onConflictDoNothing().run();
    revalidate();
    return { ok: true, message: existing ? "투표를 취소했습니다." : "투표했습니다." };
  } catch (e) {
    return fail(e, "투표에 실패했습니다.");
  }
}

/** Leader assigns a Try owner (works after the retro is closed too). */
export async function setTryOwner(itemId: number, ownerMemberId: number | null): Promise<RetroActionResult> {
  try {
    const user = await requireUser();
    const { item, retro, access } = loadItem(user, itemId);
    assertLead(access);
    if (item.kind !== "try") throw new Error("Try 항목에만 담당자를 지정할 수 있습니다.");
    const owner = ownerMemberId ? memberById(Number(ownerMemberId)) : undefined;
    if (ownerMemberId && (!owner || owner.teamId !== retro.teamId)) throw new Error("같은 팀 구성원만 지정할 수 있습니다.");
    db.update(schema.retroItems).set({ ownerMemberId: owner?.id ?? null }).where(eq(schema.retroItems.id, item.id)).run();
    revalidate();
    return { ok: true, message: owner ? `${owner.name}님을 담당자로 지정했습니다.` : "담당자를 해제했습니다." };
  } catch (e) {
    return fail(e, "담당자를 지정하지 못했습니다.");
  }
}

/** The Try owner or the leader toggles done (also after the retro is closed). */
export async function toggleTryDone(itemId: number): Promise<RetroActionResult> {
  try {
    const user = await requireUser();
    const { item, access } = loadItem(user, itemId);
    if (item.kind !== "try") throw new Error("Try 항목만 완료 처리할 수 있습니다.");
    const isOwner = access.memberId != null && item.ownerMemberId === access.memberId;
    if (!access.canLead && !isOwner) throw new Error("담당자 또는 팀장만 완료 처리할 수 있습니다.");
    const done = item.doneAt == null;
    db.update(schema.retroItems).set({ doneAt: done ? new Date() : null }).where(eq(schema.retroItems.id, item.id)).run();
    revalidate();
    return { ok: true, message: done ? "완료로 표시했습니다." : "완료를 취소했습니다." };
  } catch (e) {
    return fail(e, "변경하지 못했습니다.");
  }
}

const SUMMARY_PROMPT = `당신은 팀 회고(KPT) 진행자입니다. 팀원이 남긴 Keep/Problem/Try 항목과 투표 수를 바탕으로 한국어 회고 요약을 작성합니다.
- 형식: "잘한 점", "문제점", "다음에 시도할 것" 세 소제목, 각 3~5개의 간결한 글머리표.
- 투표가 많은 항목을 우선하고 비슷한 항목은 묶습니다.
- 개인 이름이나 추측은 넣지 않습니다. 항목에 없는 내용을 지어내지 않습니다.
- 마크다운 제목(#)은 쓰지 말고 소제목은 한 줄 텍스트로 씁니다.`;

/** Returns an AI draft for the leader to edit; never saves. */
export async function draftRetroSummary(retroId: number): Promise<{ ok: true; summary: string; model: string } | { ok: false; error: string }> {
  try {
    const user = await requireUser();
    const { retro, access } = load(user, retroId);
    assertLead(access);
    if (!openAIConfigured()) throw new Error("OPENAI_API_KEY가 설정되지 않았습니다.");
    const items = db.select({ id: schema.retroItems.id, kind: schema.retroItems.kind, body: schema.retroItems.body }).from(schema.retroItems).where(eq(schema.retroItems.retroId, retro.id)).all();
    if (items.length === 0) throw new Error("요약할 항목이 없습니다.");
    const votes = new Map<number, number>();
    for (const v of db.select({ itemId: schema.retroVotes.itemId }).from(schema.retroVotes).innerJoin(schema.retroItems, eq(schema.retroItems.id, schema.retroVotes.itemId)).where(eq(schema.retroItems.retroId, retro.id)).all()) {
      votes.set(v.itemId, (votes.get(v.itemId) ?? 0) + 1);
    }
    const source = RETRO_KINDS.map((k) => {
      const lines = items
        .filter((i) => i.kind === k)
        .sort((a, b) => (votes.get(b.id) ?? 0) - (votes.get(a.id) ?? 0))
        .map((i) => `- ${i.body.replace(/\s+/g, " ")} (투표 ${votes.get(i.id) ?? 0})`);
      return `[${RETRO_KIND_LABEL[k]}]\n${lines.length ? lines.join("\n") : "- (없음)"}`;
    }).join("\n\n");
    const { content, model } = await chatCompletion(
      [
        { role: "system", content: SUMMARY_PROMPT },
        { role: "user", content: `회고: ${retro.title}\n\n${source}` },
      ],
      { maxTokens: 1200 },
    );
    return { ok: true, summary: content.slice(0, SUMMARY_MAX), model };
  } catch (e) {
    return fail(e, "AI 요약에 실패했습니다.");
  }
}

export async function saveRetroSummary(retroId: number, summary: string, model: string | null): Promise<RetroActionResult> {
  try {
    const user = await requireUser();
    const { retro, access } = load(user, retroId);
    assertLead(access);
    const text = String(summary ?? "").trim();
    if (text.length > SUMMARY_MAX) throw new Error(`요약은 ${SUMMARY_MAX}자 이내로 입력하세요.`);
    db.update(schema.retros)
      .set({ summary: text, model: text ? (model ? String(model).slice(0, 100) : retro.model) : null, updatedAt: new Date() })
      .where(eq(schema.retros.id, retro.id))
      .run();
    revalidate();
    return { ok: true, message: text ? "요약을 저장했습니다." : "요약을 비웠습니다." };
  } catch (e) {
    return fail(e, "저장에 실패했습니다.");
  }
}
