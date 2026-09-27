"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { requireMember, requireUser } from "@/lib/auth/dal";
import { isValidKey } from "@/lib/dates";
import { db, schema } from "@/lib/db";
import { memberById } from "@/lib/members/queries";
import { chatCompletion, openAIConfigured } from "@/lib/reports/openai";
import { reviewerContext } from "@/lib/reviews/queries";
import { AGENDA_SYSTEM_PROMPT, agendaSource, oneOnOneActionById, oneOnOneById } from "./queries";
import { ACTION_OWNERS, ONE_ON_ONE_STATUSES, type ActionOwner, type OneOnOneStatus } from "./types";

export type Result = { ok: true; message: string } | { ok: false; error: string };
export type AgendaResult = { ok: true; agenda: string; model: string } | { ok: false; error: string };
export type MeetingInput = { date: string; status: OneOnOneStatus; agenda: string; notes: string; privateNotes: string };

const err = (e: unknown, fallback: string) => ({ ok: false as const, error: e instanceof Error ? e.message : fallback });
const clean = (s: unknown, n: number) => String(s ?? "").replace(/\r\n/g, "\n").trim().slice(0, n);

function revalidate() {
  revalidatePath("/", "layout");
}

/** Admin, or the member's team leader (never self). */
async function leaderFor(memberId: number) {
  const user = await requireUser();
  const target = memberById(memberId);
  if (!target) throw new Error("구성원을 찾을 수 없습니다.");
  if (!reviewerContext(user).canReview(target)) throw new Error("이 구성원과의 1:1을 관리할 권한이 없습니다.");
  return { user, target };
}

async function leaderForMeeting(id: number) {
  const meeting = oneOnOneById(id);
  if (!meeting) throw new Error("1:1을 찾을 수 없습니다.");
  const ctx = await leaderFor(meeting.memberId);
  return { ...ctx, meeting };
}

export async function createOneOnOne(memberId: number, date: string, agenda: string): Promise<Result> {
  try {
    const { user } = await leaderFor(memberId);
    if (!isValidKey(date)) return { ok: false, error: "날짜를 선택하세요." };
    db.insert(schema.oneOnOnes)
      .values({ memberId, date, agenda: clean(agenda, 3000), leaderUserId: user.id, leaderName: user.name })
      .run();
    revalidate();
    return { ok: true, message: "1:1을 추가했습니다." };
  } catch (e) {
    return err(e, "1:1 추가에 실패했습니다.");
  }
}

export async function updateOneOnOne(id: number, input: MeetingInput): Promise<Result> {
  try {
    await leaderForMeeting(id);
    if (!isValidKey(input.date)) return { ok: false, error: "날짜가 올바르지 않습니다." };
    if (!ONE_ON_ONE_STATUSES.includes(input.status)) return { ok: false, error: "상태가 올바르지 않습니다." };
    db.update(schema.oneOnOnes)
      .set({
        date: input.date,
        status: input.status,
        agenda: clean(input.agenda, 3000),
        notes: clean(input.notes, 5000),
        privateNotes: clean(input.privateNotes, 5000),
        updatedAt: new Date(),
      })
      .where(eq(schema.oneOnOnes.id, id))
      .run();
    revalidate();
    return { ok: true, message: "저장했습니다." };
  } catch (e) {
    return err(e, "저장에 실패했습니다.");
  }
}

export async function deleteOneOnOne(id: number): Promise<Result> {
  try {
    await leaderForMeeting(id);
    db.delete(schema.oneOnOnes).where(eq(schema.oneOnOnes.id, id)).run();
    revalidate();
    return { ok: true, message: "1:1을 삭제했습니다." };
  } catch (e) {
    return err(e, "삭제에 실패했습니다.");
  }
}

export async function addOneOnOneAction(meetingId: number, title: string, owner: ActionOwner): Promise<Result> {
  try {
    const { meeting } = await leaderForMeeting(meetingId);
    const text = clean(title, 200);
    if (!text) return { ok: false, error: "내용을 입력하세요." };
    if (!ACTION_OWNERS.includes(owner)) return { ok: false, error: "담당이 올바르지 않습니다." };
    db.insert(schema.oneOnOneActions).values({ meetingId, memberId: meeting.memberId, title: text, owner }).run();
    revalidate();
    return { ok: true, message: "후속 조치를 추가했습니다." };
  } catch (e) {
    return err(e, "추가에 실패했습니다.");
  }
}

/** Leader (admin / the member's team leader) toggles any action; the member only their own `member`-owned ones. */
export async function toggleOneOnOneAction(id: number, done: boolean): Promise<Result> {
  try {
    const user = await requireUser();
    const action = oneOnOneActionById(id);
    if (!action) return { ok: false, error: "후속 조치를 찾을 수 없습니다." };
    const target = memberById(action.memberId);
    const asLeader = !!target && reviewerContext(user).canReview(target);
    const asMember = user.memberId === action.memberId && action.owner === "member";
    if (!asLeader && !asMember) return { ok: false, error: "변경할 권한이 없습니다." };
    db.update(schema.oneOnOneActions)
      .set({ doneAt: done ? (action.doneAt ?? new Date()) : null })
      .where(eq(schema.oneOnOneActions.id, id))
      .run();
    revalidate();
    return { ok: true, message: done ? "완료했습니다." : "미완료로 돌렸습니다." };
  } catch (e) {
    return err(e, "변경에 실패했습니다.");
  }
}

export async function deleteOneOnOneAction(id: number): Promise<Result> {
  try {
    const action = oneOnOneActionById(id);
    if (!action) return { ok: false, error: "후속 조치를 찾을 수 없습니다." };
    await leaderFor(action.memberId);
    db.delete(schema.oneOnOneActions).where(eq(schema.oneOnOneActions.id, id)).run();
    revalidate();
    return { ok: true, message: "삭제했습니다." };
  } catch (e) {
    return err(e, "삭제에 실패했습니다.");
  }
}

/** Member edits the topics they want to raise, on their own planned meetings only. */
export async function updateMemberAgenda(id: number, text: string): Promise<Result> {
  try {
    const { memberId } = await requireMember();
    const meeting = oneOnOneById(id);
    if (!meeting || meeting.memberId !== memberId) return { ok: false, error: "1:1을 찾을 수 없습니다." };
    if (meeting.status !== "planned") return { ok: false, error: "완료된 1:1은 수정할 수 없습니다." };
    db.update(schema.oneOnOnes)
      .set({ memberAgenda: clean(text, 3000), updatedAt: new Date() })
      .where(eq(schema.oneOnOnes.id, id))
      .run();
    revalidate();
    return { ok: true, message: "저장했습니다." };
  } catch (e) {
    return err(e, "저장에 실패했습니다.");
  }
}

/** AI agenda suggestion for the leader. Returns text only; never saves. */
export async function suggestOneOnOneAgenda(memberId: number): Promise<AgendaResult> {
  try {
    const { target } = await leaderFor(memberId);
    if (!openAIConfigured()) return { ok: false, error: "OPENAI_API_KEY가 설정되지 않았습니다." };
    const { content, model } = await chatCompletion(
      [
        { role: "system", content: AGENDA_SYSTEM_PROMPT },
        { role: "user", content: agendaSource(target) },
      ],
      { maxTokens: 700 },
    );
    return { ok: true, agenda: content.trim(), model };
  } catch (e) {
    return err(e, "AI 안건 제안에 실패했습니다.");
  }
}
