import "server-only";
import { and, asc, desc, eq, gte, inArray, isNull, lte } from "drizzle-orm";
import { addDays, formatKoDate, todayKey, weekStartOf } from "@/lib/dates";
import { db, schema } from "@/lib/db";
import type { OneOnOne, OneOnOneAction } from "@/lib/db/schema";
import { collectMemberWeek, renderMemberWeek } from "@/lib/member-reviews/data";
import { sharedReviewsFor } from "@/lib/member-reviews/queries";
import type { Member } from "@/lib/members/types";
import { ACTION_OWNER_LABEL } from "./types";

export type OneOnOneWithActions = OneOnOne & { actions: OneOnOneAction[] };
/** What a member may see: never `privateNotes`. */
export type MemberOneOnOne = Omit<OneOnOne, "privateNotes"> & { actions: OneOnOneAction[] };

const t = schema.oneOnOnes;
const a = schema.oneOnOneActions;

function actionsByMeeting(meetingIds: number[]): Map<number, OneOnOneAction[]> {
  const map = new Map<number, OneOnOneAction[]>();
  if (meetingIds.length === 0) return map;
  const rows = db.select().from(a).where(inArray(a.meetingId, meetingIds)).orderBy(asc(a.createdAt), asc(a.id)).all();
  for (const r of rows) map.set(r.meetingId, [...(map.get(r.meetingId) ?? []), r]);
  return map;
}

/**
 * Per member: last held 1:1 (done, or a planned date already passed), next planned date (today or later), open actions.
 */
export function oneOnOneSummary(memberIds: number[]): Map<number, { last: string | null; next: string | null; openActions: number }> {
  const out = new Map<number, { last: string | null; next: string | null; openActions: number }>();
  for (const id of memberIds) out.set(id, { last: null, next: null, openActions: 0 });
  if (memberIds.length === 0) return out;
  const today = todayKey();
  const meetings = db.select({ memberId: t.memberId, date: t.date, status: t.status }).from(t).where(inArray(t.memberId, memberIds)).all();
  for (const m of meetings) {
    const s = out.get(m.memberId)!;
    if (m.status === "done" || m.date < today) {
      if (!s.last || m.date > s.last) s.last = m.date;
    } else if (!s.next || m.date < s.next) s.next = m.date;
  }
  const open = db.select({ memberId: a.memberId }).from(a).where(and(inArray(a.memberId, memberIds), isNull(a.doneAt))).all();
  for (const r of open) out.get(r.memberId)!.openActions++;
  return out;
}

/** Full rows incl. privateNotes — server-side only, for leader views/evaluations. */
export function oneOnOnesFor(memberId: number, from: string, to: string): OneOnOneWithActions[] {
  const rows = db
    .select()
    .from(t)
    .where(and(eq(t.memberId, memberId), gte(t.date, from), lte(t.date, to)))
    .orderBy(desc(t.date), desc(t.id))
    .all();
  const acts = actionsByMeeting(rows.map((r) => r.id));
  return rows.map((r) => ({ ...r, actions: acts.get(r.id) ?? [] }));
}

/** Leader view: every meeting with this member, newest first (incl. privateNotes). */
export function allOneOnOnesFor(memberId: number): OneOnOneWithActions[] {
  return oneOnOnesFor(memberId, "0000-01-01", "9999-12-31");
}

/** Member view: own meetings without privateNotes (the column is never selected). */
export function memberOneOnOnes(memberId: number): MemberOneOnOne[] {
  const rows = db
    .select({
      id: t.id,
      memberId: t.memberId,
      date: t.date,
      status: t.status,
      agenda: t.agenda,
      memberAgenda: t.memberAgenda,
      notes: t.notes,
      leaderUserId: t.leaderUserId,
      leaderName: t.leaderName,
      createdAt: t.createdAt,
      updatedAt: t.updatedAt,
    })
    .from(t)
    .where(eq(t.memberId, memberId))
    .orderBy(desc(t.date), desc(t.id))
    .all();
  const acts = actionsByMeeting(rows.map((r) => r.id));
  return rows.map((r) => ({ ...r, actions: acts.get(r.id) ?? [] }));
}

export function oneOnOneById(id: number): OneOnOne | undefined {
  return db.select().from(t).where(eq(t.id, id)).get();
}

export function oneOnOneActionById(id: number): OneOnOneAction | undefined {
  return db.select().from(a).where(eq(a.id, id)).get();
}

/** Open follow-ups for a member, oldest first, with the date of the meeting they came from. */
export function openActionsFor(memberId: number): (OneOnOneAction & { meetingDate: string })[] {
  return db
    .select({ action: a, meetingDate: t.date })
    .from(a)
    .innerJoin(t, eq(a.meetingId, t.id))
    .where(and(eq(a.memberId, memberId), isNull(a.doneAt)))
    .orderBy(asc(t.date), asc(a.id))
    .all()
    .map((r) => ({ ...r.action, meetingDate: r.meetingDate }));
}

export const AGENDA_SYSTEM_PROMPT = `당신은 팀장이 구성원과의 1:1 미팅을 준비하도록 돕는 어시스턴트입니다.
주어진 기록(최근 2주 업무 기록, 미완료 후속 조치, 최근 주간 리뷰, 지난 1:1 합의 내용)만 근거로 이번 1:1에서 다룰 안건을 제안하세요.
- 한국어, 불릿 목록("- ") 4~6개. 각 항목은 한 줄, 구체적인 질문이나 확인 사항 형태.
- 미완료 후속 조치 확인, 막힌 일·부담, 잘한 점 인정, 성장·지원 요청을 균형 있게.
- 기록에 없는 사실을 지어내지 말고, 평가나 판정 표현은 피하세요.
- 목록 외의 서론·결론은 쓰지 마세요.`;

/** Plain-text source for the AI agenda suggestion. Leader-side only. */
export function agendaSource(member: Member): string {
  const today = todayKey();
  const thisWeek = weekStartOf(today);
  const lines: string[] = [];
  for (const ws of [addDays(thisWeek, -7), thisWeek]) {
    lines.push(`# ${ws === thisWeek ? "이번 주" : "지난주"} 기록`);
    lines.push(renderMemberWeek(collectMemberWeek(member, ws)));
    lines.push("");
  }

  const open = openActionsFor(member.id);
  lines.push("# 미완료 후속 조치");
  if (open.length === 0) lines.push("(없음)");
  for (const x of open) lines.push(`- [${ACTION_OWNER_LABEL[x.owner]}] ${x.title} (${formatKoDate(x.meetingDate)} 1:1)`);
  lines.push("");

  const review = sharedReviewsFor(member.id, 1)[0];
  if (review && (review.summary || review.improvements)) {
    lines.push(`# 최근 주간 리뷰 (${formatKoDate(review.weekStart)} 주)`);
    if (review.summary) lines.push(`요약: ${review.summary}`);
    if (review.improvements) lines.push(`개선할 점: ${review.improvements}`);
    lines.push("");
  }

  const last = db
    .select({ date: t.date, notes: t.notes })
    .from(t)
    .where(and(eq(t.memberId, member.id), lte(t.date, today)))
    .orderBy(desc(t.date), desc(t.id))
    .all()
    .find((m) => m.notes.trim());
  if (last) {
    lines.push(`# 지난 1:1 논의·합의 (${formatKoDate(last.date)})`);
    lines.push(last.notes.trim());
  }
  return lines.join("\n").trim();
}
