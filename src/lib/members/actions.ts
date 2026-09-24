"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { requireAdmin, requireUser } from "@/lib/auth/dal";
import { hashPassword } from "@/lib/auth/password";
import { db, schema } from "@/lib/db";
import { memberAccess } from "./access";
import { memberInput, type MemberFieldErrors, type MemberInput } from "./schema";

export type MemberFormState =
  | { ok: true }
  | { ok: false; error?: string; fieldErrors?: MemberFieldErrors; values: Partial<MemberInput> }
  | undefined;

function parse(formData: FormData) {
  const raw = {
    teamId: String(formData.get("teamId") ?? ""),
    name: String(formData.get("name") ?? ""),
    position: String(formData.get("position") ?? ""),
    rank: String(formData.get("rank") ?? ""),
    email: String(formData.get("email") ?? ""),
    phone: String(formData.get("phone") ?? ""),
    joinedAt: String(formData.get("joinedAt") ?? ""),
    annualOverride: formData.get("annualMode") === "auto" ? "" : String(formData.get("annualOverride") ?? ""),
  };
  const result = memberInput.safeParse(raw);
  if (result.success) return { data: result.data, raw };
  const fieldErrors: MemberFieldErrors = {};
  for (const issue of result.error.issues) {
    const key = issue.path[0] as keyof MemberInput;
    if (key && !fieldErrors[key]) fieldErrors[key] = issue.message;
  }
  return { fieldErrors, raw };
}

function toValues(raw: Record<keyof MemberInput, string>): Partial<MemberInput> {
  return {
    ...raw,
    teamId: raw.teamId === "" ? undefined : Number(raw.teamId),
    annualOverride: raw.annualOverride === "" ? null : Number(raw.annualOverride),
  };
}

function emailTaken(email: string, exceptMemberId?: number) {
  const m = db.select({ id: schema.members.id }).from(schema.members).where(eq(schema.members.email, email)).get();
  if (m && m.id !== exceptMemberId) return true;
  const u = db.select({ id: schema.users.id, memberId: schema.users.memberId }).from(schema.users).where(eq(schema.users.email, email)).get();
  return !!u && u.memberId !== exceptMemberId;
}

function teamExists(teamId: number) {
  return !!db.select({ id: schema.teams.id }).from(schema.teams).where(eq(schema.teams.id, teamId)).get();
}

function revalidateMembers() {
  revalidatePath("/admin/members");
  revalidatePath("/team/members", "layout");
  revalidatePath("/");
}

/**
 * Admin or the leader of the target team. Leaders cannot set a contract leave override (kept / null).
 * An optional initial password creates the member's login (username = email) in the same step.
 */
export async function createMember(_prev: MemberFormState, formData: FormData): Promise<MemberFormState> {
  const user = await requireUser();
  const access = memberAccess(user);
  const { data, fieldErrors, raw } = parse(formData);
  if (!data) return { ok: false, fieldErrors, values: toValues(raw) };
  if (!teamExists(data.teamId)) return { ok: false, fieldErrors: { teamId: "팀을 선택하세요" }, values: toValues(raw) };
  if (!access.canManageTeam(data.teamId)) return { ok: false, error: "소속 팀에만 구성원을 추가할 수 있습니다.", values: toValues(raw) };
  if (emailTaken(data.email)) return { ok: false, fieldErrors: { email: "이미 사용 중인 이메일입니다" }, values: toValues(raw) };
  const password = String(formData.get("password") ?? "");
  if (password && (password.length < 8 || password.length > 100)) return { ok: false, fieldErrors: { password: "비밀번호는 8자 이상이어야 합니다" }, values: toValues(raw) };
  if (password && db.select({ id: schema.users.id }).from(schema.users).where(eq(schema.users.username, data.email)).get()) {
    return { ok: false, fieldErrors: { email: "이 이메일로 만든 계정이 이미 있습니다" }, values: toValues(raw) };
  }
  const values = { ...data, annualOverride: access.canSetAnnual ? data.annualOverride : null };

  db.transaction((tx) => {
    const r = tx.insert(schema.members).values(values).run();
    if (password) {
      tx.insert(schema.users)
        .values({ username: data.email, email: data.email, name: data.name, role: "member", memberId: Number(r.lastInsertRowid), passwordHash: hashPassword(password) })
        .run();
    }
  });
  revalidateMembers();
  return { ok: true };
}

export async function updateMember(
  id: number,
  _prev: MemberFormState,
  formData: FormData,
): Promise<MemberFormState> {
  const user = await requireUser();
  const access = memberAccess(user);
  const { data, fieldErrors, raw } = parse(formData);
  if (!data) return { ok: false, fieldErrors, values: toValues(raw) };
  if (!teamExists(data.teamId)) return { ok: false, fieldErrors: { teamId: "팀을 선택하세요" }, values: toValues(raw) };
  const current = db.select().from(schema.members).where(eq(schema.members.id, id)).get();
  if (!current) return { ok: false, error: "구성원을 찾을 수 없습니다.", values: toValues(raw) };
  if (!access.canManageTeam(current.teamId)) return { ok: false, error: "이 구성원을 수정할 권한이 없습니다.", values: toValues(raw) };
  if (!access.isAdmin && data.teamId !== current.teamId) return { ok: false, fieldErrors: { teamId: "팀 이동은 관리자만 할 수 있습니다" }, values: toValues(raw) };
  if (emailTaken(data.email, id)) return { ok: false, fieldErrors: { email: "이미 사용 중인 이메일입니다" }, values: toValues(raw) };
  const values = { ...data, annualOverride: access.canSetAnnual ? data.annualOverride : current.annualOverride };

  const result = db.transaction((tx) => {
    const r = tx
      .update(schema.members)
      .set({ ...values, updatedAt: new Date() })
      .where(eq(schema.members.id, id))
      .run();
    // Keep the linked login in sync so the member signs in with the new email (and the old one stops working).
    const linked = tx.select().from(schema.users).where(eq(schema.users.memberId, id)).get();
    if (linked) {
      const usernameIsEmail = linked.username.includes("@");
      tx.update(schema.users)
        .set({ email: data.email, name: data.name, ...(usernameIsEmail ? { username: data.email } : {}) })
        .where(eq(schema.users.id, linked.id))
        .run();
    }
    return r;
  });
  if (result.changes === 0) return { ok: false, error: "구성원을 찾을 수 없습니다.", values: toValues(raw) };

  revalidateMembers();
  return { ok: true };
}

export async function deleteMember(id: number): Promise<{ ok: boolean; error?: string }> {
  try {
    await requireAdmin();
    const changes = db.transaction((tx) => {
      // Detach any login account first; logs, leaves and reports cascade.
      tx.update(schema.users).set({ memberId: null }).where(eq(schema.users.memberId, id)).run();
      tx.update(schema.teams).set({ leaderMemberId: null }).where(eq(schema.teams.leaderMemberId, id)).run();
      return tx.delete(schema.members).where(eq(schema.members.id, id)).run().changes;
    });
    if (changes === 0) return { ok: false, error: "구성원을 찾을 수 없습니다." };
    revalidatePath("/admin/members");
    revalidatePath("/");
    revalidatePath("/team");
    revalidatePath("/schedule");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "구성원 삭제에 실패했습니다." };
  }
}
