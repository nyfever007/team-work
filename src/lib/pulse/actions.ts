"use server";

import { revalidatePath } from "next/cache";
import { requireMember } from "@/lib/auth/dal";
import { todayKey, weekStartOf } from "@/lib/dates";
import { db, schema } from "@/lib/db";
import { memberById } from "@/lib/members/queries";
import { isPulseValue } from "./types";

export type PulseActionResult = { ok: true; message: string } | { ok: false; error: string };

const COMMENT_MAX = 300;

/** Answer (or change) this week's 펄스 체크. Upsert on (member, week); the row takes the member's current team. */
export async function submitPulse(input: { workload: number; mood: number; comment: string }): Promise<PulseActionResult> {
  try {
    const user = await requireMember();
    const me = memberById(user.memberId);
    if (!me) throw new Error("구성원 정보를 찾을 수 없습니다.");
    const workload = Number(input.workload);
    const mood = Number(input.mood);
    if (!isPulseValue(workload) || !isPulseValue(mood)) throw new Error("업무량과 기분을 모두 골라 주세요.");
    const comment = String(input.comment ?? "").trim();
    if (comment.length > COMMENT_MAX) throw new Error(`코멘트는 ${COMMENT_MAX}자 이내로 입력하세요.`);
    const weekStart = weekStartOf(todayKey());
    db.insert(schema.pulseResponses)
      .values({ teamId: me.teamId, memberId: me.id, weekStart, workload, mood, comment })
      .onConflictDoUpdate({
        target: [schema.pulseResponses.memberId, schema.pulseResponses.weekStart],
        set: { teamId: me.teamId, workload, mood, comment, updatedAt: new Date() },
      })
      .run();
    revalidatePath("/lounge", "layout");
    return { ok: true, message: "응답을 저장했습니다." };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "저장에 실패했습니다." };
  }
}
