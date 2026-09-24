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

// ---- Evaluation periods: quarters, key "YYYY-Q1".."YYYY-Q4"; a bare "YYYY" means the yearly average view ----

export const QUARTERS = [1, 2, 3, 4] as const;

export function periodOf(dateKey: string): string {
  const [y, m] = dateKey.split("-").map(Number);
  return `${y}-Q${Math.ceil(m / 3)}`;
}

export function isPeriod(p: unknown): p is string {
  return typeof p === "string" && /^\d{4}-Q[1-4]$/.test(p);
}

export function isYear(p: unknown): p is string {
  return typeof p === "string" && /^\d{4}$/.test(p);
}

export function quarterKey(year: number | string, q: number): string {
  return `${year}-Q${q}`;
}

export function periodRange(p: string): { start: string; end: string } {
  const y = p.slice(0, 4);
  const q = Number(p.slice(-1));
  const m1 = (q - 1) * 3 + 1;
  const m3 = m1 + 2;
  const last = new Date(Date.UTC(Number(y), m3, 0)).getUTCDate();
  return { start: `${y}-${String(m1).padStart(2, "0")}-01`, end: `${y}-${String(m3).padStart(2, "0")}-${last}` };
}

export function periodLabel(p: string): string {
  return /^\d{4}$/.test(p) ? `${p}년 연평균` : `${p.slice(0, 4)}년 ${p.slice(-1)}분기`;
}

export type YearSummary = {
  year: string;
  /** Finalized quarters used for the average. */
  quarters: { period: string; total: number | null }[];
  criteria: Partial<Record<CriterionKey, number>>; // average per criterion (1 decimal)
  total: number | null; // average of the quarters' totals (1 decimal)
  drafts: number; // quarters still in draft (not counted)
};

/** Yearly average from that year's finalized quarter evaluations. */
export function yearSummary(year: string, evaluations: { period: string; status: EvaluationStatus; scores: Record<string, number>; total: number | null }[]): YearSummary {
  const inYear = evaluations.filter((e) => e.period.startsWith(`${year}-Q`));
  const finals = inYear.filter((e) => e.status === "final").sort((a, b) => a.period.localeCompare(b.period));
  const avg = (vals: number[]) => (vals.length ? Math.round((vals.reduce((a, b) => a + b, 0) / vals.length) * 10) / 10 : null);
  const criteria: Partial<Record<CriterionKey, number>> = {};
  for (const c of CRITERIA) {
    const v = avg(finals.map((e) => e.scores[c.key]).filter((x): x is number => typeof x === "number"));
    if (v != null) criteria[c.key] = v;
  }
  return {
    year,
    quarters: finals.map((e) => ({ period: e.period, total: e.total })),
    criteria,
    total: avg(finals.map((e) => e.total).filter((x): x is number => x != null)),
    drafts: inYear.length - finals.length,
  };
}

export type Reasons = Partial<Record<CriterionKey, string>>;

export type EvaluationInput = {
  scores: Scores;
  reasons: Reasons; // 근거 per criterion
  summary: string; // 종합 의견
  strengths: string; // 강점
  improvements: string; // 개선 필요 사항
};
