import "server-only";
import { and, asc, desc, eq, gte, inArray, lte, or } from "drizzle-orm";
import type { SafeUser } from "@/lib/auth/session";
import { addDays, todayKey } from "@/lib/dates";
import { db, schema } from "@/lib/db";
import type { LeaveRequest } from "@/lib/db/schema";
import { allMembers, memberById } from "@/lib/members/queries";
import { loadHolidays } from "@/lib/workdays";
import { requestAnnualCost, requestDates, requestDays } from "./calc";

export function requestById(id: number) {
  return db.select().from(schema.leaveRequests).where(eq(schema.leaveRequests.id, id)).get();
}

export function requestsFor(memberIds: number[], limit = 100) {
  if (memberIds.length === 0) return [];
  return db.select().from(schema.leaveRequests).where(inArray(schema.leaveRequests.memberId, memberIds)).orderBy(desc(schema.leaveRequests.createdAt)).limit(limit).all();
}

/**
 * Admin: everyone. Leader: own team. Member: self.
 * Approval: admin, or the leader of the requester's team (never their own request; a leader's own request goes to admin).
 */
export function requestAccess(user: SafeUser) {
  const me = user.memberId != null ? memberById(user.memberId) : undefined;
  const isAdmin = user.role === "admin";
  const leaderOf = me?.isLeader ? me.teamId : null;
  const canApproveMember = (m: { id: number; teamId: number }) => isAdmin || (leaderOf !== null && m.teamId === leaderOf && m.id !== me?.id);
  return {
    me,
    isAdmin,
    canView: (m: { id: number; teamId: number }) => isAdmin || m.id === me?.id || (!!me?.isLeader && me.teamId === m.teamId),
    canCreateFor: (memberId: number) => isAdmin || memberId === me?.id,
    canCancel: (r: { memberId: number }) => isAdmin || r.memberId === me?.id,
    canApproveMember,
    canApprove: (r: { memberId: number }) => {
      const m = memberById(r.memberId);
      return !!m && canApproveMember(m);
    },
  };
}

/** Requests waiting for this user's decision, oldest first. */
export function pendingRequestsFor(user: SafeUser): LeaveRequest[] {
  const access = requestAccess(user);
  const ids = allMembers().filter((m) => access.canApproveMember(m)).map((m) => m.id);
  if (ids.length === 0) return [];
  return db
    .select()
    .from(schema.leaveRequests)
    .where(and(eq(schema.leaveRequests.status, "submitted"), inArray(schema.leaveRequests.memberId, ids)))
    .orderBy(asc(schema.leaveRequests.createdAt))
    .all();
}

/** A member's own not-yet-approved requests: all pending, plus rejections from the last 30 days. */
export function myOpenRequests(memberId: number): LeaveRequest[] {
  const since = new Date(`${addDays(todayKey(), -30)}T00:00:00+09:00`);
  return db
    .select()
    .from(schema.leaveRequests)
    .where(and(eq(schema.leaveRequests.memberId, memberId), or(eq(schema.leaveRequests.status, "submitted"), and(eq(schema.leaveRequests.status, "rejected"), gte(schema.leaveRequests.updatedAt, since)))))
    .orderBy(desc(schema.leaveRequests.updatedAt))
    .all();
}

/** Annual / sick days held by the member's pending requests that start inside [from, to]. */
export function pendingUsage(memberId: number, from: string, to: string, excludeId?: number): { annual: number; sick: number } {
  const rows = db
    .select()
    .from(schema.leaveRequests)
    .where(and(eq(schema.leaveRequests.memberId, memberId), eq(schema.leaveRequests.status, "submitted"), gte(schema.leaveRequests.startDate, from), lte(schema.leaveRequests.startDate, to)))
    .all()
    .filter((r) => r.id !== excludeId);
  let annual = 0;
  let sick = 0;
  for (const r of rows) {
    const dates = requestDates(r.type, r.startDate, r.endDate, new Set(loadHolidays(r.startDate, r.endDate).keys()));
    annual += requestAnnualCost(r.type, dates);
    if (r.type === "sick") sick += requestDays(r.type, dates);
  }
  return { annual, sick };
}

/** Pending requests of the member overlapping [start, end]. */
export function overlappingPending(memberId: number, start: string, end: string, excludeId?: number) {
  return db
    .select()
    .from(schema.leaveRequests)
    .where(and(eq(schema.leaveRequests.memberId, memberId), eq(schema.leaveRequests.status, "submitted"), lte(schema.leaveRequests.startDate, end), gte(schema.leaveRequests.endDate, start)))
    .all()
    .filter((r) => r.id !== excludeId);
}
