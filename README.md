# Platform Team Hub

사내 네트워크에서 쓰는 **팀 운영 도구**입니다. 구성원은 오늘·이번 주·이번 달 할 일을 정리하고, 팀장은 팀원의 진행 상황을 한눈에 보며 리뷰하고, 휴가 품의서와 주간 보고서, 회의 준비까지 한곳에서 처리합니다. 외부 서비스 없이 SQLite 파일 하나로 동작하며, OpenAI 키를 넣으면 보고서와 미팅 노트 초안을 AI가 써 줍니다.

> Internal team-operations hub for small engineering teams: daily/weekly/monthly planning, milestones, leader reviews, leave requests with printable forms, and AI-drafted weekly reports and meeting notes. Next.js 16 + SQLite, runs on a LAN.

## 주요 기능

**내 업무**
- **오늘** — 할 일을 항목으로 추가하고, 퇴근 전 완료 / 진행 중 / 미완료를 표시합니다. 전날 미완료 항목 가져오기, 이번 주 항목에서 끌어오기, 계획에 없던 일 메모.
- **이번 주** — 주간 항목을 월간 목표·팀 마일스톤에 연결하고 "오늘로" 버튼으로 일일 항목을 만듭니다. 주 마지막 근무일에 성과를 정리합니다.
- **이번 달** — 개인 월간 목표. 연결된 주간 항목 완료율이 목표 진행률로 모입니다.
- **기록** — 날짜별 한 일과 팀장 리뷰를 함께 봅니다.
- **미팅 노트** (팀장) — 회의 주제를 적어 두면 AI가 지난주 기록·이번주 계획·마일스톤·주의 신호로 구성원별 질문, 마일스톤 점검, 병목 체크리스트, 액션 아이템 표를 만든 회의 준비 노트를 씁니다.

**팀**
- **현황** — 하루 / 한 주 보기. 팀장은 팀원의 한 일 아래에 리뷰(코멘트)를 남깁니다.
- **마일스톤** — 타임라인(간트)과 월간 달력 보기. 상태별 색과 진행률, 지연 표시, 현황 업데이트 이력, 참여 현황(연결된 개인 항목).
- **관리** (팀장·관리자) — 팀원별 카드: 오늘 항목, 이번 주 진행률, 지난주 미완료, 담당 마일스톤, 마지막 리뷰, 주의 배지(할 일 미작성·항목 없음·지연 등). 카드에서 바로 리뷰와 주간 항목 지정.
- **주간 보고서** — 팀원 기록을 바탕으로 AI 초안 → 마크다운 편집 → 확정. 확정본은 팀원도 볼 수 있습니다.

**일정**
- **달력** — 팀 전체 휴가와 공휴일·휴무일.
- **휴가 품의서** — 연차·반차·공가·청원휴가·보상휴가·병가·조퇴·산전후휴가·기타. 소속·직급·성명·신청일수·잔여일수가 자동으로 채워지고, 저장하면 달력에 반영되며 **회사 워드 양식과 같은 A4 인쇄 화면**으로 바로 출력합니다. 본인의 연차·병가 잔여 현황 카드 포함.
- **연차 정책** — 입사일 기준 연차 연도(입사 기념일에 리셋). 1년차 매월 1일 발생(연 12일), 2~3년차 15일, 4년차부터 매년 +1일(최대 25일). 병가는 같은 기간 5일. 계약이 다르면 관리자가 구성원별로 직접 지정할 수 있습니다.

**관리** (관리자)
- 팀 생성과 팀장 지정, 구성원(직책·직급·이메일·전화·입사일·연차 규칙) 관리, 로그인 계정 생성(이메일 + 초기 비밀번호)·비밀번호 재설정·연결 해제.

## 역할

| 역할 | 할 수 있는 일 |
|---|---|
| 구성원 | 본인 일일·주간·월간 기록, 마일스톤 열람과 현황 업데이트, 본인 휴가 품의서, 확정된 팀 보고서 열람 |
| 팀장 | 구성원 권한 + 팀원 리뷰, 주간 항목 지정, 팀 마일스톤 관리, 주간 보고서·미팅 노트 작성, 팀 관리 페이지, 팀 품의서·잔여 현황 열람 |
| 관리자 | 전부 + 팀·구성원·계정 관리, 휴무일 등록 |

로그인은 이메일과 비밀번호입니다. 관리자가 구성원 이메일로 계정을 만들고 초기 비밀번호를 전달하면, 구성원은 우상단 메뉴에서 비밀번호를 바꿉니다.

## 기술 스택

