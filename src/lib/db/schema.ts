import { sql } from "drizzle-orm";
import { index, integer, real, sqliteTable, text, uniqueIndex, type AnySQLiteColumn } from "drizzle-orm/sqlite-core";
import { LEAVE_TYPES, REQUEST_STATUSES } from "@/lib/leaves/types";
import { MILESTONE_APPROVALS, MILESTONE_STATUSES } from "@/lib/milestones/types";
import { EVALUATION_STATUSES } from "@/lib/evaluations/types";
import { CURRENCIES, VAT_MODES } from "@/lib/general/types";
import { DINNER_STAGES } from "@/lib/dinner/types";
import { MEMBER_REVIEW_STATUSES } from "@/lib/member-reviews/types";
import { TASK_STATUSES } from "@/lib/tasks/types";

// Enum constants are defined in client-safe modules (lib/*/types.ts) so client
// components never import this drizzle schema. Re-exported here for server code.
export { LEAVE_TYPES, MEMBER_REVIEW_STATUSES, MILESTONE_APPROVALS, MILESTONE_STATUSES, REQUEST_STATUSES, TASK_STATUSES };
export type { LeaveType, RequestStatus } from "@/lib/leaves/types";
export type { MilestoneApproval, MilestoneStatus } from "@/lib/milestones/types";
export type { TaskStatus } from "@/lib/tasks/types";

export const users = sqliteTable("users", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  username: text("username").notNull().unique(),
  // Email login. Accounts created for members use the member's email; legacy accounts may have none.
  email: text("email").unique(),
  name: text("name").notNull(),
  passwordHash: text("password_hash").notNull(),
  role: text("role", { enum: ["admin", "member"] }).notNull().default("member"),
  // Optional link to a team member record (one account per member).
  memberId: integer("member_id")
    .unique()
    .references(() => members.id, { onDelete: "set null" }),
  createdAt: integer("created_at", { mode: "timestamp_ms" })
    .notNull()
    .default(sql`(unixepoch() * 1000)`),
});

export const sessions = sqliteTable("sessions", {
  // sha256 of the random token stored in the browser cookie
  id: text("id").primaryKey(),
  userId: integer("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  expiresAt: integer("expires_at", { mode: "timestamp_ms" }).notNull(),
  createdAt: integer("created_at", { mode: "timestamp_ms" })
    .notNull()
    .default(sql`(unixepoch() * 1000)`),
});

/** Teams. A member belongs to exactly one team; a team has at most one leader. */
export const teams = sqliteTable("teams", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull().unique(),
  leaderMemberId: integer("leader_member_id").references((): AnySQLiteColumn => members.id, { onDelete: "set null" }),
  createdAt: integer("created_at", { mode: "timestamp_ms" })
    .notNull()
    .default(sql`(unixepoch() * 1000)`),
});

export const members = sqliteTable(
  "members",
  {
  id: integer("id").primaryKey({ autoIncrement: true }),
  teamId: integer("team_id")
    .notNull()
    .references(() => teams.id),
  name: text("name").notNull(),
  position: text("position").notNull(), // 직책 (role)
  rank: text("rank").notNull().default(""), // 직급 (grade, e.g. 대리)
  phone: text("phone").notNull().default(""), // 전화번호
  email: text("email").notNull().default(""), // login identifier for the linked account
  // ISO date, YYYY-MM-DD
  joinedAt: text("joined_at").notNull(),
  // Legacy fixed allowance; superseded by annualOverride + policy. Kept for old rows.
  totalOffdays: real("total_offdays").notNull().default(0),
  // Contract-specific annual entitlement per leave year. NULL = use the company default rule (lib/leaves/policy.ts).
  annualOverride: real("annual_override"),
  createdAt: integer("created_at", { mode: "timestamp_ms" })
    .notNull()
    .default(sql`(unixepoch() * 1000)`),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" })
    .notNull()
    .default(sql`(unixepoch() * 1000)`),
  },
  (t) => [index("members_team_idx").on(t.teamId)],
);

