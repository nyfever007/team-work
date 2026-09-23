"use server";

import { and, eq, ne } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth/dal";
import { db, schema } from "@/lib/db";

export type TeamState = { ok: true; message: string } | { ok: false; error: string } | undefined;

function revalidate() {
  revalidatePath("/admin/teams");
  revalidatePath("/admin/members");
  revalidatePath("/team");
  revalidatePath("/");
}

function cleanName(v: unknown) {
  return String(v ?? "").replace(/\s+/g, " ").trim();
}

export async function createTeam(_prev: TeamState, formData: FormData): Promise<TeamState> {
  try {
    await requireAdmin();
    const name = cleanName(formData.get("name"));
    if (!name) return { ok: false, error: "팀 이름을 입력하세요." };
    if (name.length > 50) return { ok: false, error: "팀 이름은 50자 이내로 입력하세요." };
    if (db.select().from(schema.teams).where(eq(schema.teams.name, name)).get()) return { ok: false, error: "같은 이름의 팀이 이미 있습니다." };
    db.insert(schema.teams).values({ name }).run();
    revalidate();
    return { ok: true, message: `${name} 팀을 만들었습니다.` };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "처리에 실패했습니다." };
  }
}

export async function renameTeam(id: number, _prev: TeamState, formData: FormData): Promise<TeamState> {
  try {
    await requireAdmin();
    const name = cleanName(formData.get("name"));
    if (!name) return { ok: false, error: "팀 이름을 입력하세요." };
    if (db.select().from(schema.teams).where(and(eq(schema.teams.name, name), ne(schema.teams.id, id))).get()) return { ok: false, error: "같은 이름의 팀이 이미 있습니다." };
    const r = db.update(schema.teams).set({ name }).where(eq(schema.teams.id, id)).run();
    if (r.changes === 0) return { ok: false, error: "팀을 찾을 수 없습니다." };
    revalidate();
    return { ok: true, message: "팀 이름을 바꿨습니다." };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "처리에 실패했습니다." };
  }
}

/** Set (or clear with null) the team leader. The leader must belong to the team. */
export async function setTeamLeader(teamId: number, memberId: number | null): Promise<{ ok: boolean; error?: string }> {
  try {
    await requireAdmin();
    if (memberId != null) {
      const m = db.select().from(schema.members).where(eq(schema.members.id, memberId)).get();
      if (!m || m.teamId !== teamId) return { ok: false, error: "이 팀의 구성원만 팀장으로 지정할 수 있습니다." };
    }
    const r = db.update(schema.teams).set({ leaderMemberId: memberId }).where(eq(schema.teams.id, teamId)).run();
    if (r.changes === 0) return { ok: false, error: "팀을 찾을 수 없습니다." };
    revalidate();
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "처리에 실패했습니다." };
  }
}

/** Delete an empty team (no members, no milestones). */
export async function deleteTeam(id: number): Promise<{ ok: boolean; error?: string }> {
  try {
    await requireAdmin();
    if (db.select({ id: schema.members.id }).from(schema.members).where(eq(schema.members.teamId, id)).get()) return { ok: false, error: "구성원이 있는 팀은 삭제할 수 없습니다. 먼저 구성원의 팀을 옮기세요." };
    if (db.select({ id: schema.milestones.id }).from(schema.milestones).where(eq(schema.milestones.teamId, id)).get()) return { ok: false, error: "마일스톤이 있는 팀은 삭제할 수 없습니다." };
    db.delete(schema.teams).where(eq(schema.teams.id, id)).run();
    revalidate();
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "처리에 실패했습니다." };
  }
}
