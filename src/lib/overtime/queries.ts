import "server-only";
import { and, asc, desc, eq, inArray } from "drizzle-orm";
import type { SafeUser } from "@/lib/auth/session";
import { db, schema } from "@/lib/db";
import type { OvertimeRequest } from "@/lib/db/schema";
import { allMembers } from "@/lib/members/queries";
import { requestAccess } from "@/lib/requests/queries";

// Visibility / approval rules are the same as leave requests: see requestAccess().

export function overtimeById(id: number): OvertimeRequest | undefined {
  return db.select().from(schema.overtimeRequests).where(eq(schema.overtimeRequests.id, id)).get();
}

export function overtimeFor(memberIds: number[], limit = 200): OvertimeRequest[] {
  if (memberIds.length === 0) return [];
  return db.select().from(schema.overtimeRequests).where(inArray(schema.overtimeRequests.memberId, memberIds)).orderBy(desc(schema.overtimeRequests.startAt)).limit(limit).all();
}

/** Overtime requests waiting for this user's decision, oldest first. */
export function pendingOvertimeFor(user: SafeUser): OvertimeRequest[] {
  const access = requestAccess(user);
  const ids = allMembers().filter((m) => access.canApproveMember(m)).map((m) => m.id);
  if (ids.length === 0) return [];
  return db
    .select()
    .from(schema.overtimeRequests)
    .where(and(eq(schema.overtimeRequests.status, "submitted"), inArray(schema.overtimeRequests.memberId, ids)))
    .orderBy(asc(schema.overtimeRequests.createdAt))
    .all();
}

/** The member's own pending requests plus recent rejections (for the 오늘 "내 승인 요청" card). */
export function myOpenOvertime(memberId: number): OvertimeRequest[] {
  const since = Date.now() - 30 * 86_400_000;
  return db
    .select()
    .from(schema.overtimeRequests)
    .where(eq(schema.overtimeRequests.memberId, memberId))
    .orderBy(desc(schema.overtimeRequests.updatedAt))
    .all()
    .filter((r) => r.status === "submitted" || (r.status === "rejected" && r.updatedAt.getTime() >= since));
}
