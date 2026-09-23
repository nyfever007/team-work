/**
 * Company leave policy (defaults; a member-level override wins).
 * - Leave year = employment year: from the join-date anniversary to the day before the next one.
 * - 1st year: 1 day accrues per completed month, 12 in total.
 * - 2nd–3rd year: 15 days.
 * - 4th year on: +1 day per year over 15, capped at 25.
 */
export const FIRST_YEAR_TOTAL = 12;
export const BASE_ANNUAL = 15;
export const MAX_ANNUAL = 25;

function pad(n: number) {
  return String(n).padStart(2, "0");
}

/** Anniversary of `joinedAt` in year `y`, clamped for short months (e.g. Feb 29). */
function anniversary(joinedAt: string, y: number): string {
  const [, jm, jd] = joinedAt.split("-").map(Number);
  const last = new Date(Date.UTC(y, jm, 0)).getUTCDate();
  return `${y}-${pad(jm)}-${pad(Math.min(jd, last))}`;
}

function addDaysKey(key: string, days: number) {
  const [y, m, d] = key.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + days));
  return dt.toISOString().slice(0, 10);
}

/** Employment-year window containing `today`, and which year of service it is (1-based). */
export function leaveYear(joinedAt: string, today: string): { start: string; end: string; yearIndex: number } {
  const ty = Number(today.slice(0, 4));
  let start = anniversary(joinedAt, ty);
  if (start > today) start = anniversary(joinedAt, ty - 1);
  if (start < joinedAt) start = joinedAt; // joined later this year
  const nextStart = anniversary(joinedAt, Number(start.slice(0, 4)) + 1);
  const yearIndex = Number(start.slice(0, 4)) - Number(joinedAt.slice(0, 4)) + 1;
  return { start, end: addDaysKey(nextStart, -1), yearIndex: Math.max(1, yearIndex) };
}

/** Default annual entitlement for a given year of service. */
export function defaultAnnualDays(yearIndex: number): number {
  if (yearIndex <= 1) return FIRST_YEAR_TOTAL;
  if (yearIndex <= 3) return BASE_ANNUAL;
  return Math.min(MAX_ANNUAL, BASE_ANNUAL + (yearIndex - 3));
}

/** Completed months between two date keys (a ≤ b). */
export function monthsBetween(a: string, b: string): number {
  const [ay, am, ad] = a.split("-").map(Number);
  const [by, bm, bd] = b.split("-").map(Number);
  let months = (by - ay) * 12 + (bm - am);
  if (bd < ad) months -= 1;
  return Math.max(0, months);
}

/**
 * Days available so far in the current leave year.
 * First year accrues 1/month (up to 12); later years are granted in full on the anniversary.
 */
export function accruedAnnual(joinedAt: string, today: string, entitlement: number, yearIndex: number): number {
  if (yearIndex > 1) return entitlement;
  return Math.min(entitlement, monthsBetween(joinedAt, today));
}

export function describeAnnualRule(yearIndex: number): string {
  if (yearIndex <= 1) return "1년차 · 매월 1일 발생, 총 12일";
  if (yearIndex <= 3) return `${yearIndex}년차 · 15일`;
  return `${yearIndex}년차 · 15일 + ${Math.min(MAX_ANNUAL, BASE_ANNUAL + (yearIndex - 3)) - BASE_ANNUAL}일`;
}