/** One row per member per working day: morning plan + end-of-day summary. */
export const dailyLogs = sqliteTable(
  "daily_logs",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    memberId: integer("member_id")
      .notNull()
      .references(() => members.id, { onDelete: "cascade" }),
    date: text("date").notNull(), // YYYY-MM-DD
    plan: text("plan").notNull().default(""),
    done: text("done").notNull().default(""),
    planUpdatedAt: integer("plan_updated_at", { mode: "timestamp_ms" }),
    doneUpdatedAt: integer("done_updated_at", { mode: "timestamp_ms" }),
  },
  (t) => [uniqueIndex("daily_logs_member_date").on(t.memberId, t.date)],
);

/** Individual to-do items for a member on a day. The end-of-day review marks each one. */
export const dailyTasks = sqliteTable(
  "daily_tasks",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    memberId: integer("member_id")
      .notNull()
      .references(() => members.id, { onDelete: "cascade" }),
    date: text("date").notNull(), // YYYY-MM-DD
    title: text("title").notNull(),
    status: text("status", { enum: TASK_STATUSES }).notNull().default("todo"),
    note: text("note").notNull().default(""), // end-of-day remark for this item
    weeklyItemId: integer("weekly_item_id").references((): AnySQLiteColumn => weeklyItems.id, { onDelete: "set null" }),
    position: integer("position").notNull().default(0),
    createdAt: integer("created_at", { mode: "timestamp_ms" })
      .notNull()
      .default(sql`(unixepoch() * 1000)`),
    reviewedAt: integer("reviewed_at", { mode: "timestamp_ms" }),
  },
  (t) => [index("daily_tasks_member_date").on(t.memberId, t.date)],
);

/** Team leader (or admin) comment on a member's day. One per reviewer per member per day. */
export const dailyReviews = sqliteTable(
  "daily_reviews",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    memberId: integer("member_id")
      .notNull()
      .references(() => members.id, { onDelete: "cascade" }),
    date: text("date").notNull(), // YYYY-MM-DD
    reviewerId: integer("reviewer_id").references(() => users.id, { onDelete: "set null" }),
    reviewerName: text("reviewer_name").notNull(),
    comment: text("comment").notNull(),
    createdAt: integer("created_at", { mode: "timestamp_ms" })
      .notNull()
      .default(sql`(unixepoch() * 1000)`),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" })
      .notNull()
      .default(sql`(unixepoch() * 1000)`),
  },
  (t) => [uniqueIndex("daily_reviews_member_date_reviewer").on(t.memberId, t.date, t.reviewerId)],
);

/**
 * Leader's weekly evaluation of one member (AI-drafted, leader-edited). One per member per week.
 * Members see it once shared, can mark it as read and reply.
 */
export const memberReviews = sqliteTable(
  "member_reviews",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    memberId: integer("member_id")
      .notNull()
      .references(() => members.id, { onDelete: "cascade" }),
    weekStart: text("week_start").notNull(), // Monday
    reviewerId: integer("reviewer_id").references(() => users.id, { onDelete: "set null" }),
    reviewerName: text("reviewer_name").notNull(),
    rating: integer("rating"), // 1-5, see RATING_LABEL
    summary: text("summary").notNull().default(""), // 종합 평가
    strengths: text("strengths").notNull().default(""), // 잘한 점
    improvements: text("improvements").notNull().default(""), // 보완할 점
    nextActions: text("next_actions").notNull().default(""), // 다음 주 할 일, one per line
    status: text("status", { enum: MEMBER_REVIEW_STATUSES }).notNull().default("draft"),
    model: text("model"),
    generatedAt: integer("generated_at", { mode: "timestamp_ms" }),
    sharedAt: integer("shared_at", { mode: "timestamp_ms" }),
    ackAt: integer("ack_at", { mode: "timestamp_ms" }), // member marked as read
    reply: text("reply").notNull().default(""), // member's reply
    repliedAt: integer("replied_at", { mode: "timestamp_ms" }),
    createdAt: integer("created_at", { mode: "timestamp_ms" })
      .notNull()
      .default(sql`(unixepoch() * 1000)`),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" })
      .notNull()
      .default(sql`(unixepoch() * 1000)`),
  },
  (t) => [uniqueIndex("member_reviews_member_week").on(t.memberId, t.weekStart)],
);

