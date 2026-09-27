// Client-safe constants for 인사평가 (the drizzle schema imports these, not the other way round).

export const EVALUATION_STATUSES = ["draft", "final"] as const;
export type EvaluationStatus = (typeof EVALUATION_STATUSES)[number];

/** Criteria scored 1–10. Keys are stored in the JSON `scores` column — add new ones at the end, never rename. */
export const CRITERIA = [
  { key: "attendance", label: "근태", hint: "출결·시간 준수, 휴가·조퇴 사용의 적정성, 일일 기록 성실도" },
  { key: "performance", label: "업무 성과", hint: "목표·주간 항목 달성도, 마일스톤 기여" },
  { key: "quality", label: "업무 품질", hint: "결과물의 정확성·완성도, 재작업 빈도" },
  { key: "competence", label: "직무 역량", hint: "전문 지식·기술, 문제 해결 능력" },
  { key: "initiative", label: "책임감·주도성", hint: "맡은 일의 끝맺음, 자발적 개선·제안" },
  { key: "collaboration", label: "협업·소통", hint: "팀워크, 공유·보고, 피드백 수용" },
  { key: "growth", label: "성장·자기계발", hint: "학습, 피드백 반영, 역량 향상 노력" },
] as const;
export type CriterionKey = (typeof CRITERIA)[number]["key"];
export type Scores = Partial<Record<CriterionKey, number>>;

export const MAX_SCORE = 10;

/** 1–10 score as 5 stars with halves: 7 → 3.5 stars. */
export function starsOf(score: number): { full: number; half: boolean; empty: number } {
  const full = Math.floor(score / 2);
  const half = score % 2 === 1;
  return { full, half, empty: 5 - full - (half ? 1 : 0) };
}

/** Average of the given scores (1 decimal), or null when none are scored. */
export function totalScore(scores: Scores): number | null {
  const vals = CRITERIA.map((c) => scores[c.key]).filter((v): v is number => typeof v === "number");
  if (vals.length === 0) return null;
  return Math.round((vals.reduce((a, b) => a + b, 0) / vals.length) * 10) / 10;
}

export const GRADES = [
  { grade: "S", min: 9, label: "탁월", className: "bg-brand text-white" },
  { grade: "A", min: 8, label: "우수", className: "bg-emerald-100 text-emerald-800" },
  { grade: "B", min: 6.5, label: "양호", className: "bg-sky-100 text-sky-900" },
  { grade: "C", min: 5, label: "보통", className: "bg-amber-100 text-amber-900" },
  { grade: "D", min: 0, label: "미흡", className: "bg-red-100 text-red-800" },
] as const;

export function gradeOf(total: number | null) {
  if (total == null) return null;
  return GRADES.find((g) => total >= g.min) ?? GRADES[GRADES.length - 1];
}

// ---- Evaluation periods: four levels; the level is implied by the key format ----
//   week    "2026-09-21"  (Monday)   · AI source: that week's 주간 리뷰 + records
//   month   "2026-09"                 · AI source: the month's 주간 평가
//   quarter "2026-Q3"                 · AI source: the quarter's 월간 평가
//   year    "2026"                    · AI source: the year's 분기 평가

export const EVAL_LEVELS = ["week", "month", "quarter", "year"] as const;
export type EvalLevel = (typeof EVAL_LEVELS)[number];
export const LEVEL_LABEL: Record<EvalLevel, string> = { week: "주간", month: "월간", quarter: "분기", year: "연간" };
export const QUARTERS = [1, 2, 3, 4] as const;

const pad = (n: number) => String(n).padStart(2, "0");
const dayAdd = (key: string, n: number) => {
  const d = new Date(`${key}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};
const mondayOf = (key: string) => {
  const dow = new Date(`${key}T00:00:00Z`).getUTCDay();
  return dayAdd(key, dow === 0 ? -6 : 1 - dow);
};

export function levelOf(p: unknown): EvalLevel | null {
  if (typeof p !== "string") return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(p)) return !Number.isNaN(Date.parse(`${p}T00:00:00Z`)) && mondayOf(p) === p ? "week" : null;
  if (/^\d{4}-(0[1-9]|1[0-2])$/.test(p)) return "month";
  if (/^\d{4}-Q[1-4]$/.test(p)) return "quarter";
  if (/^\d{4}$/.test(p)) return "year";
  return null;
}

export function isEvalPeriod(p: unknown): p is string {
  return levelOf(p) !== null;
}

/** Quarter key of a date (kept for callers of the old quarterly-only API). */
export function periodOf(dateKey: string): string {
  const [y, m] = dateKey.split("-").map(Number);
  return `${y}-Q${Math.ceil(m / 3)}`;
}

export function quarterKey(year: number | string, q: number): string {
  return `${year}-Q${q}`;
}

/** The period of `level` that contains `today`. */
export function currentPeriod(level: EvalLevel, today: string): string {
  if (level === "week") return mondayOf(today);
  if (level === "month") return today.slice(0, 7);
  if (level === "quarter") return periodOf(today);
  return today.slice(0, 4);
}

/** Move a period by n steps of its own level. */
export function shiftPeriod(p: string, n: number): string {
  const level = levelOf(p);
  if (level === "week") return dayAdd(p, 7 * n);
  if (level === "month") {
    const [y, m] = p.split("-").map(Number);
    const d = new Date(Date.UTC(y, m - 1 + n, 1));
    return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}`;
  }
  if (level === "quarter") {
    const idx = Number(p.slice(0, 4)) * 4 + Number(p.slice(-1)) - 1 + n;
    return quarterKey(Math.floor(idx / 4), (idx % 4) + 1);
  }
  return String(Number(p) + n);
}

