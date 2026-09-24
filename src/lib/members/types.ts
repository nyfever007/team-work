import type { MemberRecord, Team } from "@/lib/db/schema";

/** Member joined with its team; what pages and components should use. */
export type Member = MemberRecord & {
  team: string;
  isLeader: boolean;
};

export type { Team };

/** "3년 2개월" of service from the join date (YYYY-MM-DD) to `today`. */
export function tenure(joinedAt: string, today: string): string {
  const [y1, m1, d1] = joinedAt.split("-").map(Number);
  const [y2, m2, d2] = today.split("-").map(Number);
  let months = (y2 - y1) * 12 + (m2 - m1) - (d2 < d1 ? 1 : 0);
  if (months < 0) return "입사 전";
  const years = Math.floor(months / 12);
  months %= 12;
  if (years === 0) return months === 0 ? "1개월 미만" : `${months}개월`;
  return months ? `${years}년 ${months}개월` : `${years}년`;
}
