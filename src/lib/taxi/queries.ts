import "server-only";
import { and, asc, desc, eq, inArray } from "drizzle-orm";
import type { SafeUser } from "@/lib/auth/session";
import { db, schema } from "@/lib/db";
import type { TaxiRequest } from "@/lib/db/schema";
import { allMembers } from "@/lib/members/queries";
import { requestAccess } from "@/lib/requests/queries";

// Visibility / approval rules are the same as leave requests: see requestAccess().

export function taxiById(id: number): TaxiRequest | undefined {
  return db.select().from(schema.taxiRequests).where(eq(schema.taxiRequests.id, id)).get();
}

export function taxiFor(memberIds: number[], limit = 200): TaxiRequest[] {
  if (memberIds.length === 0) return [];
  return db.select().from(schema.taxiRequests).where(inArray(schema.taxiRequests.memberId, memberIds)).orderBy(desc(schema.taxiRequests.createdAt)).limit(limit).all();
}

export function pendingTaxiFor(user: SafeUser): TaxiRequest[] {
  const access = requestAccess(user);
  const ids = allMembers().filter((m) => access.canApproveMember(m)).map((m) => m.id);
  if (ids.length === 0) return [];
  return db
    .select()
    .from(schema.taxiRequests)
    .where(and(eq(schema.taxiRequests.status, "submitted"), inArray(schema.taxiRequests.memberId, ids)))
    .orderBy(asc(schema.taxiRequests.createdAt))
    .all();
}

export function myOpenTaxi(memberId: number): TaxiRequest[] {
  const since = Date.now() - 30 * 86_400_000;
  return db
    .select()
    .from(schema.taxiRequests)
    .where(eq(schema.taxiRequests.memberId, memberId))
    .orderBy(desc(schema.taxiRequests.updatedAt))
    .all()
    .filter((r) => r.status === "submitted" || (r.status === "rejected" && r.updatedAt.getTime() >= since));
}
