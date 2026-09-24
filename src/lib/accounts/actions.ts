"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { requireAdmin, requireUser } from "@/lib/auth/dal";
import { hashPassword, verifyPassword } from "@/lib/auth/password";
import { db, schema } from "@/lib/db";
import { memberAccess } from "@/lib/members/access";

export type AccountState = { ok: true; message: string } | { ok: false; error: string } | undefined;

function checkPassword(pw: string): string | null {
  if (pw.length < 8) return "비밀번호는 8자 이상이어야 합니다.";
  if (pw.length > 100) return "비밀번호가 너무 깁니다.";
  return null;
}

/** Admin: create a new login for a member, or link an existing unlinked account. Team leader: create only, own team. */
export async function linkAccount(memberId: number, _prev: AccountState, formData: FormData): Promise<AccountState> {
  try {
    const actor = await requireUser();
    const member = db.select().from(schema.members).where(eq(schema.members.id, memberId)).get();
    if (!member) return { ok: false, error: "구성원을 찾을 수 없습니다." };
    // Team leaders may create (not link) a login for their own teammates.
    const access = memberAccess(actor);
    if (!access.isAdmin && !(access.canManage(member) && String(formData.get("mode") ?? "new") === "new")) return { ok: false, error: "관리자 권한이 필요합니다." };
    const already = db.select().from(schema.users).where(eq(schema.users.memberId, memberId)).get();
    if (already) return { ok: false, error: "이미 계정이 연결된 구성원입니다." };

    const mode = String(formData.get("mode") ?? "new");
    if (mode === "existing") {
      const userId = Number(formData.get("userId"));
      const user = db.select().from(schema.users).where(eq(schema.users.id, userId)).get();
      if (!user) return { ok: false, error: "계정을 선택하세요." };
      if (user.memberId != null) return { ok: false, error: "이미 다른 구성원에 연결된 계정입니다." };
      db.update(schema.users).set({ memberId }).where(eq(schema.users.id, userId)).run();
      revalidatePath("/admin/members");
      return { ok: true, message: `${user.username} 계정을 연결했습니다.` };
    }

    const email = member.email.trim().toLowerCase();
    const password = String(formData.get("password") ?? "");
    if (!email) return { ok: false, error: "구성원 정보에 이메일이 없습니다. 구성원 수정에서 이메일을 먼저 입력하세요." };
    const pwError = checkPassword(password);
    if (pwError) return { ok: false, error: pwError };
    if (db.select().from(schema.users).where(eq(schema.users.email, email)).get() || db.select().from(schema.users).where(eq(schema.users.username, email)).get()) {
      return { ok: false, error: "이미 이 이메일로 만든 계정이 있습니다. ‘기존 계정 연결’을 사용하세요." };
    }
    db.insert(schema.users)
      .values({ username: email, email, name: member.name, role: "member", memberId, passwordHash: hashPassword(password) })
      .run();
    revalidatePath("/admin/members");
    revalidatePath("/team/members", "layout");
    revalidatePath("/");
    return { ok: true, message: `${email} 계정을 만들었습니다. 초기 비밀번호를 본인에게 전달하세요.` };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "처리에 실패했습니다." };
  }
}

/** Admin: set a new password for any account. */
export async function resetPassword(userId: number, _prev: AccountState, formData: FormData): Promise<AccountState> {
  try {
    await requireAdmin();
    const password = String(formData.get("password") ?? "");
    const pwError = checkPassword(password);
    if (pwError) return { ok: false, error: pwError };
    const r = db.update(schema.users).set({ passwordHash: hashPassword(password) }).where(eq(schema.users.id, userId)).run();
    if (r.changes === 0) return { ok: false, error: "계정을 찾을 수 없습니다." };
    // Sign that account out everywhere.
    db.delete(schema.sessions).where(eq(schema.sessions.userId, userId)).run();
    return { ok: true, message: "비밀번호를 재설정했습니다." };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "처리에 실패했습니다." };
  }
}

/** Admin: unlink an account from its member (account stays, member stays). */
export async function unlinkAccount(userId: number): Promise<{ ok: boolean; error?: string }> {
  try {
    await requireAdmin();
    db.update(schema.users).set({ memberId: null }).where(eq(schema.users.id, userId)).run();
    revalidatePath("/admin/members");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "처리에 실패했습니다." };
  }
}

/** Anyone: change own password. */
export async function changeOwnPassword(_prev: AccountState, formData: FormData): Promise<AccountState> {
  try {
    const me = await requireUser();
    const current = String(formData.get("current") ?? "");
    const next = String(formData.get("next") ?? "");
    const confirm = String(formData.get("confirm") ?? "");
    const row = db.select().from(schema.users).where(eq(schema.users.id, me.id)).get();
    if (!row || !verifyPassword(current, row.passwordHash)) {
      return { ok: false, error: "현재 비밀번호가 올바르지 않습니다." };
    }
    const pwError = checkPassword(next);
    if (pwError) return { ok: false, error: pwError };
    if (next !== confirm) return { ok: false, error: "새 비밀번호가 서로 일치하지 않습니다." };
    db.update(schema.users).set({ passwordHash: hashPassword(next) }).where(eq(schema.users.id, me.id)).run();
    return { ok: true, message: "비밀번호를 변경했습니다." };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "처리에 실패했습니다." };
  }
}