/**
 * 인사평가: leader's (or admin's) quarterly evaluation of a member, one per member per quarter ("2026-Q3").
 * The yearly average is computed from finalized quarters, not stored.
 * Private HR data — only admins and the member's team leader can read it; members never see it.
 */
export const memberEvaluations = sqliteTable(
  "member_evaluations",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    memberId: integer("member_id")
      .notNull()
      .references(() => members.id, { onDelete: "cascade" }),
    period: text("period").notNull(), // "2026-Q3"
    evaluatorId: integer("evaluator_id").references(() => users.id, { onDelete: "set null" }),
    evaluatorName: text("evaluator_name").notNull(),
    scores: text("scores", { mode: "json" }).$type<Record<string, number>>().notNull().default({}), // criterion key → 1-10
    total: real("total"), // average of scores, 1 decimal
    reasons: text("reasons", { mode: "json" }).$type<Record<string, string>>().notNull().default({}), // criterion key → 근거 (AI-drafted, leader-edited)
    aiModel: text("ai_model"),
    aiGeneratedAt: integer("ai_generated_at", { mode: "timestamp_ms" }),
    summary: text("summary").notNull().default(""),
    strengths: text("strengths").notNull().default(""),
    improvements: text("improvements").notNull().default(""),
    status: text("status", { enum: EVALUATION_STATUSES }).notNull().default("draft"),
    finalizedAt: integer("finalized_at", { mode: "timestamp_ms" }),
    createdAt: integer("created_at", { mode: "timestamp_ms" })
      .notNull()
      .default(sql`(unixepoch() * 1000)`),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" })
      .notNull()
      .default(sql`(unixepoch() * 1000)`),
  },
  (t) => [uniqueIndex("member_evaluations_member_period").on(t.memberId, t.period)],
);

/** Personal monthly goals (YYYY-MM), optionally tied to a team milestone. */
export const monthlyGoals = sqliteTable(
  "monthly_goals",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    memberId: integer("member_id")
      .notNull()
      .references(() => members.id, { onDelete: "cascade" }),
    month: text("month").notNull(), // YYYY-MM
    title: text("title").notNull(),
    status: text("status", { enum: TASK_STATUSES }).notNull().default("todo"),
    milestoneId: integer("milestone_id").references((): AnySQLiteColumn => milestones.id, { onDelete: "set null" }),
    position: integer("position").notNull().default(0),
    createdAt: integer("created_at", { mode: "timestamp_ms" })
      .notNull()
      .default(sql`(unixepoch() * 1000)`),
    doneAt: integer("done_at", { mode: "timestamp_ms" }),
  },
  (t) => [index("monthly_goals_member_month").on(t.memberId, t.month)],
);

/** Itemised weekly plan. Each item may point at a monthly goal and/or a team milestone. */
export const weeklyItems = sqliteTable(
  "weekly_items",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    memberId: integer("member_id")
      .notNull()
      .references(() => members.id, { onDelete: "cascade" }),
    weekStart: text("week_start").notNull(), // YYYY-MM-DD (Monday)
    title: text("title").notNull(),
    status: text("status", { enum: TASK_STATUSES }).notNull().default("todo"),
    milestoneId: integer("milestone_id").references((): AnySQLiteColumn => milestones.id, { onDelete: "set null" }),
    monthlyGoalId: integer("monthly_goal_id").references(() => monthlyGoals.id, { onDelete: "set null" }),
    /** Set when a team leader/admin added this item for the member. */
    assignedBy: integer("assigned_by").references(() => users.id, { onDelete: "set null" }),
    assignedByName: text("assigned_by_name"),
    position: integer("position").notNull().default(0),
    createdAt: integer("created_at", { mode: "timestamp_ms" })
      .notNull()
      .default(sql`(unixepoch() * 1000)`),
    doneAt: integer("done_at", { mode: "timestamp_ms" }),
  },
  (t) => [index("weekly_items_member_week").on(t.memberId, t.weekStart)],
);

