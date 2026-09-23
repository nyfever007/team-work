export const TIME_ZONE = "Asia/Seoul";

const kstDate = new Intl.DateTimeFormat("en-CA", {
  timeZone: TIME_ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});
const kstHour = new Intl.DateTimeFormat("en-GB", { timeZone: TIME_ZONE, hour: "2-digit", hour12: false });

/** Today's date key (YYYY-MM-DD) in Korea. */
export function todayKey(now = new Date()): string {
  return kstDate.format(now);
}

/** Current hour (0-23) in Korea. */
export function currentHourKST(now = new Date()): number {
  return Number(kstHour.format(now)) % 24;
}

/** Parse YYYY-MM-DD into a UTC-midnight Date (safe for day arithmetic). */
export function parseKey(key: string): Date {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

export function toKey(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export function addDays(key: string, days: number): string {
  const d = parseKey(key);
  d.setUTCDate(d.getUTCDate() + days);
  return toKey(d);
}

/** 0 = Sunday … 6 = Saturday */
export function dayOfWeek(key: string): number {
  return parseKey(key).getUTCDay();
}

export function isWeekend(key: string): boolean {
  const dow = dayOfWeek(key);
  return dow === 0 || dow === 6;
}

/** Monday of the week containing `key`. */
export function weekStartOf(key: string): string {
  const dow = dayOfWeek(key);
  return addDays(key, dow === 0 ? -6 : 1 - dow);
}

/** Mon..Sun keys for the week starting at `weekStart`. */
export function weekDays(weekStart: string): string[] {
  return Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
}

export function isValidKey(key: unknown): key is string {
  return typeof key === "string" && /^\d{4}-\d{2}-\d{2}$/.test(key) && toKey(parseKey(key)) === key;
}

export function isValidMonth(m: unknown): m is string {
  return typeof m === "string" && /^\d{4}-(0[1-9]|1[0-2])$/.test(m);
}

/** YYYY-MM of a date key. */
export function monthOf(key: string): string {
  return key.slice(0, 7);
}

export function addMonths(month: string, n: number): string {
  const [y, m] = month.split("-").map(Number);
  const d = new Date(Date.UTC(y, m - 1 + n, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

/** All date keys of a month. */
export function daysInMonth(month: string): string[] {
  const [y, m] = month.split("-").map(Number);
  const count = new Date(Date.UTC(y, m, 0)).getUTCDate();
  return Array.from({ length: count }, (_, i) => `${month}-${String(i + 1).padStart(2, "0")}`);
}

/** Calendar grid for a month, Sunday-first, padded with neighbouring days. */
export function monthGrid(month: string): string[][] {
  const days = daysInMonth(month);
  const lead = dayOfWeek(days[0]);
  const start = addDays(days[0], -lead);
  const total = Math.ceil((lead + days.length) / 7) * 7;
  const all = Array.from({ length: total }, (_, i) => addDays(start, i));
  const rows: string[][] = [];
  for (let i = 0; i < all.length; i += 7) rows.push(all.slice(i, i + 7));
  return rows;
}

export const WEEKDAY_KO = ["일", "월", "화", "수", "목", "금", "토"] as const;

/** "9월 22일 (화)" */
export function formatKoDate(key: string): string {
  const d = parseKey(key);
  return `${d.getUTCMonth() + 1}월 ${d.getUTCDate()}일 (${WEEKDAY_KO[d.getUTCDay()]})`;
}

/** "2026년 9월" */
export function formatKoMonth(month: string): string {
  const [y, m] = month.split("-").map(Number);
  return `${y}년 ${m}월`;
}

export function formatTime(d: Date | null | undefined): string | null {
  if (!d) return null;
  return new Intl.DateTimeFormat("ko-KR", {
    timeZone: TIME_ZONE,
    month: "numeric",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(d);
}
