import "server-only";
import { and, gte, lte } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import { isWeekend, weekDays } from "./dates";

export type HolidayMap = Map<string, string>; // date -> name

export function loadHolidays(from: string, to: string): HolidayMap {
  const rows = db
    .select()
    .from(schema.holidays)
    .where(and(gte(schema.holidays.date, from), lte(schema.holidays.date, to)))
    .all();
  return new Map(rows.map((h) => [h.date, h.name]));
}

export function isWorkingDay(key: string, holidays: HolidayMap): boolean {
  return !isWeekend(key) && !holidays.has(key);
}

export type WeekInfo = {
  weekStart: string;
  days: string[]; // Mon..Sun
  workingDays: string[];
  firstWorkingDay: string | null;
  lastWorkingDay: string | null;
};

export function weekInfo(weekStart: string, holidays: HolidayMap): WeekInfo {
  const days = weekDays(weekStart);
  const workingDays = days.filter((d) => isWorkingDay(d, holidays));
  return {
    weekStart,
    days,
    workingDays,
    firstWorkingDay: workingDays[0] ?? null,
    lastWorkingDay: workingDays[workingDays.length - 1] ?? null,
  };
}