/** One row per member per week (weekStart = Monday): free-text 성과 summary (plan is itemised in weekly_items). */
export const weeklyReports = sqliteTable(
  "weekly_reports",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    memberId: integer("member_id")
      .notNull()
      .references(() => members.id, { onDelete: "cascade" }),
    weekStart: text("week_start").notNull(), // YYYY-MM-DD (Monday)
    plan: text("plan").notNull().default(""),
    result: text("result").notNull().default(""),
    planUpdatedAt: integer("plan_updated_at", { mode: "timestamp_ms" }),
    resultUpdatedAt: integer("result_updated_at", { mode: "timestamp_ms" }),
  },
  (t) => [uniqueIndex("weekly_reports_member_week").on(t.memberId, t.weekStart)],
);

/** One row per member per day off. */
export const leaves = sqliteTable(
  "leaves",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    memberId: integer("member_id")
      .notNull()
      .references(() => members.id, { onDelete: "cascade" }),
    date: text("date").notNull(), // YYYY-MM-DD
    type: text("type", { enum: LEAVE_TYPES }).notNull(),
    note: text("note").notNull().default(""),
    requestId: integer("request_id").references((): AnySQLiteColumn => leaveRequests.id, { onDelete: "set null" }),
    createdAt: integer("created_at", { mode: "timestamp_ms" })
      .notNull()
      .default(sql`(unixepoch() * 1000)`),
  },
  (t) => [uniqueIndex("leaves_member_date").on(t.memberId, t.date)],
);

/** 휴가 품의서. One request may cover several calendar days (rows in `leaves`). Snapshots member data at write time for printing. */
export const leaveRequests = sqliteTable(
  "leave_requests",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    docNo: text("doc_no").notNull(), // e.g. platform-20260923-1
    memberId: integer("member_id")
      .notNull()
      .references(() => members.id, { onDelete: "cascade" }),
    type: text("type", { enum: LEAVE_TYPES }).notNull(),
    startDate: text("start_date").notNull(),
    endDate: text("end_date").notNull(),
    days: real("days").notNull(), // 신청일수
    reason: text("reason").notNull().default(""),
    delegate: text("delegate").notNull().default(""), // 업무대행
    contact: text("contact").notNull().default(""), // 연락처
    writtenAt: text("written_at").notNull(), // 작성일자 YYYY-MM-DD
    // snapshots for the printed form
    teamName: text("team_name").notNull(),
    position: text("position").notNull(),
    memberName: text("member_name").notNull(),
    usedDays: real("used_days").notNull(), // 본 신청 포함 사용 연차
    totalDays: real("total_days").notNull(), // 총 연차
    remainingDays: real("remaining_days").notNull(),
    // submitted = 승인 대기. Calendar rows (`leaves`) are written only when approved.
    status: text("status", { enum: REQUEST_STATUSES }).notNull().default("submitted"),
    decidedByName: text("decided_by_name"), // approver/rejecter (name snapshot, no FK)
    decidedAt: integer("decided_at", { mode: "timestamp_ms" }),
    decisionNote: text("decision_note").notNull().default(""), // reject reason
    createdBy: integer("created_by").references(() => users.id, { onDelete: "set null" }),
    createdAt: integer("created_at", { mode: "timestamp_ms" })
      .notNull()
      .default(sql`(unixepoch() * 1000)`),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" })
      .notNull()
      .default(sql`(unixepoch() * 1000)`),
  },
  (t) => [index("leave_requests_member").on(t.memberId, t.startDate)],
);

/**
 * 시간외(휴일) 근무신청서. Same approval flow as leave requests (submitted = 승인 대기 → approved/rejected, or cancelled).
 * Member data is snapshotted at write time for printing.
 */
export const overtimeRequests = sqliteTable(
  "overtime_requests",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    docNo: text("doc_no").notNull(),
    memberId: integer("member_id")
      .notNull()
      .references(() => members.id, { onDelete: "cascade" }),
    startAt: text("start_at").notNull(), // "YYYY-MM-DDTHH:mm" (KST wall time)
    endAt: text("end_at").notNull(),
    hours: real("hours").notNull(),
    reason: text("reason").notNull(),
    writtenAt: text("written_at").notNull(), // 신청일 YYYY-MM-DD
    // snapshots for the printed form
    teamName: text("team_name").notNull(), // 부서
    position: text("position").notNull(), // 직위 (rank || position)
    duty: text("duty").notNull(), // 담당업무 (position)
    memberName: text("member_name").notNull(),
    status: text("status", { enum: REQUEST_STATUSES }).notNull().default("submitted"),
    decidedByName: text("decided_by_name"),
    decidedAt: integer("decided_at", { mode: "timestamp_ms" }),
    decisionNote: text("decision_note").notNull().default(""),
    createdBy: integer("created_by").references(() => users.id, { onDelete: "set null" }),
    createdAt: integer("created_at", { mode: "timestamp_ms" })
      .notNull()
      .default(sql`(unixepoch() * 1000)`),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" })
      .notNull()
      .default(sql`(unixepoch() * 1000)`),
  },
  (t) => [index("overtime_requests_member").on(t.memberId, t.startAt)],
);

