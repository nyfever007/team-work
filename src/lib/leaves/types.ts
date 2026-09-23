/** Company leave categories (휴가 품의서 구분). Keys are stored in the DB. */
export const LEAVE_TYPES = ["annual", "half_am", "half_pm", "official", "petition", "compensatory", "sick", "early_leave", "maternity", "other"] as const;
export type LeaveType = (typeof LEAVE_TYPES)[number];

export const LEAVE_LABEL: Record<LeaveType, string> = {
  annual: "연차",
  half_am: "오전 반차",
  half_pm: "오후 반차",
  official: "공가",
  petition: "청원휴가",
  compensatory: "보상휴가",
  sick: "병가",
  early_leave: "조퇴",
  maternity: "산전후휴가",
  other: "그 외 기타휴가",
};

/** Label used in the printed form's 구분 row (반차 is one box there). */
export const LEAVE_FORM_LABEL: Record<LeaveType, string> = { ...LEAVE_LABEL, half_am: "반차", half_pm: "반차" };

/** Annual-leave days consumed per calendar day of the request. */
export const LEAVE_COST: Record<LeaveType, number> = {
  annual: 1,
  half_am: 0.5,
  half_pm: 0.5,
  official: 0,
  petition: 0,
  compensatory: 0,
  sick: 0,
  early_leave: 0,
  maternity: 0,
  other: 0,
};

/** Days counted on the form (신청일수) per working day. 조퇴 counts as 0 days by default. */
export const LEAVE_DAYS: Record<LeaveType, number> = { ...LEAVE_COST, official: 1, petition: 1, compensatory: 1, sick: 1, maternity: 1, other: 1, early_leave: 0 };

/** Types that must be a single day. */
export const SINGLE_DAY_TYPES: LeaveType[] = ["half_am", "half_pm", "early_leave"];

/** Types where the form asks for a detailed reason (연차/반차 제외). */
export const REASON_REQUIRED_TYPES: LeaveType[] = ["official", "petition", "compensatory", "sick", "early_leave", "maternity", "other"];

export const LEAVE_BADGE_CLASS: Record<LeaveType, string> = {
  annual: "bg-blue-100 text-blue-800",
  half_am: "bg-sky-100 text-sky-800",
  half_pm: "bg-sky-100 text-sky-800",
  official: "bg-teal-100 text-teal-800",
  petition: "bg-violet-100 text-violet-800",
  compensatory: "bg-indigo-100 text-indigo-800",
  sick: "bg-rose-100 text-rose-800",
  early_leave: "bg-orange-100 text-orange-800",
  maternity: "bg-pink-100 text-pink-800",
  other: "bg-amber-100 text-amber-800",
};

/** Short chip text for calendars/timelines. */
export const LEAVE_SHORT: Record<LeaveType, string> = {
  annual: "연차",
  half_am: "오전반차",
  half_pm: "오후반차",
  official: "공가",
  petition: "청원",
  compensatory: "보상",
  sick: "병가",
  early_leave: "조퇴",
  maternity: "산전후",
  other: "휴가",
};

export const REQUEST_STATUSES = ["submitted", "approved", "rejected", "cancelled"] as const;
export type RequestStatus = (typeof REQUEST_STATUSES)[number];
export const REQUEST_STATUS_LABEL: Record<RequestStatus, string> = { submitted: "제출", approved: "승인", rejected: "반려", cancelled: "취소" };
