// Client-safe constants for the team 게시판 (라운지). Posts are always scoped to one team.

export const POST_CATEGORIES = ["tip", "prompt", "case", "question", "decision"] as const;
export type PostCategory = (typeof POST_CATEGORIES)[number];

export const POST_CATEGORY_LABEL: Record<PostCategory, string> = {
  tip: "노하우·팁",
  prompt: "AI 프롬프트",
  case: "사례·회고",
  question: "질문",
  decision: "의사결정",
};

export const POST_CATEGORY_HINT: Record<PostCategory, string> = {
  tip: "업무 요령, 도구 사용법, 읽어볼 만한 글",
  prompt: "업무에 쓰는 프롬프트와 용도, 결과 예시",
  case: "문제 해결 과정, 실패에서 배운 점",
  question: "막힌 문제를 팀에 묻기. 좋은 답변은 채택",
  decision: "무엇을, 왜 결정했는지 남기는 기록",
};

export const POST_CATEGORY_CLASS: Record<PostCategory, string> = {
  tip: "bg-sky-100 text-sky-800",
  prompt: "bg-brand-soft text-accent-foreground",
  case: "bg-amber-100 text-amber-800",
  question: "bg-emerald-100 text-emerald-800",
  decision: "bg-slate-200 text-slate-800",
};

export const REACTION_KINDS = ["helpful", "saved", "tried"] as const;
export type ReactionKind = (typeof REACTION_KINDS)[number];
export const REACTION_LABEL: Record<ReactionKind, string> = { helpful: "도움됐어요", saved: "저장", tried: "써봤어요" };

export const DECISION_STATUSES = ["active", "superseded"] as const;
export type DecisionStatus = (typeof DECISION_STATUSES)[number];
export const DECISION_STATUS_LABEL: Record<DecisionStatus, string> = { active: "유효", superseded: "변경됨" };

/**
 * 공유 기여 points: only other members' reactions count (writing alone is 0).
 * One reaction per member per kind; weekly total per author is capped.
 */
export const CONTRIBUTION_POINTS: Record<ReactionKind | "accepted", number> = { helpful: 1, saved: 1, tried: 2, accepted: 3 };
export const CONTRIBUTION_WEEKLY_CAP = 20;

/** Body outline pre-filled for a new 의사결정 post. */
export const DECISION_TEMPLATE = "배경\n- \n\n검토한 대안\n- \n\n결정 이유\n- \n\n후속 조치\n- ";
