// Client-safe constants for weekly member reviews (the drizzle schema imports these, not the other way round).

export const MEMBER_REVIEW_STATUSES = ["draft", "shared"] as const;
export type MemberReviewStatus = (typeof MEMBER_REVIEW_STATUSES)[number];

/** 성과 수준 1–5. Optional; the AI suggests one, the leader decides. */
export const RATINGS = [1, 2, 3, 4, 5] as const;
export type Rating = (typeof RATINGS)[number];

export const RATING_LABEL: Record<Rating, string> = {
  1: "기대 미만",
  2: "보완 필요",
  3: "기대 충족",
  4: "기대 이상",
  5: "탁월",
};

export const RATING_CLASS: Record<Rating, string> = {
  1: "bg-red-100 text-red-800",
  2: "bg-amber-100 text-amber-900",
  3: "bg-sky-100 text-sky-900",
  4: "bg-emerald-100 text-emerald-800",
  5: "bg-brand-soft text-accent-foreground ring-1 ring-brand/30",
};

export function isRating(v: unknown): v is Rating {
  return typeof v === "number" && (RATINGS as readonly number[]).includes(v);
}

/** "다음 주 할 일" is stored one per line. */
export function actionLines(text: string): string[] {
  return text
    .split("\n")
    .map((l) => l.replace(/^\s*(?:[-*•]|\d+[.)])\s*/, "").trim())
    .filter(Boolean);
}

export type MemberReviewInput = {
  summary: string;
  strengths: string;
  improvements: string;
  nextActions: string;
  rating: Rating | null;
};