/** 일반 품의서. Same approval flow as leave/overtime; member data snapshotted for printing. */
export const generalRequests = sqliteTable(
  "general_requests",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    docNo: text("doc_no").notNull(),
    memberId: integer("member_id")
      .notNull()
      .references(() => members.id, { onDelete: "cascade" }),
    title: text("title").notNull(), // 제목
    purpose: text("purpose").notNull(), // 목적
    vendor: text("vendor").notNull().default(""), // 거래처
    period: text("period").notNull().default(""), // 기간 (free text, 용역일 때만)
    timing: text("timing").notNull().default(""), // 시기 = 지급일자 (free text)
    amount: integer("amount"), // minor units of `currency` (원, cents…)
    currency: text("currency", { enum: CURRENCIES }).notNull().default("KRW"),
    vat: text("vat", { enum: VAT_MODES }).notNull().default("included"),
    account: text("account").notNull().default(""), // 지급계좌
    extra: text("extra").notNull().default(""), // 양식 외 추가 항목
    attachment: text("attachment").notNull().default(""), // 첨부 (파일명 등 텍스트)
    retention: integer("retention").notNull().default(3), // 보존기간 (년, 0 = 영구)
    writtenAt: text("written_at").notNull(),
    teamName: text("team_name").notNull(),
    position: text("position").notNull(), // 직위 (rank || position)
    memberName: text("member_name").notNull(),
    status: text("status", { enum: REQUEST_STATUSES }).notNull().default("submitted"),
    decidedByName: text("decided_by_name"),
    decidedAt: integer("decided_at", { mode: "timestamp_ms" }),
    decisionNote: text("decision_note").notNull().default(""),
    createdBy: integer("created_by").references(() => users.id, { onDelete: "set null" }),
    createdAt: integer("created_at", { mode: "timestamp_ms" })
      .notNull()
      .default(sql`(unixepoch() * 1000)`),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" })
      .notNull()
      .default(sql`(unixepoch() * 1000)`),
  },
  (t) => [index("general_requests_member").on(t.memberId, t.writtenAt)],
);

/** 택시비 지급 품의서. Title is fixed on the form; same approval flow as the other 품의. */
export const taxiRequests = sqliteTable(
  "taxi_requests",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    docNo: text("doc_no").notNull(),
    memberId: integer("member_id")
      .notNull()
      .references(() => members.id, { onDelete: "cascade" }),
    reason: text("reason").notNull(), // 지급 요청 사유
    useStart: text("use_start").notNull(), // 이용 기간 YYYY-MM-DD
    useEnd: text("use_end").notNull(),
    amount: integer("amount").notNull(), // 총 이용 금액 (원)
    account: text("account").notNull().default(""), // 지급계좌
    attachment: text("attachment").notNull().default(""),
    retention: integer("retention").notNull().default(3),
    writtenAt: text("written_at").notNull(),
    teamName: text("team_name").notNull(),
    position: text("position").notNull(),
    memberName: text("member_name").notNull(),
    status: text("status", { enum: REQUEST_STATUSES }).notNull().default("submitted"),
    decidedByName: text("decided_by_name"),
    decidedAt: integer("decided_at", { mode: "timestamp_ms" }),
    decisionNote: text("decision_note").notNull().default(""),
    createdBy: integer("created_by").references(() => users.id, { onDelete: "set null" }),
    createdAt: integer("created_at", { mode: "timestamp_ms" })
      .notNull()
      .default(sql`(unixepoch() * 1000)`),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" })
      .notNull()
      .default(sql`(unixepoch() * 1000)`),
  },
  (t) => [index("taxi_requests_member").on(t.memberId, t.writtenAt)],
);

