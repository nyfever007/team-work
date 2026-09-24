// Client-safe helpers for 시간외 근무신청서. Times are KST wall-clock strings "YYYY-MM-DDTHH:mm".

export const MAX_OVERTIME_HOURS = 24;

/** 30-minute steps for the time selects: "00:00" … "23:30". */
export const TIME_OPTIONS = Array.from({ length: 48 }, (_, i) => `${String(Math.floor(i / 2)).padStart(2, "0")}:${i % 2 ? "30" : "00"}`);

export function isDateTime(v: unknown): v is string {
  return typeof v === "string" && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(v) && !Number.isNaN(Date.parse(`${v}:00Z`));
}

/** Hours between two wall-clock times (both KST, so plain UTC arithmetic is exact). */
export function hoursBetween(start: string, end: string): number {
  return (Date.parse(`${end}:00Z`) - Date.parse(`${start}:00Z`)) / 3_600_000;
}

export function formatHours(h: number): string {
  const whole = Math.floor(h);
  const min = Math.round((h - whole) * 60);
  return min ? `${whole}시간 ${min}분` : `${whole}시간`;
}

const clock = (t: string) => {
  const [hh, mm] = t.split(":").map(Number);
  return mm ? `${hh}시 ${mm}분` : `${hh}시`;
};

/** "2026년 9월 26일 10시 부터 9월 26일 18시 까지 ( 8시간 )" — the printed line. */
export function overtimeLine(start: string, end: string, hours: number): string {
  const [sd, st] = start.split("T");
  const [ed, et] = end.split("T");
  const [sy, sm, sdd] = sd.split("-").map(Number);
  const [ey, em, edd] = ed.split("-").map(Number);
  const endDate = ey !== sy ? `${ey}년 ${em}월 ${edd}일` : `${em}월 ${edd}일`;
  return `${sy}년 ${sm}월 ${sdd}일 ${clock(st)} 부터 ${endDate} ${clock(et)} 까지 ( ${formatHours(hours)} )`;
}

/** Short range for lists: "09/26 10:00 ~ 18:00" or "09/26 22:00 ~ 09/27 02:00". */
export function shortRange(start: string, end: string): string {
  const [sd, st] = start.split("T");
  const [ed, et] = end.split("T");
  const md = (d: string) => d.slice(5).replace("-", "/");
  return sd === ed ? `${md(sd)} ${st} ~ ${et}` : `${md(sd)} ${st} ~ ${md(ed)} ${et}`;
}
