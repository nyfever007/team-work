// Client-safe constants for the linked 회식비 품의 pair.
// Step 1 "전산" (budget) is approved first; step 2 "정산" (settle) is filed from an approved 전산.

export const DINNER_STAGES = ["budget", "settle"] as const;
export type DinnerStage = (typeof DINNER_STAGES)[number];

export const DINNER_STAGE_LABEL: Record<DinnerStage, string> = { budget: "회식비 전산품의", settle: "회식비 청구품의" };
export const DINNER_TITLE: Record<DinnerStage, string> = { budget: "팀 회식비 청구의 건", settle: "회식비 정산의 건" };

/** Company rule: 1인당 한도. */
export const DINNER_LIMIT_PER_PERSON = 50_000;

export function dinnerPurpose(teamName: string): string {
  return `${teamName} 단합 및 커뮤니케이션 증진을 위한 회식`;
}

/** First number in the free-text 인원 ("4명 (A, B, C, D)" → 4), for the limit hint. */
export function headcountNumber(text: string): number | null {
  const m = /\d+/.exec(text);
  return m ? Number(m[0]) : null;
}

export const DINNER_NOTE: Record<DinnerStage, { title: string; body: string }> = {
  budget: { title: "회식비 이용 시 유의사항", body: "당일 회식 후 남은 금액은 회식비 정산 품의서 제출 시 영수증과 함께 제출하여 주시기 바라며, 남은 금액은 다음날(오전 또는 오후)에 다른 용도로 사용 할 수 없음을 유의." },
  settle: { title: "회식비 정산 시 유의사항", body: "회식 후 남은 금액은 회식비 정산 품의서 제출 시 영수증과 함께 제출하여 주시기 바라며, 남은 금액은 회식 후 다음날(오전 또는 오후)에 다른 용도로 사용할 수 없음을 유의." },
};
export const DINNER_SETTLE_ATTACHMENT = "회식 영수증  1부.   끝.";

const WD = ["일", "월", "화", "수", "목", "금", "토"];
/** "2026년 9월 26일 (금)" */
export function dinnerDateLine(key: string): string {
  const [y, m, d] = key.split("-").map(Number);
  return `${y}년 ${m}월 ${d}일 (${WD[new Date(Date.UTC(y, m - 1, d)).getUTCDay()]}요일)`;
}
