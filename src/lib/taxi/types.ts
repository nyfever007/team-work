// Client-safe constants for 택시비 지급 품의서.

/** Fixed 제목 on the form (from templates/taxi-request.docx). */
export const TAXI_TITLE = "택시비 이용 금액 지급 요청 품의의 건";
export const TAXI_DEFAULT_REASON = "야간 근무 후 귀가 시 택시 이용";
export const TAXI_DEFAULT_ATTACHMENT = "양식 1. 택시비 이용 내역서(관련 영수증 첨부 필)";

/** "2026년 9월 1일 ~ 9월 30일 까지" (year repeated only when it changes). */
export function periodLine(start: string, end: string): string {
  const [sy, sm, sd] = start.split("-").map(Number);
  const [ey, em, ed] = end.split("-").map(Number);
  if (start === end) return `${sy}년 ${sm}월 ${sd}일`;
  return `${sy}년 ${sm}월 ${sd}일 ~ ${ey !== sy ? `${ey}년 ` : ""}${em}월 ${ed}일 까지`;
}
