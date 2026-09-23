import "server-only";
import { desc, eq, inArray } from "drizzle-orm";
import type { SafeUser } from "@/lib/auth/session";
import { db, schema } from "@/lib/db";
import { memberById } from "@/lib/members/queries";

export function requestById(id: number) {
  return db.select().from(schema.leaveRequests).where(eq(schema.leaveRequests.id, id)).get();
}

export function requestsFor(memberIds: number[], limit = 100) {
  if (memberIds.length === 0) return [];
  return db.select().from(schema.leaveRequests).where(inArray(schema.leaveRequests.memberId, memberIds)).orderBy(desc(schema.leaveRequests.createdAt)).limit(limit).all();
}

/** Admin: everyone. Leader: own team. Member: self. */
export function requestAccess(user: SafeUser) {
  const me = user.memberId != null ? memberById(user.memberId) : undefined;
  const isAdmin = user.role === "admin";
  return {
    me,
    isAdmin,
    canView: (m: { id: number; teamId: number }) => isAdmin || m.id === me?.id || (!!me?.isLeader && me.teamId === m.teamId),
    canCreateFor: (memberId: number) => isAdmin || memberId === me?.id,
    canCancel: (r: { memberId: number }) => isAdmin || r.memberId === me?.id,
  };
}
