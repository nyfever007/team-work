import "server-only";
import { and, eq, gte, lte } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import type { Member } from "@/lib/members/types";
import { accruedAnnual, defaultAnnualDays, describeAnnualRule, leaveYear } from "./policy";
import { LEAVE_COST, LEAVE_DAYS, type LeaveType } from "./types";

/** 병가 allowance per employment year (from the join-date anniversary). */
export const SICK_LEAVE_DAYS = Number(process.env.SICK_LEAVE_DAYS ?? 5);

export type LeaveBalance = {
  period: { start: string; end: string; yearIndex: number };
  annual: {
    mode: "auto" | "override";
    rule: string;
    /** Entitlement for the whole leave year. */
    total: number;
    /** Available so far (first year accrues monthly). */
    accrued: number;
    used: number;
    remaining: number;
  };
  sick: { allowance: number; used: number; remaining: number };
  /** Other categories used in this leave year (days). */
  others: { type: LeaveType; days: number }[];
};

/** Annual entitlement for a member's current leave year (override or policy). */
export function annualEntitlement(member: Pick<Member, "joinedAt" | "annualOverride">, today: string) {
  const period = leaveYear(member.joinedAt, today);
  const total = member.annualOverride ?? defaultAnnualDays(period.yearIndex);
  const accrued = member.annualOverride != null ? total : accruedAnnual(member.joinedAt, today, total, period.yearIndex);
  return { period, total, accrued, mode: member.annualOverride != null ? ("override" as const) : ("auto" as const) };
}

export function leaveBalance(member: Member, today: string): LeaveBalance {
  const { period, total, accrued, mode } = annualEntitlement(member, today);
  const rows = db
    .select({ date: schema.leaves.date, type: schema.leaves.type })
    .from(schema.leaves)
    .where(and(eq(schema.leaves.memberId, member.id), gte(schema.leaves.date, period.start), lte(schema.leaves.date, period.end)))
    .all();

  const annualUsed = rows.reduce((n, r) => n + LEAVE_COST[r.type], 0);
  const sickUsed = rows.filter((r) => r.type === "sick").reduce((n) => n + LEAVE_DAYS.sick, 0);
  const others = new Map<LeaveType, number>();
  for (const r of rows) {
    if (LEAVE_COST[r.type] > 0 || r.type === "sick") continue;
    others.set(r.type, (others.get(r.type) ?? 0) + LEAVE_DAYS[r.type]);
  }

  return {
    period,
    annual: { mode, rule: mode === "override" ? "계약에 따라 지정" : describeAnnualRule(period.yearIndex), total, accrued, used: annualUsed, remaining: accrued - annualUsed },
    sick: { allowance: SICK_LEAVE_DAYS, used: sickUsed, remaining: SICK_LEAVE_DAYS - sickUsed },
    others: [...others.entries()].map(([type, days]) => ({ type, days })).filter((o) => o.days > 0),
  };
}
