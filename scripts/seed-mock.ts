/**
 * Demo data for local testing. Safe to run next to real data: only rows created
 * by this script (identified by MOCK_* names) are ever touched.
 *
 *   pnpm db:seed:mock          insert (skips if mock members already exist)
 *   pnpm db:seed:mock --reset  delete previous mock rows, then insert again
 *   pnpm db:seed:mock --clean  delete mock rows only
 *
 * All mock accounts use password: demo1234
 */
import { and, eq, gte, inArray, lte } from "drizzle-orm";
import { hashPassword } from "../src/lib/auth/password";
import { addDays, isWeekend, todayKey, weekStartOf } from "../src/lib/dates";
import { db, schema } from "../src/lib/db";
import type { LeaveType, MilestoneStatus } from "../src/lib/db/schema";

const PASSWORD = "demo1234";
const today = todayKey();
const thisMonday = weekStartOf(today);

type MockMember = { name: string; team: string; position: string; rank: string; phone: string; email: string; joinedAt: string; totalOffdays: number; isLeader?: boolean; username: string; role: string };
const MOCK_MEMBERS: MockMember[] = [
  { name: "김민수", team: "platform", position: "백엔드 엔지니어", rank: "대리", phone: "010-2201-1101", joinedAt: "2023-03-06", totalOffdays: 16, username: "minsu", email: "minsu@diverse-inc.co.kr", role: "backend" },
  { name: "이서연", team: "platform", position: "프론트엔드 엔지니어", rank: "사원", phone: "010-2201-1102", joinedAt: "2024-07-01", totalOffdays: 15, username: "seoyeon", email: "seoyeon@diverse-inc.co.kr", role: "frontend" },
  { name: "박지훈", team: "인프라팀", position: "DevOps 엔지니어", rank: "과장", phone: "010-2201-1201", joinedAt: "2021-01-11", totalOffdays: 18, isLeader: true, username: "jihoon", email: "jihoon@diverse-inc.co.kr", role: "devops" },
  { name: "최유진", team: "인프라팀", position: "SRE", rank: "대리", phone: "010-2201-1202", joinedAt: "2024-02-19", totalOffdays: 15, username: "yujin", email: "yujin@diverse-inc.co.kr", role: "devops" },
  { name: "정우성", team: "데이터팀", position: "데이터 엔지니어", rank: "차장", phone: "010-2201-1301", joinedAt: "2020-09-14", totalOffdays: 19, isLeader: true, username: "woosung", email: "woosung@diverse-inc.co.kr", role: "data" },
  { name: "한지민", team: "데이터팀", position: "데이터 분석가", rank: "사원", phone: "010-2201-1302", joinedAt: "2025-03-03", totalOffdays: 15, username: "jimin", email: "jimin@diverse-inc.co.kr", role: "analyst" },
  { name: "오세훈", team: "데이터팀", position: "ML 엔지니어", rank: "대리", phone: "010-2201-1303", joinedAt: "2022-11-07", totalOffdays: 16, username: "sehoon", email: "sehoon@diverse-inc.co.kr", role: "ml" },
];
const MOCK_NAMES = MOCK_MEMBERS.map((m) => m.name);
const MOCK_USERNAMES = MOCK_MEMBERS.map((m) => m.username);
const MOCK_MILESTONE_TITLES = [
  "결제 시스템 v2 출시",
  "관리자 콘솔 리뉴얼",
  "레거시 API 종료",
  "쿠버네티스 마이그레이션",
  "모니터링 알림 정비",
  "데이터 웨어하우스 구축",
  "로그 파이프라인 안정화",
  "주간 리포트 자동화",
];

