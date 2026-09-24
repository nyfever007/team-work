import { isRating, type MemberReviewInput } from "./types";

export const MEMBER_REVIEW_SYSTEM_PROMPT = `당신은 소프트웨어 팀 팀장이 구성원 한 명의 한 주를 리뷰하도록 돕는 어시스턴트입니다.
입력에는 구성원이 직접 기록한 일일 목표와 완료 여부, 추가로 한 일, 주간 항목, 본인 작성 주간 성과, 휴가, 팀장의 일일 코멘트, 관련 마일스톤, 지난주 리뷰에서 요청한 할 일이 있습니다.
목적은 평가 자체보다 **구성원의 성장을 돕는 구체적인 피드백**입니다. 팀장이 검토·수정한 뒤 구성원에게 공유합니다.

원칙:
- 한국어, 존댓말(~했습니다/~해 주세요). 입력에 있는 사실만 근거로 쓰고 추측하거나 부풀리지 않는다.
- 칭찬과 보완점 모두 구체적인 항목·날짜를 근거로 든다. "열심히 했다" 같은 일반론은 쓰지 않는다.
- 휴가일은 기록이 없어도 감점 요소로 보지 않는다.
- 기록 습관(목표 작성·퇴근 정리 일수)이 부족하면 보완점에 짧게 언급한다.
- 지난주 요청한 할 일이 있으면 이행 여부를 종합 평가에 한 줄로 언급한다.
- 다음 주 할 일은 구성원이 바로 주간 항목으로 옮길 수 있는 짧은 명령형 문장(40자 이내)으로, 2~4개. 미완료 항목의 마무리와 보완점을 우선한다.
- 성과 수준(rating)은 1~5 정수: 1 기대 미만, 2 보완 필요, 3 기대 충족, 4 기대 이상, 5 탁월. 기록이 거의 없으면 2 이하.

반드시 아래 JSON 객체 하나만 출력한다. 다른 텍스트나 코드 블록 금지.
{"rating": 3, "summary": "종합 평가 2~3문장", "strengths": ["잘한 점 1", "잘한 점 2"], "improvements": ["보완할 점 1"], "nextActions": ["다음 주 할 일 1", "다음 주 할 일 2"]}`;

export function memberReviewUserPrompt(source: string, instructions?: string) {
  return `${source}\n\n${instructions?.trim() ? `팀장 추가 지시: ${instructions.trim()}\n\n` : ""}위 기록으로 이 구성원의 주간 리뷰 초안을 JSON으로 작성해 주세요.`;
}

const bullets = (v: unknown) =>
  (Array.isArray(v) ? v : typeof v === "string" ? v.split("\n") : [])
    .map((x) => String(x).replace(/^\s*[-*•]\s*/, "").trim())
    .filter(Boolean);

/** Tolerant parser: accepts a bare JSON object or one wrapped in prose / a code fence. */
export function parseMemberReview(raw: string): MemberReviewInput {
  const start = raw.indexOf("{");
  const end = raw.lastIndexOf("}");
  if (start < 0 || end <= start) throw new Error("AI 응답을 해석할 수 없습니다. 다시 생성해 주세요.");
  let j: Record<string, unknown>;
  try {
    j = JSON.parse(raw.slice(start, end + 1));
  } catch {
    throw new Error("AI 응답을 해석할 수 없습니다. 다시 생성해 주세요.");
  }
  const rating = Number(j.rating);
  return {
    rating: isRating(rating) ? rating : null,
    summary: String(j.summary ?? "").trim(),
    strengths: bullets(j.strengths).map((l) => `- ${l}`).join("\n"),
    improvements: bullets(j.improvements).map((l) => `- ${l}`).join("\n"),
    nextActions: bullets(j.nextActions).join("\n"),
  };
}
