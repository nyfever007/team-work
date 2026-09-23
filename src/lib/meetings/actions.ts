"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth/dal";
import { isValidKey, weekStartOf } from "@/lib/dates";
import { db, schema } from "@/lib/db";
import { REPORT_STATUSES, type ReportStatus } from "@/lib/db/schema";
import { chatCompletion } from "@/lib/reports/openai";
import { reportAccess } from "@/lib/reports/queries";
import { collectMeetingSource, renderMeetingSource } from "./data";
import { MEETING_SYSTEM_PROMPT, meetingUserPrompt } from "./prompt";
import { meetingNoteFor } from "./queries";

export type MeetingResult = { ok: true; content: string; model?: string; message: string } | { ok: false; error: string };

const validWeek = (w: string) => isValidKey(w) && weekStartOf(w) === w;

async function editor(teamId: number) {
  const user = await requireUser();
  if (!reportAccess(user).canEdit(teamId)) throw new Error("이 팀의 미팅 노트를 편집할 권한이 없습니다.");
  return user;
}

function upsert(teamId: number, weekStart: string, patch: Partial<typeof schema.meetingNotes.$inferInsert>, user: { id: number; name: string }) {
  const existing = meetingNoteFor(teamId, weekStart);
  const now = new Date();
  if (existing) db.update(schema.meetingNotes).set({ ...patch, updatedBy: user.id, updatedByName: user.name, updatedAt: now }).where(eq(schema.meetingNotes.id, existing.id)).run();
  else db.insert(schema.meetingNotes).values({ teamId, weekStart, ...patch, updatedBy: user.id, updatedByName: user.name }).run();
  revalidatePath("/my/meeting");
}

export async function saveMeetingTopics(teamId: number, weekStart: string, topics: string): Promise<MeetingResult> {
  try {
    const user = await editor(teamId);
    if (!validWeek(weekStart)) return { ok: false, error: "주차가 올바르지 않습니다." };
    const clean = topics.replace(/\r\n/g, "\n").trim().slice(0, 2000);
    upsert(teamId, weekStart, { topics: clean }, user);
    return { ok: true, content: clean, message: "회의 주제를 저장했습니다." };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "저장에 실패했습니다." };
  }
}

export async function generateMeetingNotes(teamId: number, weekStart: string, instructions?: string): Promise<MeetingResult> {
  try {
    const user = await editor(teamId);
    if (!validWeek(weekStart)) return { ok: false, error: "주차가 올바르지 않습니다." };
    const src = collectMeetingSource(teamId, weekStart);
    if (!src) return { ok: false, error: "팀을 찾을 수 없습니다." };
    const hasData = [src.lastWeek, src.thisWeek].some((w) => w.members.some((m) => m.weeklyItems.length || m.doneTasks.length || m.extras.length || m.result));
    if (!hasData && src.milestones.length === 0) return { ok: false, error: "지난주·이번주 기록과 마일스톤이 없어 노트를 만들 수 없습니다." };
    const topics = meetingNoteFor(teamId, weekStart)?.topics ?? "";
    const { content, model } = await chatCompletion(
      [
        { role: "system", content: MEETING_SYSTEM_PROMPT },
        { role: "user", content: meetingUserPrompt(renderMeetingSource(src, topics), instructions) },
      ],
      { maxTokens: 2500 },
    );
    upsert(teamId, weekStart, { content, model, generatedAt: new Date(), status: "draft" }, user);
    return { ok: true, content, model, message: "미팅 노트 초안을 만들었습니다. 회의 전에 질문을 다듬어 보세요." };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "생성에 실패했습니다." };
  }
}

export async function saveMeetingNotes(teamId: number, weekStart: string, content: string, status: ReportStatus): Promise<MeetingResult> {
  try {
    const user = await editor(teamId);
    if (!validWeek(weekStart)) return { ok: false, error: "주차가 올바르지 않습니다." };
    if (!REPORT_STATUSES.includes(status)) return { ok: false, error: "상태가 올바르지 않습니다." };
    const clean = content.replace(/\r\n/g, "\n").trimEnd();
    if (clean.length > 30000) return { ok: false, error: "노트는 30,000자 이내로 작성하세요." };
    if (status === "final" && !clean.trim()) return { ok: false, error: "내용이 비어 있어 확정할 수 없습니다." };
    upsert(teamId, weekStart, { content: clean, status }, user);
    return { ok: true, content: clean, message: status === "final" ? "미팅 노트를 확정했습니다." : "저장했습니다." };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "저장에 실패했습니다." };
  }
}