// deterministic pseudo-random so repeated runs produce the same demo
let seed = 20260923;
const rand = () => ((seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648);
const pick = <T>(arr: T[]) => arr[Math.floor(rand() * arr.length)];

const holidaySet = new Set(
  db.select({ date: schema.holidays.date }).from(schema.holidays).where(and(gte(schema.holidays.date, addDays(today, -60)), lte(schema.holidays.date, addDays(today, 60)))).all().map((h) => h.date),
);
const isWorkingDay = (d: string) => !isWeekend(d) && !holidaySet.has(d);
const nextWorkingDay = (d: string) => { while (!isWorkingDay(d)) d = addDays(d, 1); return d; };
const workingDaysBetween = (from: string, to: string) => { const out: string[] = []; for (let d = from; d <= to; d = addDays(d, 1)) if (isWorkingDay(d)) out.push(d); return out; };

const PLAN: Record<string, string[]> = {
  backend: ["- 결제 승인 API 리팩터링", "- 정산 배치 실패 케이스 재현", "- PR 리뷰 3건", "- 주문 도메인 테스트 보강", "- PG 웹훅 재시도 로직 구현", "- 성능 프로파일링 (주문 조회)"],
  frontend: ["- 관리자 콘솔 목록 화면 퍼블리싱", "- 디자인 시스템 버튼 컴포넌트 정리", "- 결제 실패 UX 개선안 검토", "- E2E 테스트 시나리오 추가", "- 접근성 점검 (키보드 내비게이션)", "- 번들 사이즈 분석"],
  devops: ["- 스테이징 클러스터 노드 교체", "- Helm 차트 값 정리", "- 알림 룰 노이즈 제거", "- 비용 리포트 확인", "- 배포 파이프라인 캐시 최적화", "- 인시던트 회고 문서 작성"],
  data: ["- DW 적재 잡 스케줄 조정", "- 원천 테이블 스키마 변경 대응", "- dbt 모델 리뷰", "- 적재 지연 알림 기준 재설정", "- 백필 작업 (7월 주문)", "- 파티션 정리 스크립트 작성"],
  analyst: ["- 주간 KPI 리포트 초안", "- 결제 전환율 세그먼트 분석", "- 대시보드 지표 정의 정리", "- 마케팅팀 요청 데이터 추출", "- 이탈 코호트 분석", "- 리포트 자동화 요구사항 정리"],
  ml: ["- 추천 모델 피처 파이프라인 점검", "- 오프라인 평가 지표 계산", "- 학습 잡 GPU 사용량 확인", "- 모델 서빙 레이턴시 측정", "- 실험 결과 정리 및 공유", "- 데이터 드리프트 모니터링"],
};

function makeText(role: string, n: number) {
  const items = [...PLAN[role]];
  const chosen: string[] = [];
  for (let i = 0; i < n && items.length; i++) chosen.push(items.splice(Math.floor(rand() * items.length), 1)[0]);
  return chosen;
}

function clean() {
  const mockMembers = db.select({ id: schema.members.id }).from(schema.members).where(inArray(schema.members.name, MOCK_NAMES)).all();
  const ids = mockMembers.map((m) => m.id);
  db.transaction((tx) => {
    if (ids.length) {
      tx.update(schema.users).set({ memberId: null }).where(inArray(schema.users.memberId, ids)).run();
      tx.delete(schema.members).where(inArray(schema.members.id, ids)).run(); // cascades logs/reports/leaves
    }
    tx.delete(schema.users).where(inArray(schema.users.username, MOCK_USERNAMES)).run();
    tx.delete(schema.milestones).where(inArray(schema.milestones.title, MOCK_MILESTONE_TITLES)).run(); // cascades updates
    // remove mock-only teams that are now empty
    for (const name of ["인프라팀", "데이터팀"]) {
      const t = tx.select().from(schema.teams).where(eq(schema.teams.name, name)).get();
      if (!t) continue;
      const used = tx.select({ id: schema.members.id }).from(schema.members).where(eq(schema.members.teamId, t.id)).get() || tx.select({ id: schema.milestones.id }).from(schema.milestones).where(eq(schema.milestones.teamId, t.id)).get();
      if (!used) tx.delete(schema.teams).where(eq(schema.teams.id, t.id)).run();
    }
  });
  console.log(`Removed mock data (${ids.length} members, ${MOCK_MILESTONE_TITLES.length} milestone titles).`);
}

function insert() {
  const existing = db.select({ id: schema.members.id }).from(schema.members).where(inArray(schema.members.name, MOCK_NAMES)).all();
  if (existing.length) {
    console.log("Mock members already exist. Use --reset to recreate them.");
    return;
  }

  const memberIds = new Map<string, number>();
  const userIds = new Map<string, number>();
  db.transaction((tx) => {
    // teams (reuse existing by name)
    const teamIds = new Map<string, number>();
    for (const name of new Set([...MOCK_MEMBERS.map((m) => m.team)])) {
      const existing = tx.select({ id: schema.teams.id }).from(schema.teams).where(eq(schema.teams.name, name)).get();
      teamIds.set(name, existing?.id ?? Number(tx.insert(schema.teams).values({ name }).run().lastInsertRowid));
    }
    // members + accounts
    for (const m of MOCK_MEMBERS) {
      const r = tx.insert(schema.members).values({ teamId: teamIds.get(m.team)!, name: m.name, position: m.position, rank: m.rank, phone: m.phone, email: m.email, joinedAt: m.joinedAt, totalOffdays: m.totalOffdays }).run();
      const id = Number(r.lastInsertRowid);
      memberIds.set(m.name, id);
      if (m.isLeader) {
        const team = tx.select().from(schema.teams).where(eq(schema.teams.id, teamIds.get(m.team)!)).get();
        if (team && team.leaderMemberId == null) tx.update(schema.teams).set({ leaderMemberId: id }).where(eq(schema.teams.id, team.id)).run();
      }
      const u = tx.insert(schema.users).values({ username: m.username, email: m.email, name: m.name, role: "member", memberId: id, passwordHash: hashPassword(PASSWORD) }).run();
      userIds.set(m.name, Number(u.lastInsertRowid));
    }

    // leaves (relative to today, on working days)
    const leaves: { name: string; date: string; type: LeaveType; note?: string }[] = [];
    const addLeave = (name: string, date: string, type: LeaveType, note = "") => { if (isWorkingDay(date)) leaves.push({ name, date, type, note }); };
    const mon = thisMonday;
    // this week
    addLeave("이서연", nextWorkingDay(addDays(mon, 1)), "half_pm", "병원");
    addLeave("최유진", nextWorkingDay(mon), "annual", "");
    addLeave("최유진", nextWorkingDay(addDays(mon, 1)), "annual", "");
    addLeave("최유진", nextWorkingDay(addDays(mon, 2)), "annual", "가족 여행");
    addLeave("오세훈", nextWorkingDay(addDays(mon, 2)), "sick", "");
    // next week
    addLeave("김민수", nextWorkingDay(addDays(mon, 7)), "annual", "");
    addLeave("김민수", nextWorkingDay(addDays(mon, 8)), "annual", "");
    addLeave("한지민", nextWorkingDay(addDays(mon, 10)), "half_am", "");
    addLeave("정우성", nextWorkingDay(addDays(mon, 11)), "petition", "경조사");
    // past weeks
    addLeave("박지훈", nextWorkingDay(addDays(mon, -12)), "sick", "감기");
    addLeave("박지훈", nextWorkingDay(addDays(mon, -11)), "sick", "");
    addLeave("한지민", nextWorkingDay(addDays(mon, -18)), "annual", "");
    addLeave("이서연", nextWorkingDay(addDays(mon, -25)), "annual", "");
    addLeave("이서연", nextWorkingDay(addDays(mon, -24)), "annual", "");
    addLeave("오세훈", nextWorkingDay(addDays(mon, -5)), "half_am", "");
    for (const l of leaves) {
      tx.insert(schema.leaves).values({ memberId: memberIds.get(l.name)!, date: l.date, type: l.type, note: l.note ?? "" }).onConflictDoNothing().run();
    }
    const onLeave = new Set(leaves.filter((l) => l.type === "annual" || l.type === "sick" || l.type === "other").map((l) => `${l.name}:${l.date}`));

    // daily logs: last 4 weeks up to today
    const days = workingDaysBetween(addDays(mon, -28), today);
    for (const m of MOCK_MEMBERS) {
      for (const d of days) {
        if (onLeave.has(`${m.name}:${d}`)) continue;
        if (rand() < 0.08) continue; // occasionally forgot
        const plan = makeText(m.role, 2 + Math.floor(rand() * 3)).map((p) => p.replace(/^- /, ""));
        const isToday = d === today;
        const reviewed = !(isToday && rand() < 0.6);
        const at = (h: number, min: number) => new Date(`${d}T${String(h).padStart(2, "0")}:${String(min).padStart(2, "0")}:00+09:00`);
        const createdAt = at(9, 5 + Math.floor(rand() * 40));
        const reviewedAt = reviewed ? at(18, Math.floor(rand() * 50)) : null;
        plan.forEach((title, i) => {
          const roll = rand();
          const status = !reviewed ? "todo" : roll < 0.7 ? "done" : roll < 0.9 ? "in_progress" : "todo";
          tx.insert(schema.dailyTasks).values({ memberId: memberIds.get(m.name)!, date: d, title, status, position: i + 1, createdAt, reviewedAt }).run();
        });
        const extra = reviewed && rand() < 0.35 ? pick(["- 긴급 장애 대응 30분", "- 신규 입사자 온보딩 지원", "- 타 팀 문의 응대", "- 배포 후 모니터링"]) : "";
        tx.insert(schema.dailyLogs)
          .values({ memberId: memberIds.get(m.name)!, date: d, plan: "", done: extra, planUpdatedAt: createdAt, doneUpdatedAt: extra ? reviewedAt : null })
          .onConflictDoNothing()
          .run();
      }
    }

    // leader reviews on team members' past days (leaders: 박지훈 → 인프라팀, 정우성 → 데이터팀)
    const REVIEWS = ["오늘 처리 잘 했어요. 내일은 리뷰 먼저 부탁해요.", "진행 중인 항목은 내일 오전에 같이 보죠.", "블로커 있으면 바로 공유해 주세요.", "정리 깔끔합니다. 문서화까지 해두면 좋겠어요.", "우선순위를 다시 잡아야 할 것 같아요. 내일 잠깐 이야기해요.", "좋아요. 이 속도면 일정 맞출 수 있겠네요."];
    const leaders: [string, string][] = [["박지훈", "인프라팀"], ["정우성", "데이터팀"]];
    for (const [leader, team] of leaders) {
      const reviewerId = userIds.get(leader)!;
      for (const m of MOCK_MEMBERS.filter((x) => x.team === team && x.name !== leader)) {
        for (const d of days.filter((x) => x < today)) {
          if (rand() < 0.45) continue;
          if (onLeave.has(`${m.name}:${d}`)) continue; // no review on a day off
          tx.insert(schema.dailyReviews)
            .values({ memberId: memberIds.get(m.name)!, date: d, reviewerId, reviewerName: leader, comment: pick(REVIEWS), createdAt: new Date(`${d}T19:10:00+09:00`), updatedAt: new Date(`${d}T19:10:00+09:00`) })
            .onConflictDoNothing()
            .run();
        }
      }
    }

    // monthly goals (this month and last month), weekly items (5 weeks) linked to goals/milestones, 성과 text for past weeks
    const monthOf = (k: string) => k.slice(0, 7);
    const goalIds = new Map<string, number[]>(); // member -> goal ids for current month
    const GOALS: Record<string, string[]> = {
      backend: ["결제 v2 정산 안정화", "주문 API 응답 300ms 이하"], frontend: ["관리자 콘솔 시안 확정", "E2E 커버리지 60%"],
      devops: ["EKS 이전 서비스 8개", "알림 노이즈 50% 감소"], data: ["회원 마트 완성", "적재 지연 알림 정착"],
      analyst: ["주간 KPI 리포트 자동화 착수", "결제 전환 분석 리포트"], ml: ["추천 모델 오프라인 평가 체계", "로그 파이프라인 재처리 자동화"],
    };
    for (const m of MOCK_MEMBERS) {
      const ids: number[] = [];
      for (const mm of [monthOf(today), monthOf(addDays(mon, -28))]) {
        GOALS[m.role].forEach((title, i) => {
          const status = mm === monthOf(today) ? (i === 0 ? "in_progress" : "todo") : "done";
          const r = tx.insert(schema.monthlyGoals).values({ memberId: memberIds.get(m.name)!, month: mm, title, status, position: i + 1 }).run();
          if (mm === monthOf(today)) ids.push(Number(r.lastInsertRowid));
        });
      }
      goalIds.set(m.name, ids);
    }
    for (const m of MOCK_MEMBERS) {
      for (let w = -4; w <= 0; w++) {
        const ws = addDays(mon, w * 7);
        const titles = makeText(m.role, 3).map((s) => s.replace(/^- /, ""));
        const itemIds: number[] = [];
        titles.forEach((title, i) => {
          const status = w < 0 ? (rand() < 0.8 ? "done" : "in_progress") : i === 0 ? "in_progress" : "todo";
          const goal = goalIds.get(m.name)?.[i % 2] ?? null;
          const r = tx.insert(schema.weeklyItems).values({ memberId: memberIds.get(m.name)!, weekStart: ws, title, status, monthlyGoalId: w >= -1 ? goal : null, position: i + 1, createdAt: new Date(`${ws}T09:30:00+09:00`), doneAt: status === "done" ? new Date(`${addDays(ws, 4)}T18:00:00+09:00`) : null }).run();
          itemIds.push(Number(r.lastInsertRowid));
        });
        // link some of that week's daily tasks to weekly items
        const weekTasks = tx.select().from(schema.dailyTasks).where(and(eq(schema.dailyTasks.memberId, memberIds.get(m.name)!), gte(schema.dailyTasks.date, ws), lte(schema.dailyTasks.date, addDays(ws, 6)))).all();
        for (const t of weekTasks) if (rand() < 0.5) tx.update(schema.dailyTasks).set({ weeklyItemId: pick(itemIds) }).where(eq(schema.dailyTasks.id, t.id)).run();
        const result = w < 0 ? titles.map((p) => `${p} → ${pick(["완료", "완료", "다음 주로 이월", "완료 (일정보다 하루 지연)"])}`) : [];
        tx.insert(schema.weeklyReports)
          .values({ memberId: memberIds.get(m.name)!, weekStart: ws, plan: "", result: result.join("\n"), planUpdatedAt: new Date(`${ws}T09:30:00+09:00`), resultUpdatedAt: result.length ? new Date(`${addDays(ws, 4)}T18:10:00+09:00`) : null })
          .onConflictDoNothing()
          .run();
      }
    }

    // milestones + update history
    const adminId = db.select({ id: schema.users.id }).from(schema.users).where(eq(schema.users.role, "admin")).get()?.id ?? null;
    type MS = { title: string; team: string; owner: string | null; start: number; due: number; status: MilestoneStatus; progress: number; description: string; updates: [number, string, MilestoneStatus, number][] };
    // start/due are day offsets from this Monday; update tuples: [dayOffset, note, status, progress]
    const MS_LIST: MS[] = [
      { title: "결제 시스템 v2 출시", team: "platform", owner: "김민수", start: -14, due: 19, status: "in_progress", progress: 60, description: "PG 연동 교체 및 정산 자동화.\n완료 기준: 신규 PG로 100% 전환, 정산 배치 무중단 3주.", updates: [[-14, "마일스톤을 만들었습니다.", "planned", 0], [-9, "PG 샌드박스 연동 완료. 결제 승인·취소 흐름 검증 중.", "in_progress", 25], [-3, "정산 배치 1차 구현 완료. 실패 케이스 재처리 로직 남음.", "in_progress", 45], [0, "웹훅 재시도 로직 구현. 다음 주 스테이징 전환 예정.", "in_progress", 60]] },
      { title: "관리자 콘솔 리뉴얼", team: "platform", owner: "이서연", start: 7, due: 46, status: "planned", progress: 0, description: "운영팀 요청 반영한 관리자 콘솔 전면 개편. 디자인 시안 확정 후 착수.", updates: [[-2, "마일스톤을 만들었습니다.", "planned", 0]] },
      { title: "레거시 API 종료", team: "platform", owner: "김민수", start: -42, due: -8, status: "done", progress: 100, description: "v1 API 트래픽 0% 달성 후 서버 종료.", updates: [[-42, "마일스톤을 만들었습니다.", "planned", 0], [-30, "클라이언트 3곳 마이그레이션 완료. 잔여 트래픽 12%.", "in_progress", 60], [-15, "잔여 트래픽 0.3%. 종료 공지 발송.", "in_progress", 90], [-8, "v1 서버 종료 완료.", "done", 100]] },
      { title: "쿠버네티스 마이그레이션", team: "인프라팀", owner: "박지훈", start: -21, due: 33, status: "in_progress", progress: 45, description: "VM 기반 서비스 12개를 EKS로 이전.\n완료 기준: 전체 서비스 이전 및 VM 해지.", updates: [[-21, "마일스톤을 만들었습니다.", "planned", 0], [-14, "스테이징 클러스터 구성 완료. 서비스 3개 이전.", "in_progress", 20], [-6, "서비스 6개 이전. 로그 수집 경로 이슈 해결.", "in_progress", 45]] },
      { title: "모니터링 알림 정비", team: "인프라팀", owner: "최유진", start: -10, due: 11, status: "on_hold", progress: 30, description: "알림 노이즈 70% 감소 목표. 마이그레이션 완료 후 재개.", updates: [[-10, "마일스톤을 만들었습니다.", "planned", 0], [-7, "현행 알림 룰 인벤토리 작성 완료.", "in_progress", 30], [-1, "마이그레이션 우선으로 잠시 보류.", "on_hold", 30]] },
      { title: "데이터 웨어하우스 구축", team: "데이터팀", owner: "정우성", start: -35, due: 25, status: "in_progress", progress: 70, description: "주문·결제·회원 도메인 마트 구축 및 BI 연결.", updates: [[-35, "마일스톤을 만들었습니다.", "planned", 0], [-24, "원천 적재 파이프라인 완료.", "in_progress", 35], [-10, "주문·결제 마트 완료. 회원 마트 진행 중.", "in_progress", 60], [-2, "BI 대시보드 연결 테스트 중.", "in_progress", 70]] },
      { title: "로그 파이프라인 안정화", team: "데이터팀", owner: "오세훈", start: -28, due: -3, status: "in_progress", progress: 80, description: "적재 지연 알림 및 자동 재처리. 마감 지연 중.", updates: [[-28, "마일스톤을 만들었습니다.", "planned", 0], [-16, "재처리 잡 구현 완료. 알림 기준 조정 중.", "in_progress", 60], [-4, "피크 시간대 지연 재발. 원인 분석 중이라 마감 연기 필요.", "in_progress", 80]] },
      { title: "주간 리포트 자동화", team: "데이터팀", owner: "한지민", start: 3, due: 24, status: "planned", progress: 0, description: "매주 월요일 KPI 리포트 자동 생성·발송.", updates: [[-1, "마일스톤을 만들었습니다.", "planned", 0]] },
    ];
    for (const ms of MS_LIST) {
      const r = tx.insert(schema.milestones).values({
        teamId: teamIds.get(ms.team)!, title: ms.title, description: ms.description, startDate: addDays(mon, ms.start), dueDate: addDays(mon, ms.due),
        status: ms.status, progress: ms.progress, ownerId: ms.owner ? memberIds.get(ms.owner) ?? null : null, createdBy: adminId,
        createdAt: new Date(`${addDays(mon, ms.updates[0][0])}T10:00:00+09:00`), updatedAt: new Date(`${addDays(mon, ms.updates[ms.updates.length - 1][0])}T17:00:00+09:00`),
      }).run();
      const id = Number(r.lastInsertRowid);
      ms.updates.forEach(([off, note, status, progress], i) => {
        const authorName = i === 0 ? "관리자" : ms.owner ?? "관리자";
        const authorId = i === 0 ? adminId : ms.owner ? userIds.get(ms.owner) ?? adminId : adminId;
        tx.insert(schema.milestoneUpdates).values({ milestoneId: id, authorId, authorName, note, status, progress, createdAt: new Date(`${addDays(mon, off)}T${i === 0 ? "10:00" : "17:20"}:00+09:00`) }).run();
      });
    }
  });

  // leaders assign one item to each teammate for this week
  db.transaction((tx) => {
    for (const [leader, team] of [["박지훈", "인프라팀"], ["정우성", "데이터팀"]] as [string, string][]) {
      for (const m of MOCK_MEMBERS.filter((x) => x.team === team && x.name !== leader)) {
        tx.insert(schema.weeklyItems).values({ memberId: memberIds.get(m.name)!, weekStart: thisMonday, title: pick(["주간 회의 안건 준비", "온콜 인수인계 문서 갱신", "분기 목표 초안 작성"]), assignedBy: userIds.get(leader)!, assignedByName: leader, position: 9 }).run();
      }
    }
  });

  // link this week's weekly items and current goals to the owner's in-progress milestone
  db.transaction((tx) => {
    for (const m of MOCK_MEMBERS) {
      const mid = memberIds.get(m.name)!;
      const ms = tx.select().from(schema.milestones).where(and(eq(schema.milestones.ownerId, mid), eq(schema.milestones.status, "in_progress"))).get();
      if (!ms) continue;
      tx.update(schema.weeklyItems).set({ milestoneId: ms.id }).where(and(eq(schema.weeklyItems.memberId, mid), eq(schema.weeklyItems.weekStart, thisMonday), eq(schema.weeklyItems.position, 1))).run();
      tx.update(schema.monthlyGoals).set({ milestoneId: ms.id }).where(and(eq(schema.monthlyGoals.memberId, mid), eq(schema.monthlyGoals.month, today.slice(0, 7)), eq(schema.monthlyGoals.position, 1))).run();
    }
  });

  console.log(`Inserted ${MOCK_MEMBERS.length} members with accounts (password: ${PASSWORD}):`);
  for (const m of MOCK_MEMBERS) console.log(`  ${m.username.padEnd(8)} ${m.name} · ${m.team} · ${m.position}${m.isLeader ? " · 팀장" : ""}`);
  console.log("Also: daily tasks (4 weeks, some linked to weekly items), weekly items + 성과 (5 weeks), monthly goals, leader reviews, leaves, 8 milestones with update history.");
}

const args = new Set(process.argv.slice(2));
if (args.has("--clean")) clean();
else if (args.has("--reset")) { clean(); insert(); }
else insert();
