// Client-safe: starting outline for an empty 주간 보고. Saving it untouched stores an empty report.

/**
 * Sections of the 주간 보고. Sections 2–5 feed the soft-skill 인사평가 criteria
 * (직무 역량 · 책임감·주도성 · 협업·소통 · 성장·자기계발); the AI prompts read them by heading.
 */
export const WEEKLY_REPORT_SECTIONS = [
  { heading: "이번 주 성과", guide: "완료한 일과 결과. 수치·링크가 있으면 함께" },
  { heading: "해결한 어려운 문제", guide: "무엇이 막혔고, 어떻게 풀었는지" },
  { heading: "제안 · 개선한 것", guide: "스스로 제안하거나 바꾼 것 (프로세스·코드·문서 등)" },
  { heading: "도움을 주고받은 일", guide: "누구와 무엇을. 도와준 일과 도움받은 일 모두" },
  { heading: "이번 주 배운 것", guide: "새로 익힌 기술·지식, 피드백으로 고친 점" },
  { heading: "이슈 · 다음 주 계획", guide: "막힌 점, 필요한 지원, 다음 주에 할 일" },
] as const;

export const WEEKLY_REPORT_TEMPLATE = WEEKLY_REPORT_SECTIONS.map((s, i) => `${i + 1}. ${s.heading}\n- `).join("\n\n");

// Headings of the previous outline, so an untouched old outline still counts as blank.
const LEGACY_HEADINGS = ["1. 이번 주 성과", "2. 이슈 · 도움이 필요한 점", "3. 다음 주 계획"];

/** True when the text is empty or still just the outline (only headings and bare "-" bullets). */
export function isBlankReport(text: string): boolean {
  return text.split("\n").every((l) => {
    const t = l.trim();
    return !t || t === "-" || (/^\d\.\s/.test(t) && (WEEKLY_REPORT_TEMPLATE.includes(t) || LEGACY_HEADINGS.includes(t)));
  });
}

/** Prompt note shared by the AI review / evaluation prompts: which report section backs which criterion. */
export const REPORT_SECTION_HINT =
  "구성원 주간 보고의 '해결한 어려운 문제'는 직무 역량, '제안 · 개선한 것'은 책임감·주도성, '도움을 주고받은 일'은 협업·소통, '이번 주 배운 것'은 성장·자기계발의 근거로 쓴다. 비어 있으면 그 사실만으로 감점하지 말고 다른 기록을 본다. 본인 서술이므로 일일 기록·마일스톤 작업 등으로 뒷받침될 때 더 무게를 둔다.";
