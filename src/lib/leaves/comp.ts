import "server-only";
import { and, desc, eq, inArray } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import type { CompLeaveGrant } from "@/lib/db/schema";

/**
 * A 보상휴가 grant with its usage: approved requests count as used, submitted ones as pending.
 * `remaining` = days − used (like the annual balance); `available` also holds back pending days (what a new request may take).
 */
export type CompGrantUsage = CompLeaveGrant & { used: number; pending: number; remaining: number; available: number };

export type CompSummary = { total: number; used: number; pending: number; remaining: number; available: number; grants: CompGrantUsage[] };

/** Grants of these members (newest first) with usage from their 보상휴가 requests. Not tied to the leave year. */
export function compGrantsFor(memberIds: number[]): CompGrantUsage[] {
  if (memberIds.length === 0) return [];
  const grants = db.select().from(schema.compLeaveGrants).where(inArray(schema.compLeaveGrants.memberId, memberIds)).orderBy(desc(schema.compLeaveGrants.grantedOn), desc(schema.compLeaveGrants.id)).all();
  if (grants.length === 0) return [];
  const reqs = db
    .select({ grantId: schema.leaveRequests.compGrantId, status: schema.leaveRequests.status, days: schema.leaveRequests.days })
    .from(schema.leaveRequests)
    .where(and(eq(schema.leaveRequests.type, "compensatory"), inArray(schema.leaveRequests.compGrantId, grants.map((g) => g.id)), inArray(schema.leaveRequests.status, ["submitted", "approved"])))
    .all();
  return grants.map((g) => {
    const mine = reqs.filter((r) => r.grantId === g.id);
    const used = mine.filter((r) => r.status === "approved").reduce((n, r) => n + r.days, 0);
    const pending = mine.filter((r) => r.status === "submitted").reduce((n, r) => n + r.days, 0);
    return { ...g, used, pending, remaining: g.days - used, available: g.days - used - pending };
  });
}

export function compGrantById(id: number): CompGrantUsage | undefined {
  const g = db.select({ memberId: schema.compLeaveGrants.memberId }).from(schema.compLeaveGrants).where(eq(schema.compLeaveGrants.id, id)).get();
  return g ? compGrantsFor([g.memberId]).find((x) => x.id === id) : undefined;
}

export function summarize(grants: CompGrantUsage[]): CompSummary {
  const sum = (f: (g: CompGrantUsage) => number) => grants.reduce((n, g) => n + f(g), 0);
  return { total: sum((g) => g.days), used: sum((g) => g.used), pending: sum((g) => g.pending), remaining: sum((g) => g.remaining), available: sum((g) => g.available), grants };
}

export function compSummary(memberId: number): CompSummary {
  return summarize(compGrantsFor([memberId]));
}
