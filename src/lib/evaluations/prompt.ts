import { CRITERIA, MAX_SCORE, type EvaluationInput, type Reasons, type Scores } from "./types";

export const EVALUATION_SYSTEM_PROMPT = `당신은 소프트웨어 회사 팀장의 분기 인사평가 초안을 돕는 어시스턴트입니다.
입력은 구성원이 직접 남긴 일일 보고(오늘 목표·완료 여부·추가로 한 일), 주간 보고(주간 항목·본인 작성 성과), 팀장의 주간 리뷰와 코멘트, 휴가·근태 기록을 주 단위로 요약한 것입니다.
팀장이 검토·수정한 뒤 확정하므로, 각 점수에 **검증 가능한 근거**를 붙이는 것이 가장 중요합니다.

평가 항목 (각 1~${MAX_SCORE}점 정수):
${CRITERIA.map((c) => `- ${c.key} (${c.label}): ${c.hint}`).join("\n")}

채점 기준:
- 5~6 = 기대 수준, 7~8 = 기대 이상, 9~10 = 탁월(분기 내 여러 주에 걸친 뚜렷한 근거가 있을 때만), 3~4 = 보완 필요, 1~2 = 심각한 문제.
- 근태: 목표 작성·퇴근 정리 비율, 조퇴·병가 빈도를 본다. 정상적인 연차 사용은 감점하지 않는다.
- 업무 성과: 일일 목표 완료율, 주간 항목 완료, 팀장 지정 항목 이행, 마일스톤 기여.
- 기록만으로 판단하기 어려운 항목(예: 업무 품질, 직무 역량)은 간접 근거(주간 리뷰의 보완점, 재작업·반복 미완료 등)를 쓰고, 근거가 부족하면 5~6점을 주고 근거에 "기록상 근거 부족"이라고 밝힌다.
- 입력에 없는 사실을 만들지 않는다. 과장하지 않는다.

근거 작성: 항목마다 한국어 1~2문장, 구체적인 주차(MM/DD 주)·항목명·수치를 인용한다.

반드시 아래 JSON 객체 하나만 출력한다. 다른 텍스트나 코드 블록 금지.
{"scores": {${CRITERIA.map((c) => `"${c.key}": {"score": 7, "reason": "..."}`).join(", ")}}, "summary": "종합 의견 3~4문장", "strengths": ["강점 1", "강점 2"], "improvements": ["개선 필요 1", "개선 필요 2"]}`;

export function evaluationUserPrompt(source: string, instructions?: string) {
  return `${source}\n\n${instructions?.trim() ? `팀장 추가 지시: ${instructions.trim()}\n\n` : ""}위 기록으로 이 구성원의 인사평가 초안을 JSON으로 작성해 주세요.`;
}

const list = (v: unknown) =>
  (Array.isArray(v) ? v : typeof v === "string" ? v.split("\n") : [])
    .map((x) => String(x).replace(/^\s*[-*•]\s*/, "").trim())
    .filter(Boolean);

/** Tolerant parser: bare JSON or wrapped in prose / a code fence; clamps scores to 1–10. */
export function parseEvaluation(raw: string): EvaluationInput {
  const start = raw.indexOf("{");
  const end = raw.lastIndexOf("}");
  let j: Record<string, unknown>;
  try {
    j = JSON.parse(raw.slice(start, end + 1));
  } catch {
    throw new Error("AI 응답을 해석할 수 없습니다. 다시 시도해 주세요.");
  }
  const src = (j.scores ?? {}) as Record<string, unknown>;
  const scores: Scores = {};
  const reasons: Reasons = {};
  for (const c of CRITERIA) {
    const item = src[c.key] as { score?: unknown; reason?: unknown } | number | undefined;
    const n = Math.round(Number(typeof item === "object" && item ? item.score : item));
    if (Number.isFinite(n)) scores[c.key] = Math.min(MAX_SCORE, Math.max(1, n));
    const reason = typeof item === "object" && item ? String(item.reason ?? "").trim() : "";
    if (reason) reasons[c.key] = reason.slice(0, 600);
  }
  if (Object.keys(scores).length === 0) throw new Error("AI가 점수를 반환하지 않았습니다. 다시 시도해 주세요.");
  return {
    scores,
    reasons,
    summary: String(j.summary ?? "").trim(),
    strengths: list(j.strengths).map((l) => `- ${l}`).join("\n"),
    improvements: list(j.improvements).map((l) => `- ${l}`).join("\n"),
  };
}