/**
 * 회식비 품의 pair. stage "budget" = 전산품의 (approved first); stage "settle" = 청구(정산)품의, filed from an
 * approved budget row (`parentId`). Settle copies 인원/금액/결제 방식 and adds 시기 (회식일) + 지급계좌.
 */
export const dinnerRequests = sqliteTable(
  "dinner_requests",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    stage: text("stage", { enum: DINNER_STAGES }).notNull(),
    parentId: integer("parent_id").references((): AnySQLiteColumn => dinnerRequests.id, { onDelete: "set null" }),
    docNo: text("doc_no").notNull(),
    memberId: integer("member_id")
      .notNull()
      .references(() => members.id, { onDelete: "cascade" }),
    headcount: text("headcount").notNull(), // 인원 (free text, e.g. "4명 (A, B, C, D)")
    limitPerPerson: integer("limit_per_person").notNull(), // 1인당 한도 snapshot
    amount: integer("amount").notNull(), // 금액 (원)
    payMethod: text("pay_method").notNull(), // 법인카드 or 현금 수령인
    dinnerDate: text("dinner_date"), // 시기 (settle only) YYYY-MM-DD
    account: text("account").notNull().default(""), // 지급계좌 (settle only)
    retention: integer("retention").notNull().default(3),
    writtenAt: text("written_at").notNull(),
    teamName: text("team_name").notNull(),
    position: text("position").notNull(),
    memberName: text("member_name").notNull(),
    status: text("status", { enum: REQUEST_STATUSES }).notNull().default("submitted"),
    decidedByName: text("decided_by_name"),
    decidedAt: integer("decided_at", { mode: "timestamp_ms" }),
    decisionNote: text("decision_note").notNull().default(""),
    createdBy: integer("created_by").references(() => users.id, { onDelete: "set null" }),
    createdAt: integer("created_at", { mode: "timestamp_ms" })
      .notNull()
      .default(sql`(unixepoch() * 1000)`),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" })
      .notNull()
      .default(sql`(unixepoch() * 1000)`),
  },
  (t) => [index("dinner_requests_member").on(t.memberId, t.writtenAt), index("dinner_requests_parent").on(t.parentId)],
);

/** Public holidays and company days off. Used to decide working days. */
export const holidays = sqliteTable("holidays", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  date: text("date").notNull().unique(), // YYYY-MM-DD
  name: text("name").notNull(),
});

/** Team milestone shown on the Gantt timeline. */
export const milestones = sqliteTable("milestones", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  teamId: integer("team_id")
    .notNull()
    .references(() => teams.id),
  title: text("title").notNull(),
  description: text("description").notNull().default(""),
  startDate: text("start_date").notNull(), // YYYY-MM-DD
  dueDate: text("due_date").notNull(), // YYYY-MM-DD (inclusive)
  status: text("status", { enum: MILESTONE_STATUSES }).notNull().default("planned"),
  progress: integer("progress").notNull().default(0), // 0-100
  ownerId: integer("owner_id").references(() => members.id, { onDelete: "set null" }),
  createdBy: integer("created_by").references(() => users.id, { onDelete: "set null" }),
  // Approval workflow. Existing rows default to approved. No FK for the approver (name snapshot only).
  approval: text("approval", { enum: MILESTONE_APPROVALS }).notNull().default("approved"),
  approvalNote: text("approval_note").notNull().default(""), // reject reason
  approvalByName: text("approval_by_name"),
  approvalAt: integer("approval_at", { mode: "timestamp_ms" }),
  createdAt: integer("created_at", { mode: "timestamp_ms" })
    .notNull()
    .default(sql`(unixepoch() * 1000)`),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" })
    .notNull()
    .default(sql`(unixepoch() * 1000)`),
});

/** Status log entries for a milestone. */
export const milestoneUpdates = sqliteTable("milestone_updates", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  milestoneId: integer("milestone_id")
    .notNull()
    .references(() => milestones.id, { onDelete: "cascade" }),
  authorId: integer("author_id").references(() => users.id, { onDelete: "set null" }),
  authorName: text("author_name").notNull(),
  note: text("note").notNull(),
  status: text("status", { enum: MILESTONE_STATUSES }).notNull(),
  progress: integer("progress").notNull(),
  createdAt: integer("created_at", { mode: "timestamp_ms" })
    .notNull()
    .default(sql`(unixepoch() * 1000)`),
});

