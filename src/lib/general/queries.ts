import "server-only";
import { and, asc, desc, eq, inArray } from "drizzle-orm";
import type { SafeUser } from "@/lib/auth/session";
import { db, schema } from "@/lib/db";
import type { GeneralRequest } from "@/lib/db/schema";
import { allMembers } from "@/lib/members/queries";
import { requestAccess } from "@/lib/requests/queries";

// Visibility / approval rules are the same as leave requests: see requestAccess().

export function generalById(id: number): GeneralRequest | undefined {
  return db.select().from(schema.generalRequests).where(eq(schema.generalRequests.id, id)).get();
}

export function generalFor(memberIds: number[], limit = 200): GeneralRequest[] {
  if (memberIds.length === 0) return [];
  return db.select().from(schema.generalRequests).where(inArray(schema.generalRequests.memberId, memberIds)).orderBy(desc(schema.generalRequests.createdAt)).limit(limit).all();
}

export function pendingGeneralFor(user: SafeUser): GeneralRequest[] {
  const access = requestAccess(user);
  const ids = allMembers().filter((m) => access.canApproveMember(m)).map((m) => m.id);
  if (ids.length === 0) return [];
  return db
    .select()
    .from(schema.generalRequests)
    .where(and(eq(schema.generalRequests.status, "submitted"), inArray(schema.generalRequests.memberId, ids)))
    .orderBy(asc(schema.generalRequests.createdAt))
    .all();
}

export function myOpenGeneral(memberId: number): GeneralRequest[] {
  const since = Date.now() - 30 * 86_400_000;
  return db
    .select()
    .from(schema.generalRequests)
    .where(eq(schema.generalRequests.memberId, memberId))
    .orderBy(desc(schema.generalRequests.updatedAt))
    .all()
    .filter((r) => r.status === "submitted" || (r.status === "rejected" && r.updatedAt.getTime() >= since));
}
