// Client-safe constants for 1:1 미팅 (team leader ↔ member).

export const ONE_ON_ONE_STATUSES = ["planned", "done"] as const;
export type OneOnOneStatus = (typeof ONE_ON_ONE_STATUSES)[number];
export const ONE_ON_ONE_STATUS_LABEL: Record<OneOnOneStatus, string> = { planned: "예정", done: "완료" };

export const ACTION_OWNERS = ["member", "leader"] as const;
export type ActionOwner = (typeof ACTION_OWNERS)[number];
export const ACTION_OWNER_LABEL: Record<ActionOwner, string> = { member: "구성원", leader: "팀장" };
