// Client-safe constants for 팀 회고 (KPT).

export const RETRO_KINDS = ["keep", "problem", "try"] as const;
export type RetroKind = (typeof RETRO_KINDS)[number];
export const RETRO_KIND_LABEL: Record<RetroKind, string> = { keep: "Keep · 유지할 것", problem: "Problem · 문제", try: "Try · 시도할 것" };
export const RETRO_KIND_CLASS: Record<RetroKind, string> = {
  keep: "border-emerald-200 bg-emerald-50",
  problem: "border-rose-200 bg-rose-50",
  try: "border-sky-200 bg-sky-50",
};

export const RETRO_STATUSES = ["open", "closed"] as const;
export type RetroStatus = (typeof RETRO_STATUSES)[number];
export const RETRO_STATUS_LABEL: Record<RetroStatus, string> = { open: "진행 중", closed: "마감" };