export const REPORT_STATUSES = ["draft", "final"] as const;
export type ReportStatus = (typeof REPORT_STATUSES)[number];

/** AI-drafted, leader-edited weekly team report. One per team per week. */
export const teamReports = sqliteTable(
  "team_reports",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    teamId: integer("team_id")
      .notNull()
      .references(() => teams.id),
    weekStart: text("week_start").notNull(), // Monday
    content: text("content").notNull().default(""), // markdown
    status: text("status", { enum: REPORT_STATUSES }).notNull().default("draft"),
    model: text("model"),
    generatedAt: integer("generated_at", { mode: "timestamp_ms" }),
    updatedBy: integer("updated_by").references(() => users.id, { onDelete: "set null" }),
    updatedByName: text("updated_by_name"),
    createdAt: integer("created_at", { mode: "timestamp_ms" })
      .notNull()
      .default(sql`(unixepoch() * 1000)`),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" })
      .notNull()
      .default(sql`(unixepoch() * 1000)`),
  },
  (t) => [uniqueIndex("team_reports_team_week").on(t.teamId, t.weekStart)],
);

/** Leader's weekly team-meeting prep notes (topics + AI-drafted, edited agenda). One per team per week. */
export const meetingNotes = sqliteTable(
  "meeting_notes",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    teamId: integer("team_id")
      .notNull()
      .references(() => teams.id),
    weekStart: text("week_start").notNull(),
    topics: text("topics").notNull().default(""), // leader's agenda topics (plain text, one per line)
    content: text("content").notNull().default(""), // markdown
    status: text("status", { enum: REPORT_STATUSES }).notNull().default("draft"),
    model: text("model"),
    generatedAt: integer("generated_at", { mode: "timestamp_ms" }),
    updatedBy: integer("updated_by").references(() => users.id, { onDelete: "set null" }),
    updatedByName: text("updated_by_name"),
    createdAt: integer("created_at", { mode: "timestamp_ms" })
      .notNull()
      .default(sql`(unixepoch() * 1000)`),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" })
      .notNull()
      .default(sql`(unixepoch() * 1000)`),
  },
  (t) => [uniqueIndex("meeting_notes_team_week").on(t.teamId, t.weekStart)],
);

export type User = typeof users.$inferSelect;
export type MeetingNote = typeof meetingNotes.$inferSelect;
export type TeamReport = typeof teamReports.$inferSelect;
/** Raw milestones row. Pages use `MilestoneRow` from "@/lib/milestones/types" (joined with team name). */
export type MilestoneRecord = typeof milestones.$inferSelect;
export type MilestoneUpdate = typeof milestoneUpdates.$inferSelect;
export type DailyLog = typeof dailyLogs.$inferSelect;
export type DailyTask = typeof dailyTasks.$inferSelect;
export type WeeklyItem = typeof weeklyItems.$inferSelect;
export type MonthlyGoal = typeof monthlyGoals.$inferSelect;
export type DailyReview = typeof dailyReviews.$inferSelect;
export type MemberReview = typeof memberReviews.$inferSelect;
export type MemberEvaluation = typeof memberEvaluations.$inferSelect;
export type WeeklyReport = typeof weeklyReports.$inferSelect;
export type Leave = typeof leaves.$inferSelect;
export type LeaveRequest = typeof leaveRequests.$inferSelect;
export type OvertimeRequest = typeof overtimeRequests.$inferSelect;
export type GeneralRequest = typeof generalRequests.$inferSelect;
export type TaxiRequest = typeof taxiRequests.$inferSelect;
export type DinnerRequest = typeof dinnerRequests.$inferSelect;
export type Holiday = typeof holidays.$inferSelect;
export type Team = typeof teams.$inferSelect;
/** Raw members row. Most code should use `Member` from "@/lib/members/types" (joined with team). */
export type MemberRecord = typeof members.$inferSelect;
export type Session = typeof sessions.$inferSelect;
