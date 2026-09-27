// Client-safe constants for 성장 계획 (quarterly personal growth goals).

export const GROWTH_STATUSES = ["planned", "in_progress", "done", "dropped"] as const;
export type GrowthStatus = (typeof GROWTH_STATUSES)[number];
export const GROWTH_STATUS_LABEL: Record<GrowthStatus, string> = { planned: "계획", in_progress: "진행 중", done: "달성", dropped: "중단" };
export const GROWTH_STATUS_CLASS: Record<GrowthStatus, string> = {
  planned: "bg-muted text-muted-foreground",
  in_progress: "bg-sky-100 text-sky-800",
  done: "bg-emerald-100 text-emerald-800",
  dropped: "bg-slate-100 text-slate-500 line-through",
};
/** Suggested number of goals per quarter (soft limit enforced in the action). */
export const GROWTH_MAX_PER_QUARTER = 3;

export const GROWTH_TITLE_MAX = 100;
export const GROWTH_TEXT_MAX = 1000;

/** "2026-Q3" */
export function isQuarterKey(q: unknown): q is string {
  return typeof q === "string" && /^\d{4}-Q[1-4]$/.test(q);
}
