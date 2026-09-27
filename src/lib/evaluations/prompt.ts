import { REPORT_SECTION_HINT } from "@/lib/logs/template";
import { CRITERIA, MAX_SCORE, type EvalLevel, type EvaluationInput, type Reasons, type Scores } from "./types";

const SCOPE: Record<EvalLevel, { name: string; input: string; strong: string }> = {
  week: {
    name: "주간",
    input: "이번 주 구성원이 남긴 일일 목표·완료 여부·추가로 한 일, 주간 보고, 휴가 기록, 그리고 팀장이 작성한 주간 리뷰(성과 수준·잘한 점·보완할 점)",
    strong: "그 주에 뚜렷한 성과가 있을 때만",
  },
  month: { name: "월간", input: "이번 달의 주간 인사평가들(항목 점수·근거·의견)과 기간 기록 요약", strong: "여러 주에 걸쳐 일관된 근거가 있을 때만" },
  quarter: { name: "분기", input: "이번 분기의 월간 인사평가들(항목 점수·근거·의견)과 기간 기록 요약", strong: "여러 달에 걸쳐 일관된 근거가 있을 때만" },
  year: { name: "연간", input: "올해 분기 인사평가들(항목 점수·근거·의견)과 연간 기록 요약", strong: "여러 분기에 걸쳐 일관된 근거가 있을 때만" },
};

/** System prompt per level: week works from records + 주간 리뷰; higher levels summarise the level below (trend matters). */
export function evaluationSystemPrompt(level: EvalLevel): string {
  const sc = SCOPE[level];
  return `당신은 소프트웨어 회사 팀장의 ${sc.name} 인사평가 초안을 돕는 어시스턴트입니다. 이 평가는 구성원에게 공개되지 않는 팀장 전용 자료입니다.
입력은 ${sc.input}입니다.
팀장이 검토·수정한 뒤 확정하므로, 각 점수에 **검증 가능한 근거**를 붙이는 것이 가장 중요합니다.

평가 항목 (각 1~${MAX_SCORE}점 정수):
${CRITERIA.map((c) => `- ${c.key} (${c.label}): ${c.hint}`).join("\n")}

채점 기준:
- 5~6 = 기대 수준, 7~8 = 기대 이상, 9~10 = 탁월(${sc.strong}), 3~4 = 보완 필요, 1~2 = 심각한 문제.
- 근태: 목표 작성·퇴근 정리 비율, 주간 보고 작성, 조퇴·병가 빈도를 본다. 정상적인 연차 사용은 감점하지 않는다.
- 업무 성과: 일일 목표 완료율, 마일스톤 작업 기여, 팀장 리뷰의 평가.
${level === "week" ? `- ${REPORT_SECTION_HINT}\n` : ""}${level === "week" ? "- 팀장 주간 리뷰의 성과 수준과 보완점을 중요한 근거로 삼되, 기록과 어긋나면 기록을 우선한다." : "- 하위 평가들의 점수를 기계적으로 평균하지 말고, 추세(개선·하락)와 반복되는 강점·보완점을 반영한다. 확정된 하위 평가를 초안보다 우선한다."}
- 협업 · 성장 기록: 게시판 공유 기여(다른 팀원의 반응·채택 기준)는 협업·소통과 성장·자기계발의 가산 근거로 쓰고, 공유가 없다는 이유만으로 감점하지 않는다. 1:1 후속 조치 이행은 책임감·주도성, 성장 계획의 진행·달성과 회고는 성장·자기계발의 근거로 쓴다.
- 근거가 부족한 항목은 5~6점을 주고 근거에 "근거 부족"이라고 밝힌다.
- 입력에 없는 사실을 만들지 않는다. 과장하지 않는다.

근거 작성: 항목마다 한국어 1~2문장, ${level === "week" ? "구체적인 날짜·목표·수치" : "구체적인 하위 기간(예: 9월 14일 주, 8월)·점수 변화"}를 인용한다.

반드시 아래 JSON 객체 하나만 출력한다. 다른 텍스트나 코드 블록 금지.
{"scores": {${CRITERIA.map((c) => `"${c.key}": {"score": 7, "reason": "..."}`).join(", ")}}, "summary": "종합 의견 3~4문장", "strengths": ["강점 1", "강점 2"], "improvements": ["개선 필요 1", "개선 필요 2"]}`;
}

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
