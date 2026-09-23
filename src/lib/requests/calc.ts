import { addDays, isWeekend, parseKey } from "@/lib/dates";
import { LEAVE_COST, LEAVE_DAYS, SINGLE_DAY_TYPES, type LeaveType } from "@/lib/leaves/types";

/** Dates within [start, end] that count for this type (working days; single-day types use start only). */
export function requestDates(type: LeaveType, start: string, end: string, holidays: Set<string>): string[] {
  if (SINGLE_DAY_TYPES.includes(type)) return [start];
  const out: string[] = [];
  for (let d = start; parseKey(d) <= parseKey(end); d = addDays(d, 1)) if (!isWeekend(d) && !holidays.has(d)) out.push(d);
  return out;
}

export function requestDays(type: LeaveType, dates: string[]) {
  return dates.length * LEAVE_DAYS[type];
}

export function requestAnnualCost(type: LeaveType, dates: string[]) {
  return dates.length * LEAVE_COST[type];
}

export function formatDays(n: number) {
  return Number.isInteger(n) ? String(n) : n.toFixed(1);
}