export function periodRange(p: string): { start: string; end: string } {
  const level = levelOf(p);
  if (level === "week") return { start: p, end: dayAdd(p, 6) };
  if (level === "month") {
    const [y, m] = p.split("-").map(Number);
    return { start: `${p}-01`, end: `${p}-${pad(new Date(Date.UTC(y, m, 0)).getUTCDate())}` };
  }
  if (level === "quarter") {
    const y = p.slice(0, 4);
    const m1 = (Number(p.slice(-1)) - 1) * 3 + 1;
    const last = new Date(Date.UTC(Number(y), m1 + 2, 0)).getUTCDate();
    return { start: `${y}-${pad(m1)}-01`, end: `${y}-${pad(m1 + 2)}-${last}` };
  }
  return { start: `${p}-01-01`, end: `${p}-12-31` };
}

export function periodLabel(p: string): string {
  const level = levelOf(p);
  if (level === "week") {
    const end = dayAdd(p, 6);
    return `${Number(p.slice(5, 7))}월 ${Number(p.slice(8))}일 주 (${Number(p.slice(5, 7))}/${Number(p.slice(8))}~${Number(end.slice(5, 7))}/${Number(end.slice(8))})`;
  }
  if (level === "month") return `${p.slice(0, 4)}년 ${Number(p.slice(5))}월`;
  if (level === "quarter") return `${p.slice(0, 4)}년 ${p.slice(-1)}분기`;
  return `${p}년`;
}

export function childLevel(level: EvalLevel): EvalLevel | null {
  return level === "month" ? "week" : level === "quarter" ? "month" : level === "year" ? "quarter" : null;
}

/** The lower-level periods an evaluation summarises: weeks whose Monday is in the month, the quarter's months, the year's quarters. */
export function childPeriods(p: string): string[] {
  const level = levelOf(p);
  if (level === "month") {
    const { start, end } = periodRange(p);
    const out: string[] = [];
    for (let w = mondayOf(start) < start ? dayAdd(mondayOf(start), 7) : mondayOf(start); w <= end; w = dayAdd(w, 7)) out.push(w);
    return out;
  }
  if (level === "quarter") {
    const y = p.slice(0, 4);
    const m1 = (Number(p.slice(-1)) - 1) * 3 + 1;
    return [0, 1, 2].map((i) => `${y}-${pad(m1 + i)}`);
  }
  if (level === "year") return QUARTERS.map((q) => quarterKey(p, q));
  return [];
}

// ---- 고과평가 (quarterly relative appraisal): forced distribution by rank within the team ----
export const DISTRIBUTION: { grade: "S" | "A" | "B" | "C" | "D"; share: number }[] = [
  { grade: "S", share: 0.1 },
  { grade: "A", share: 0.2 },
  { grade: "B", share: 0.4 },
  { grade: "C", share: 0.2 },
  { grade: "D", share: 0.1 },
];
export type Grade = "S" | "A" | "B" | "C" | "D";
export const GRADE_LETTERS: Grade[] = ["S", "A", "B", "C", "D"];

/** Relative grade for rank (1-based) among n: by cumulative share, using the rank's percentile position. */
export function relativeGrade(rank: number, n: number): Grade {
  const pos = (rank - 0.5) / n; // centre of the rank's slot
  let acc = 0;
  for (const d of DISTRIBUTION) {
    acc += d.share;
    if (pos < acc) return d.grade;
  }
  return "D";
}

export type Reasons = Partial<Record<CriterionKey, string>>;

export type EvaluationInput = {
  scores: Scores;
  reasons: Reasons; // 근거 per criterion
  summary: string; // 종합 의견
  strengths: string; // 강점
  improvements: string; // 개선 필요 사항
};
