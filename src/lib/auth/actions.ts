"use server";

import { eq, or } from "drizzle-orm";
import { redirect } from "next/navigation";
import { db, schema } from "@/lib/db";
import { verifyPassword } from "./password";
import { safeNextPath } from "./next-path";
import { createSession, destroySession } from "./session";

export type LoginState = { error?: string; username?: string } | undefined;

export async function login(_prev: LoginState, formData: FormData): Promise<LoginState> {
  const username = String(formData.get("username") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const next = safeNextPath(formData.get("next"));

  if (!username || !password) {
    return { error: "이메일과 비밀번호를 입력하세요.", username };
  }

  // Email login; legacy accounts without an email keep signing in with their username.
  const id = username.toLowerCase();
  const user = db
    .select()
    .from(schema.users)
    .where(or(eq(schema.users.email, id), eq(schema.users.username, id), eq(schema.users.username, username)))
    .get();

  if (!user || !verifyPassword(password, user.passwordHash)) {
    return { error: "이메일 또는 비밀번호가 올바르지 않습니다.", username };
  }

  await createSession(user.id);
  redirect(next);
}

export async function logout() {
  await destroySession();
  redirect("/login");
}