Next.js 16 (App Router, Server Actions) · React 19 · TypeScript · Tailwind CSS v4 · shadcn/ui · SQLite (better-sqlite3) + Drizzle ORM · 쿠키 세션 인증(자체 구현, scrypt) · OpenAI Chat Completions(선택) · Pretendard

외부 서비스 의존이 없습니다. DB는 `data/app.db` 파일 하나이고, 마이그레이션은 앱 시작 시 자동 적용됩니다.

## 시작하기

```bash
pnpm install
cp .env.example .env          # ADMIN_*, OPENAI_API_KEY(선택) 등 수정
pnpm db:seed                  # DB 생성 + 마이그레이션 + 관리자 계정
pnpm db:seed:holidays         # 2026년 대한민국 공휴일 (선택, 근무일 계산에 사용)
pnpm dev                      # http://localhost:3000 (0.0.0.0 바인딩, LAN 접속 가능)
```

첫 로그인은 `.env`의 `ADMIN_USERNAME` / `ADMIN_PASSWORD`(기본 `admin` / `admin1234`)입니다. 로그인 후 **관리 › 팀**에서 팀을 만들고, **관리 › 구성원**에서 구성원과 계정을 추가하세요.

프로덕션:

```bash
pnpm build && pnpm start      # 0.0.0.0:3000
```

데모 데이터로 둘러보기:

```bash
pnpm db:seed:mock             # 3개 팀, 7명, 4주치 기록, 휴가, 마일스톤 (비밀번호 demo1234)
pnpm db:seed:mock --clean     # 데모 데이터만 삭제
```

## 설정 (.env)

| 키 | 설명 |
|---|---|
| `DATABASE_PATH` | SQLite 파일 경로 (기본 `./data/app.db`) |
| `ADMIN_USERNAME`, `ADMIN_PASSWORD`, `ADMIN_NAME`, `ADMIN_EMAIL` | 시드로 만드는 관리자 계정 |
| `SESSION_TTL_DAYS` | 세션 유지 기간 |
| `COOKIE_SECURE` | HTTPS 뒤에 둘 때만 `true`. LAN의 평문 HTTP에서는 `false` |
| `OPENAI_API_KEY`, `OPENAI_MODEL`, `OPENAI_BASE_URL` | 주간 보고서·미팅 노트 AI 초안. 키가 없으면 해당 버튼만 비활성화 |
| `SICK_LEAVE_DAYS` | 연차 연도당 병가 일수 (기본 5) |

AI 기능은 구성원 기록을 OpenAI로 전송합니다. 사내 정책을 확인하고 사용하세요. `OPENAI_BASE_URL`로 프록시나 호환 서버를 지정할 수 있습니다.

## 스크립트

| 스크립트 | 설명 |
|---|---|
| `pnpm dev` / `build` / `start` | 개발 / 빌드 / 프로덕션 서버 |
| `pnpm lint` | ESLint |
| `pnpm db:seed` | DB 생성·마이그레이션·관리자 계정 (반복 실행 안전) |
| `pnpm db:seed:holidays` | 2026 공휴일 등록 |
| `pnpm db:seed:mock [--reset\|--clean]` | 데모 데이터 |
| `pnpm db:generate` / `db:migrate` / `db:studio` | Drizzle 마이그레이션 생성 / 적용 / DB 브라우저 |

## 프로젝트 구조

```
src/
  proxy.ts                  라우트 가드 (세션 쿠키 없으면 /login)
  app/
    login/                  로그인
    (app)/                  인증 필요 영역 (공통 헤더)
      my/                   내 업무: today · week · month · history · meeting
      team/                 팀: 현황(day/week) · milestones · manage · report
      schedule/             일정: 달력 · requests(휴가 품의서)
      admin/                관리: members · teams
    print/                  인쇄 전용 페이지 (휴가 품의서 A4)
  lib/                      도메인 로직 (server actions, queries, 정책)
    auth/ members/ teams/ tasks/ plans/ reviews/ leaves/ requests/
    milestones/ reports/ meetings/ team/ db/
  components/               UI (shadcn/ui, 타임라인, AI 문서 편집기 등)
drizzle/                    SQL 마이그레이션
scripts/                    시드·변환 스크립트
templates/                  회사 휴가 품의서 원본(.docx, 인쇄 화면의 참고 양식)
data/                       SQLite 파일 (git 제외)
```

개발 관련 상세 규칙(팀 id 모델, 드리즐 마이그레이션 주의점, 권한 헬퍼 등)은 `CLAUDE.md`를 참고하세요.

## 라이선스

사내 사용 목적의 비공개 프로젝트입니다.
