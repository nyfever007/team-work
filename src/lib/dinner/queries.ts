import "server-only";
import { and, asc, desc, eq, inArray } from "drizzle-orm";
import type { SafeUser } from "@/lib/auth/session";
import { db, schema } from "@/lib/db";
import type { DinnerRequest } from "@/lib/db/schema";
import { allMembers } from "@/lib/members/queries";
import { requestAccess } from "@/lib/requests/queries";

// Visibility / approval rules are the same as leave requests: see requestAccess().

export function dinnerById(id: number): DinnerRequest | undefined {
  return db.select().from(schema.dinnerRequests).where(eq(schema.dinnerRequests.id, id)).get();
}

export function dinnerFor(memberIds: number[], limit = 300): DinnerRequest[] {
  if (memberIds.length === 0) return [];
  return db.select().from(schema.dinnerRequests).where(inArray(schema.dinnerRequests.memberId, memberIds)).orderBy(desc(schema.dinnerRequests.createdAt)).limit(limit).all();
}

/** The live (pending or approved) 정산 filed from this 전산, if any. */
export function liveSettleOf(budgetId: number): DinnerRequest | undefined {
  return db
    .select()
    .from(schema.dinnerRequests)
    .where(and(eq(schema.dinnerRequests.parentId, budgetId), eq(schema.dinnerRequests.stage, "settle"), inArray(schema.dinnerRequests.status, ["submitted", "approved"])))
    .get();
}

/** Approved 전산 rows of the member that don't have a live 정산 yet — the ones ready for step 2. */
export function budgetsAwaitingSettle(memberIds: number[]): DinnerRequest[] {
  if (memberIds.length === 0) return [];
  const approved = db
    .select()
    .from(schema.dinnerRequests)
    .where(and(inArray(schema.dinnerRequests.memberId, memberIds), eq(schema.dinnerRequests.stage, "budget"), eq(schema.dinnerRequests.status, "approved")))
    .orderBy(desc(schema.dinnerRequests.decidedAt))
    .all();
  return approved.filter((b) => !liveSettleOf(b.id));
}

export function pendingDinnerFor(user: SafeUser): DinnerRequest[] {
  const access = requestAccess(user);
  const ids = allMembers().filter((m) => access.canApproveMember(m)).map((m) => m.id);
  if (ids.length === 0) return [];
  return db
    .select()
    .from(schema.dinnerRequests)
    .where(and(eq(schema.dinnerRequests.status, "submitted"), inArray(schema.dinnerRequests.memberId, ids)))
    .orderBy(asc(schema.dinnerRequests.createdAt))
    .all();
}

export function myOpenDinner(memberId: number): DinnerRequest[] {
  const since = Date.now() - 30 * 86_400_000;
  return db
    .select()
    .from(schema.dinnerRequests)
    .where(eq(schema.dinnerRequests.memberId, memberId))
    .orderBy(desc(schema.dinnerRequests.updatedAt))
    .all()
    .filter((r) => r.status === "submitted" || (r.status === "rejected" && r.updatedAt.getTime() >= since));
}
