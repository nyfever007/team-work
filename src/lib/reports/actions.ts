"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth/dal";
import { isValidKey, weekStartOf } from "@/lib/dates";
import { db, schema } from "@/lib/db";
import { REPORT_STATUSES, type ReportStatus } from "@/lib/db/schema";
import { collectWeekSource, renderSource } from "./data";
import { chatCompletion } from "./openai";
import { REPORT_SYSTEM_PROMPT, reportUserPrompt } from "./prompt";
import { reportAccess, teamReportFor } from "./queries";

export type ReportResult = { ok: true; content: string; model?: string; message: string } | { ok: false; error: string };

function validWeek(w: string) {
  return isValidKey(w) && weekStartOf(w) === w;
}

async function editor(teamId: number) {
  const user = await requireUser();
  if (!reportAccess(user).canEdit(teamId)) throw new Error("이 팀의 보고서를 편집할 권한이 없습니다.");
  return user;
}

function upsert(teamId: number, weekStart: string, patch: Partial<typeof schema.teamReports.$inferInsert>, user: { id: number; name: string }) {
  const existing = teamReportFor(teamId, weekStart);
  const now = new Date();
  if (existing) {
    db.update(schema.teamReports).set({ ...patch, updatedBy: user.id, updatedByName: user.name, updatedAt: now }).where(eq(schema.teamReports.id, existing.id)).run();
  } else {
    db.insert(schema.teamReports).values({ teamId, weekStart, content: "", status: "draft", ...patch, updatedBy: user.id, updatedByName: user.name }).run();
  }
  revalidatePath("/team/report");
}

/** Ask OpenAI for a draft from the week's records and store it (overwrites the current content). */
export async function generateTeamReport(teamId: number, weekStart: string, instructions?: string): Promise<ReportResult> {
  try {
    const user = await editor(teamId);
    if (!validWeek(weekStart)) return { ok: false, error: "주차가 올바르지 않습니다." };
    const src = collectWeekSource(teamId, weekStart);
    if (!src) return { ok: false, error: "팀을 찾을 수 없습니다." };
    const hasData = src.members.some((m) => m.weeklyItems.length || m.doneTasks.length || m.extras.length || m.result);
    if (!hasData) return { ok: false, error: "이 주에 구성원 기록이 없어 보고서를 만들 수 없습니다." };

    const { content, model } = await chatCompletion([
      { role: "system", content: REPORT_SYSTEM_PROMPT },
      { role: "user", content: reportUserPrompt(renderSource(src), instructions) },
    ]);
    upsert(teamId, weekStart, { content, model, generatedAt: new Date(), status: "draft" }, user);
    return { ok: true, content, model, message: "AI 초안을 만들었습니다. 내용을 검토하고 수정하세요." };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "보고서 생성에 실패했습니다." };
  }
}

export async function saveTeamReport(teamId: number, weekStart: string, content: string, status: ReportStatus): Promise<ReportResult> {
  try {
    const user = await editor(teamId);
    if (!validWeek(weekStart)) return { ok: false, error: "주차가 올바르지 않습니다." };
    if (!REPORT_STATUSES.includes(status)) return { ok: false, error: "상태가 올바르지 않습니다." };
    const clean = content.replace(/\r\n/g, "\n").trimEnd();
    if (clean.length > 20000) return { ok: false, error: "보고서는 20,000자 이내로 작성하세요." };
    if (status === "final" && !clean.trim()) return { ok: false, error: "내용이 비어 있어 확정할 수 없습니다." };
    upsert(teamId, weekStart, { content: clean, status }, user);
    return { ok: true, content: clean, message: status === "final" ? "보고서를 확정했습니다. 팀 구성원도 볼 수 있습니다." : "저장했습니다." };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "저장에 실패했습니다." };
  }
}
