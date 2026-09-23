import "server-only";
import { createHash, randomBytes } from "node:crypto";
import { eq, lt } from "drizzle-orm";
import { cookies } from "next/headers";
import { cache } from "react";
import { db, schema } from "@/lib/db";
import type { User } from "@/lib/db/schema";

export const SESSION_COOKIE = "session";

const ttlDays = Number(process.env.SESSION_TTL_DAYS ?? 30);
const SESSION_TTL_MS = ttlDays * 24 * 60 * 60 * 1000;

function hashToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export type SafeUser = Pick<User, "id" | "username" | "email" | "name" | "role" | "memberId" | "createdAt">;

function toSafeUser(u: User): SafeUser {
  return { id: u.id, username: u.username, email: u.email, name: u.name, role: u.role, memberId: u.memberId, createdAt: u.createdAt };
}

export async function createSession(userId: number) {
  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS);

  db.insert(schema.sessions).values({ id: hashToken(token), userId, expiresAt }).run();
  // Opportunistically purge expired sessions.
  db.delete(schema.sessions).where(lt(schema.sessions.expiresAt, new Date())).run();

  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.COOKIE_SECURE === "true",
    expires: expiresAt,
    path: "/",
  });
}

export async function destroySession() {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  if (token) {
    db.delete(schema.sessions).where(eq(schema.sessions.id, hashToken(token))).run();
  }
  cookieStore.delete(SESSION_COOKIE);
}

/**
 * Secure, DB-backed check. Cached per request.
 * Returns null when there is no valid session.
 */
export const getCurrentUser = cache(async (): Promise<SafeUser | null> => {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  if (!token) return null;

  const row = db
    .select({ session: schema.sessions, user: schema.users })
    .from(schema.sessions)
    .innerJoin(schema.users, eq(schema.sessions.userId, schema.users.id))
    .where(eq(schema.sessions.id, hashToken(token)))
    .get();

  if (!row) return null;
  if (row.session.expiresAt.getTime() < Date.now()) {
    db.delete(schema.sessions).where(eq(schema.sessions.id, row.session.id)).run();
    return null;
  }
  return toSafeUser(row.user);
});
