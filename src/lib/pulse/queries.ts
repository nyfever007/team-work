import "server-only";
import { and, asc, eq, inArray } from "drizzle-orm";
import { addDays } from "@/lib/dates";
import { db, schema } from "@/lib/db";
import { PULSE_MIN_RESPONSES } from "./types";

/** Has this member answered the 펄스 체크 for the week? (drives the 라운지 tab badge) */
export function pulseAnswered(memberId: number, weekStart: string): boolean {
  return !!db.select({ id: schema.pulseResponses.id }).from(schema.pulseResponses).where(and(eq(schema.pulseResponses.memberId, memberId), eq(schema.pulseResponses.weekStart, weekStart))).get();
}

/** The member's own answer for the week (only ever shown back to that member). */
export function myPulse(memberId: number, weekStart: string): { workload: number; mood: number; comment: string } | null {
  return (
    db
      .select({ workload: schema.pulseResponses.workload, mood: schema.pulseResponses.mood, comment: schema.pulseResponses.comment })
      .from(schema.pulseResponses)
      .where(and(eq(schema.pulseResponses.memberId, memberId), eq(schema.pulseResponses.weekStart, weekStart)))
      .get() ?? null
  );
}

/** Mondays, oldest first, ending at `weekStart`. */
export function lastWeeks(weekStart: string, n: number): string[] {
  return Array.from({ length: n }, (_, i) => addDays(weekStart, -7 * (n - 1 - i)));
}

const round1 = (v: number) => Math.round(v * 10) / 10;

/**
 * Team aggregates per week (in the order of `weeks`). Averages are null below PULSE_MIN_RESPONSES so no one is identifiable.
 * Never returns member ids or individual values.
 */
export function pulseTrend(teamId: number, weeks: string[]): { weekStart: string; responses: number; workload: number | null; mood: number | null }[] {
  const rows = weeks.length
    ? db
        .select({ weekStart: schema.pulseResponses.weekStart, workload: schema.pulseResponses.workload, mood: schema.pulseResponses.mood })
        .from(schema.pulseResponses)
        .where(and(eq(schema.pulseResponses.teamId, teamId), inArray(schema.pulseResponses.weekStart, weeks)))
        .all()
    : [];
  return weeks.map((weekStart) => {
    const inWeek = rows.filter((r) => r.weekStart === weekStart);
    const n = inWeek.length;
    const enough = n >= PULSE_MIN_RESPONSES;
    return {
      weekStart,
      responses: n,
      workload: enough ? round1(inWeek.reduce((s, r) => s + r.workload, 0) / n) : null,
      mood: enough ? round1(inWeek.reduce((s, r) => s + r.mood, 0) / n) : null,
    };
  });
}

/** Leader/admin only (check in the caller): comment texts per week, sorted by text, only for weeks with enough responses. */
export function pulseComments(teamId: number, weeks: string[]): { weekStart: string; comments: string[] }[] {
  if (weeks.length === 0) return [];
  const rows = db
    .select({ weekStart: schema.pulseResponses.weekStart, comment: schema.pulseResponses.comment })
    .from(schema.pulseResponses)
    .where(and(eq(schema.pulseResponses.teamId, teamId), inArray(schema.pulseResponses.weekStart, weeks)))
    .orderBy(asc(schema.pulseResponses.comment))
    .all();
  return weeks
    .map((weekStart) => {
      const inWeek = rows.filter((r) => r.weekStart === weekStart);
      if (inWeek.length < PULSE_MIN_RESPONSES) return { weekStart, comments: [] };
      const comments = inWeek.map((r) => r.comment.trim()).filter(Boolean).sort((a, b) => a.localeCompare(b, "ko"));
      return { weekStart, comments };
    })
    .filter((w) => w.comments.length > 0);
}

export function teamSize(teamId: number): number {
  return db.select({ id: schema.members.id }).from(schema.members).where(eq(schema.members.teamId, teamId)).all().length;
}
